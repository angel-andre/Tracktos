import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PortfolioHistoryRequest {
  address: string;
  timeframe: '7D' | '30D' | '90D';
}

interface HistoricalDataPoint {
  date: string;
  value: number;
}

interface TokenBalance {
  symbol: string;
  balance: number;
  coinGeckoId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address, timeframe } = await req.json() as PortfolioHistoryRequest;

    if (!address || !timeframe) {
      return new Response(
        JSON.stringify({ error: 'Missing address or timeframe' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching portfolio history for ${address} with timeframe ${timeframe}`);

    // Calculate time range - use current date/time and clamp to past dates only
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const days = timeframe === '7D' ? 7 : timeframe === '30D' ? 30 : 90;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    
    // We'll compute one point per day
    console.log(`Generating ${days} data points over ${days} days`);

    // Step 1: Fetch current token holdings from Aptos Fullnode API
    const graphqlUrl = 'https://api.mainnet.aptoslabs.com/v1/graphql';
    const graphqlQuery = `
      query GetCurrentBalances($address: String!) {
        current_fungible_asset_balances(where: {owner_address: {_eq: $address}}) {
          amount
          asset_type
          metadata {
            name
            symbol
            decimals
          }
        }
      }
    `;

    console.log('Fetching current token balances...');
    const graphqlResp = await fetch(graphqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: graphqlQuery,
        variables: { address }
      })
    });

    if (!graphqlResp.ok) {
      throw new Error('Failed to fetch current token balances');
    }

    const graphqlData = await graphqlResp.json();
    
    // Helper to format balance
    const formatUnits = (value: unknown, decimals: number): number => {
      const raw = value ?? '0';
      const v = String(raw).replace(/\D/g, '');
      const d = Math.max(0, Math.min(18, decimals || 8));
      if (!v || v === '0') return 0;
      
      const divisor = Math.pow(10, d);
      return parseFloat(v) / divisor;
    };

    // Helper: identify APT and parse Aptos contract address from asset type
    const getCoinGeckoIdIfApt = (symbol: string, assetType: string): string | null => {
      if (assetType === '0x1::aptos_coin::AptosCoin' || symbol === 'APT') return 'aptos';
      return null;
    };
    const getAptosContractAddress = (assetType: string): string | null => {
      const addr = String(assetType || '').split('::')[0];
      return addr ? addr.toLowerCase() : null;
    };
    const isStableUsd = (symbol: string): boolean => symbol === 'USDC' || symbol === 'USDT';

    // Process current balances
    const rawTokenBalances: Array<{ symbol: string; balance: number; assetType: string; coinGeckoId: string } > = [];
    const balances = graphqlData.data?.current_fungible_asset_balances || [];
    const decimalsByAsset = new Map<string, number>();

    // First pass: collect decimals and candidate Aptos contract addresses we need to map
    const candidates: Array<{ symbol: string; assetType: string; balance: number }> = [];
    for (const item of balances) {
      const symbol = item.metadata?.symbol?.toUpperCase() || '';
      const decimals = item.metadata?.decimals ?? 8;
      const assetType = String(item.asset_type || '');
      const balance = formatUnits(item.amount, decimals);
      decimalsByAsset.set(assetType, decimals);
      if (balance > 0) {
        const isApt = !!getCoinGeckoIdIfApt(symbol, assetType);
        const stable = isStableUsd(symbol);
        if (!isApt && !stable) {
          candidates.push({ symbol, assetType, balance });
        }
      }
    }

    // Build Aptos platform contract -> CoinGecko id map
    let aptosPlatformMap = new Map<string, string>();
    if (candidates.length > 0) {
      try {
        const listUrl = 'https://api.coingecko.com/api/v3/coins/list?include_platform=true';
        const listResp = await fetch(listUrl);
        if (listResp.ok) {
          const listData: Array<{ id: string; platforms?: Record<string, string> }> = await listResp.json();
          const map = new Map<string, string>();
          for (const c of listData) {
            const addr = c.platforms?.aptos;
            if (addr) map.set(addr.toLowerCase(), c.id);
          }
          aptosPlatformMap = map;
        } else {
          console.log('CoinGecko list fetch failed:', listResp.status);
        }
      } catch (e) {
        console.log('CoinGecko list fetch error:', e);
      }
    }

    // Second pass: create priced token list (APT, stables at $1, and mapped Aptos tokens via CoinGecko)
    for (const item of balances) {
      const symbol = item.metadata?.symbol?.toUpperCase() || '';
      const decimals = item.metadata?.decimals ?? 8;
      const balance = formatUnits(item.amount, decimals);
      const assetType = item.asset_type as string;
      if (balance <= 0) continue;

      // Prefer exact APT mapping; treat known stables as $1 without CoinGecko
      let cgId: string | null = getCoinGeckoIdIfApt(symbol, assetType) || (isStableUsd(symbol) ? 'STABLE_USD' : null);

      // If not APT/stable, try to map by Aptos contract address via CoinGecko platforms
      if (!cgId) {
        const addr = getAptosContractAddress(assetType);
        if (addr) cgId = aptosPlatformMap.get(addr) || null;
      }

      if (cgId) {
        rawTokenBalances.push({ symbol, balance, assetType, coinGeckoId: cgId });
      }
    }

    // Deduplicate by pricing source:
    // - For STABLE_USD, SUM balances across USDC/USDT
    // - For other assets (e.g., APT), keep the LARGEST balance to avoid double-counting wrappers
    const aggregated = new Map<string, { symbol: string; balance: number; assetType: string; coinGeckoId: string }>();
    const assetTypeById = new Map<string, string>();
    for (const t of rawTokenBalances) {
      const existing = aggregated.get(t.coinGeckoId);
      if (!existing) {
        aggregated.set(t.coinGeckoId, { ...t });
      } else if (t.coinGeckoId === 'STABLE_USD') {
        existing.balance += t.balance;
        aggregated.set(t.coinGeckoId, existing);
      } else if (t.balance > existing.balance) {
        aggregated.set(t.coinGeckoId, { ...t });
      }
    }
    const uniqueTokenBalances: TokenBalance[] = Array.from(aggregated.values()).map((t) => ({
      symbol: t.symbol,
      balance: t.balance,
      coinGeckoId: t.coinGeckoId,
    }));
    for (const t of aggregated.values()) {
      assetTypeById.set(t.coinGeckoId, t.assetType);
    }

    console.log(`Selected ${uniqueTokenBalances.length} tokens:`, uniqueTokenBalances.map(t => `${t.symbol}(${t.balance.toFixed(4)})`));

    if (uniqueTokenBalances.length === 0) {
      // Return empty array if no tokens
      return new Response(
        JSON.stringify([]),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Fetch historical prices once per token and calculate portfolio values
// historicalData will be built after flows aggregation

    // Build list of target dates (YYYY-MM-DD) over the range
    const dateList: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i + 1); // start the day after startDate up to 'now'
      if (d > now) break;
      dateList.push(d.toISOString().split('T')[0]);
    }

    console.log(`Will compute values for dates:`, dateList);

    // Fetch market charts for each token in parallel (daily prices)
    const priceMaps = await Promise.all(
      uniqueTokenBalances.map(async (token) => {
        try {
          if (token.coinGeckoId === 'STABLE_USD') {
            const map: Record<string, number> = {};
            for (const ds of dateList) map[ds] = 1; // $1 peg for stables
            return { id: token.coinGeckoId, prices: map };
          }

          const url = `https://api.coingecko.com/api/v3/coins/${token.coinGeckoId}/market_chart?vs_currency=usd&days=${days + 1}&interval=daily`;
          const resp = await fetch(url);
          if (!resp.ok) {
            console.log(`${token.symbol}: market_chart not available (${resp.status})`);
            return { id: token.coinGeckoId, prices: {} as Record<string, number> };
          }
          const data = await resp.json();
          const series: Array<[number, number]> = data.prices || [];
          const map: Record<string, number> = {};
          for (const [ts, price] of series) {
            const ds = new Date(ts).toISOString().split('T')[0];
            map[ds] = price;
          }
          console.log(`${token.symbol}: loaded ${Object.keys(map).length} price points`);
          return { id: token.coinGeckoId, prices: map };
        } catch (e) {
          console.error(`Error fetching market_chart for ${token.symbol}:`, e);
          return { id: token.coinGeckoId, prices: {} as Record<string, number> };
        }
      })
    );

    // Build a quick lookup from token ID to its daily prices
    const priceLookup = new Map<string, Record<string, number>>(
      priceMaps.map((p) => [p.id, p.prices])
    );

    // Build net flows per day per token (true historical balances)
    const USE_FLOWS = false; // Temporary safe mode: disable flows while we verify signs and schema
    const flowsByDateById = new Map<string, Map<string, number>>();
    
    if (USE_FLOWS) {
      // 1) Fetch on-chain activities within range using fungible_asset_activities only (covers APT and other tokens)
      const activitiesQuery = `
        query Activities($address: String!, $start: timestamptz, $end: timestamptz, $assetTypes: [String!]) {
          fungible_asset_activities(
            where: { owner_address: { _eq: $address }, transaction_timestamp: { _gte: $start, _lte: $end }, asset_type: { _in: $assetTypes } }
            order_by: { transaction_timestamp: asc }
            limit: 10000
          ) {
            transaction_timestamp
            amount
            asset_type
          }
        }
      `;
      
      // Build asset type list for tracked tokens (APT + stables + any priced tokens from balances)
      const trackedAssetTypes = Array.from(new Set(rawTokenBalances.map((t) => t.assetType)));
      
      const startIso = new Date(startDate).toISOString();
      const endIso = new Date(now).toISOString();
      
      console.log('Fetching activities for range', startIso, '->', endIso, 'assets:', trackedAssetTypes.length);
      const activitiesResp = await fetch(graphqlUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: activitiesQuery,
          variables: { address, start: startIso, end: endIso, assetTypes: trackedAssetTypes }
        })
      });
      
      if (!activitiesResp.ok) {
        console.log('Activities fetch failed:', activitiesResp.status);
      }
      
      const activitiesData = activitiesResp.ok ? await activitiesResp.json() : { data: { coin_activities: [], fungible_asset_activities: [] } };
      
      // 2) Aggregate flows per date and token id
      const addFlow = (dateStr: string, id: string, delta: number) => {
        let m = flowsByDateById.get(dateStr);
        if (!m) { m = new Map(); flowsByDateById.set(dateStr, m); }
        m.set(id, (m.get(id) || 0) + delta);
      };
      
      // Other tokens via fungible_asset_activities (amount may be signed)
      const idByAssetType = new Map<string, string>();
      for (const t of rawTokenBalances) { idByAssetType.set(t.assetType, t.coinGeckoId); }
      const faActs: Array<{ transaction_timestamp: string; amount: string; asset_type: string }> = activitiesData.data?.fungible_asset_activities || [];
      for (const a of faActs) {
        const dateStr = (a.transaction_timestamp || '').split('T')[0];
        const assetType = String(a.asset_type || '');
        const id = idByAssetType.get(assetType);
        if (!id) continue;
        const decimals = decimalsByAsset.get(assetType) ?? 8;
        const amtStr = String(a.amount ?? '0').trim();
        const isNeg = amtStr.startsWith('-');
        const rawAbs = isNeg ? amtStr.slice(1) : amtStr;
        const units = Number(formatUnits(rawAbs, decimals));
        addFlow(dateStr, id, (isNeg ? -1 : 1) * units);
      }
    }

    // 3) Compute end-of-day balances per date using current balances and suffix sums of flows
    const currentById = new Map<string, number>(uniqueTokenBalances.map(t => [t.coinGeckoId, t.balance]));

    // Compute starting balances by reversing flows over the whole window
    const totalFlowById = new Map<string, number>();
    for (const m of flowsByDateById.values()) {
      for (const [id, delta] of m.entries()) {
        totalFlowById.set(id, (totalFlowById.get(id) || 0) + delta);
      }
    }

    const startBalanceById = new Map<string, number>();
    const trackedIds = new Set<string>([...priceLookup.keys()]);
    for (const t of uniqueTokenBalances) trackedIds.add(t.coinGeckoId);

    for (const id of trackedIds) {
      const curr = currentById.get(id) || 0;
      const totalFlow = totalFlowById.get(id) || 0;
      startBalanceById.set(id, curr - totalFlow);
    }

    // Helper to get price with fallback to the most recent previous day that has a price
    const getPriceFor = (id: string, dateIndex: number): number => {
      const prices = priceLookup.get(id) || {};
      for (let k = dateIndex; k >= 0; k--) {
        const ds = dateList[k];
        const p = prices[ds];
        if (typeof p === 'number') return p;
      }
      return 0;
    };

    // Roll forward day by day from the starting balance, applying flows per day
    const runningById = new Map<string, number>(startBalanceById);
    const historicalData: HistoricalDataPoint[] = [];

    for (let i = 0; i < dateList.length; i++) {
      const dateStr = dateList[i];

      // Apply flows for this day first to represent end-of-day balances
      const dayFlows = flowsByDateById.get(dateStr);
      if (dayFlows) {
        for (const [id, delta] of dayFlows.entries()) {
          runningById.set(id, (runningById.get(id) || 0) + delta);
        }
      }

      // Price the portfolio
      let totalValue = 0;
      for (const id of trackedIds) {
        const bal = runningById.get(id) || 0;
        if (!bal) continue;
        const price = getPriceFor(id, i);
        totalValue += bal * price;
      }

      const val = Math.round(totalValue * 100) / 100;
      historicalData.push({ date: dateStr, value: val });
      console.log(`✓ ${dateStr}: $${val.toFixed(2)}`);
    }

    console.log(`Generated ${historicalData.length} historical data points`);

    return new Response(
      JSON.stringify(historicalData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in portfolio-history function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
