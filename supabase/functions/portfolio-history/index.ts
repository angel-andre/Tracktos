import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ==================== Security: Input Validation ====================
function validateAptosAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  const aptosAddressRegex = /^0x[a-fA-F0-9]{1,64}$/;
  return aptosAddressRegex.test(address) && address.length <= 66;
}

function validateTimeframe(timeframe: string): boolean {
  return ['7D', '30D', '90D', '180D', '365D'].includes(timeframe);
}

// ==================== Security: Rate Limiting ====================
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 15; // 15 requests per minute per address

function checkRateLimit(address: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(address);
  
  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(address, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (limit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  limit.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW);

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

    // ==================== Security: Input Validation ====================
    if (!address || !timeframe) {
      return new Response(
        JSON.stringify({ error: 'Address and timeframe are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!validateAptosAddress(address)) {
      return new Response(
        JSON.stringify({ error: 'Invalid address format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!validateTimeframe(timeframe)) {
      return new Response(
        JSON.stringify({ error: 'Invalid timeframe' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== Security: Rate Limiting ====================
    if (!checkRateLimit(address)) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
    const getCoinGeckoIdIfApt = (_symbol: string, assetType: string): string | null => {
      return assetType === '0x1::aptos_coin::AptosCoin' ? 'aptos' : null;
    };
    const normalizeAptosAssetType = (assetType: string): string | null => {
      const t = String(assetType || '').trim().toLowerCase();
      return t || null;
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

    // Second pass: Include APT, stablecoins, AND all other Aptos tokens via CoinGecko platform mapping
    for (const item of balances) {
      const symbol = item.metadata?.symbol?.toUpperCase() || '';
      const decimals = item.metadata?.decimals ?? 8;
      const balance = formatUnits(item.amount, decimals);
      const assetType = item.asset_type as string;
      if (balance <= 0) continue;

      // Start with APT and stablecoins mapped to real CoinGecko IDs
      let cgId: string | null =
        getCoinGeckoIdIfApt(symbol, assetType) ||
        (symbol === 'USDC' ? 'usd-coin' : symbol === 'USDT' ? 'tether' : null);

      // If not APT/stable, try to map by Aptos contract address via CoinGecko platforms
      if (!cgId) {
        const key = normalizeAptosAssetType(assetType);
        if (key) cgId = aptosPlatformMap.get(key) || null;
      }

      if (cgId) {
        rawTokenBalances.push({ symbol, balance, assetType, coinGeckoId: cgId });
      }
    }

    // Deduplicate by pricing source:
    // - Keep the LARGEST balance per CoinGecko id to avoid double-counting wrappers
    const aggregated = new Map<string, { symbol: string; balance: number; assetType: string; coinGeckoId: string }>();
    const assetTypeById = new Map<string, string>();
    for (const t of rawTokenBalances) {
      const existing = aggregated.get(t.coinGeckoId);
      if (!existing) {
        aggregated.set(t.coinGeckoId, { ...t });
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
// Include staked APT in APT balance (liquid + staked)
let stakedAptUnits = 0;
try {
  const stakingQuery = `
    query Stake($address: String!) {
      delegated_staking_activities(
        where: {delegator_address: {_eq: $address}}
        order_by: {transaction_version: desc}
        limit: 1
      ) {
        amount
      }
    }
  `;
  const stakingResp = await fetch(graphqlUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: stakingQuery, variables: { address } })
  });
  if (stakingResp.ok) {
    const stakingData = await stakingResp.json();
    const amt = stakingData?.data?.delegated_staking_activities?.[0]?.amount;
    if (amt) {
      stakedAptUnits = formatUnits(amt, 8);
      console.log('✓ Detected staked APT units:', stakedAptUnits);
    }
  } else {
    console.log('Staking query failed:', stakingResp.status);
  }
} catch (e) {
  console.log('Staking query error:', e);
}

if (stakedAptUnits > 0) {
  const aptIdx = uniqueTokenBalances.findIndex(t => t.coinGeckoId === 'aptos');
  if (aptIdx >= 0) {
    uniqueTokenBalances[aptIdx].balance += stakedAptUnits;
  } else {
    uniqueTokenBalances.push({ symbol: 'APT', balance: stakedAptUnits, coinGeckoId: 'aptos' });
  }
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
        const id = token.coinGeckoId;
        const symbol = token.symbol;
        // Helper to build YYYY-MM-DD map from [ms, price] arrays
        const mapFromSeries = (series: Array<[number, number]>) => {
          const map: Record<string, number> = {};
          for (const [ts, price] of series) {
            const ds = new Date(ts).toISOString().split('T')[0];
            map[ds] = price;
          }
          return map;
        };

        try {
          // 1) Try CoinGecko daily market_chart
          const cgUrl = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days + 1}&interval=daily`;
          const cgResp = await fetch(cgUrl);
          if (cgResp.ok) {
            const data = await cgResp.json();
            const series: Array<[number, number]> = data.prices || [];
            const map = mapFromSeries(series);
            if (Object.keys(map).length > 0) {
              console.log(`${symbol}: loaded ${Object.keys(map).length} price points from CoinGecko`);
              return { id, prices: map };
            }
          } else {
            console.log(`${symbol}: market_chart not available (${cgResp.status})`);
          }

          // 2) Special robust fallback for APT using Binance klines
          if (id === 'aptos') {
            try {
              const limit = Math.min(days + 2, 1000);
              const binUrl = `https://api.binance.com/api/v3/klines?symbol=APTUSDT&interval=1d&limit=${limit}`;
              const binResp = await fetch(binUrl);
              if (binResp.ok) {
                const klines: any[] = await binResp.json();
                const map: Record<string, number> = {};
                for (const k of klines) {
                  const openTime = k[0];
                  const close = parseFloat(k[4]);
                  const ds = new Date(openTime).toISOString().split('T')[0];
                  map[ds] = close; // USDT ~ USD peg
                }
                if (Object.keys(map).length > 0) {
                  console.log(`APT: loaded ${Object.keys(map).length} price points from Binance`);
                  return { id, prices: map };
                }
              } else {
                console.log(`Binance klines failed for APT: ${binResp.status}`);
              }
            } catch (e) {
              console.log('Binance klines error for APT:', e);
            }
          }

          // 3) Fallback to empty map
          return { id, prices: {} as Record<string, number> };
        } catch (e) {
          console.error(`Error fetching market_chart for ${symbol}:`, e);
          return { id, prices: {} as Record<string, number> };
        }
      })
    );

    // Build a quick lookup from token ID to its daily prices
    const priceLookup = new Map<string, Record<string, number>>(
      priceMaps.map((p) => [p.id, p.prices])
    );

    // Build base fallback prices for tokens lacking historical series
    const baseNowPrices = new Map<string, number>();
    baseNowPrices.set('usd-coin', 1);
    baseNowPrices.set('tether', 1);

    // Map token id -> symbol for DexScreener queries
    const symbolById = new Map<string, string>();
    for (const t of uniqueTokenBalances) {
      symbolById.set(t.coinGeckoId, t.symbol);
    }

    // Determine which ids have no historical price data
    const idsNeedingBase = Array.from(priceLookup.keys()).filter((id) => {
      const m = priceLookup.get(id) || {};
      return Object.keys(m).length === 0;
    });

    if (idsNeedingBase.length > 0) {
      try {
        // Try to get APT base price from CoinGecko coins endpoint instead of Dex
        if (idsNeedingBase.includes('aptos')) {
          try {
            const cgResp = await fetch('https://api.coingecko.com/api/v3/coins/aptos?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false');
            if (cgResp.ok) {
              const cg = await cgResp.json();
              const p = Number(cg?.market_data?.current_price?.usd);
              if (Number.isFinite(p)) {
                baseNowPrices.set('aptos', p);
                console.log(`✓ Base price for APT via CG coins: $${p}`);
              }
            } else {
              console.log('CG coins fallback failed:', cgResp.status);
            }
          } catch (e) {
            console.log('CG coins fallback error:', e);
          }

          // Secondary fallbacks for APT if CoinGecko is rate-limited
          if (!baseNowPrices.has('aptos')) {
            // Try CoinCap current price
            try {
              const cc = await fetch('https://api.coincap.io/v2/assets/aptos');
              if (cc.ok) {
                const j = await cc.json();
                const p = Number(j?.data?.priceUsd);
                if (Number.isFinite(p) && p > 0) {
                  baseNowPrices.set('aptos', p);
                  console.log(`✓ Base price for APT via CoinCap: $${p}`);
                }
              } else {
                console.log('CoinCap APT base fetch failed:', cc.status);
              }
            } catch (e2) {
              console.log('CoinCap APT base fetch error:', e2);
            }
          }

          if (!baseNowPrices.has('aptos')) {
            // Try Binance ticker (APTUSDT) as final fallback
            try {
              const bin = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=APTUSDT');
              if (bin.ok) {
                const j = await bin.json();
                const p = Number(j?.price);
                if (Number.isFinite(p) && p > 0) {
                  baseNowPrices.set('aptos', p);
                  console.log(`✓ Base price for APT via Binance: $${p}`);
                }
              } else {
                console.log('Binance APT ticker failed:', bin.status);
              }
            } catch (e3) {
              console.log('Binance APT ticker error:', e3);
            }
          }
        }

        const idsForDex = idsNeedingBase.filter(id => id !== 'aptos' && id !== 'usd-coin' && id !== 'tether');

        const dexResults = await Promise.all(
          idsForDex.map(async (id) => {
            const sym = symbolById.get(id);
            if (!sym) return null;
            try {
              const dexUrl = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(sym)}%20aptos`;
              const dexResp = await fetch(dexUrl);
              if (dexResp.ok) {
                const dexData = await dexResp.json();
                const pairs = dexData?.pairs || [];
                const aptPair = pairs.find((p: any) => p.chainId === 'aptos' && p.priceUsd && (p.baseToken?.symbol === sym || p.quoteToken?.symbol === sym));
                if (aptPair?.priceUsd) {
                  const price = parseFloat(aptPair.priceUsd);
                  console.log(`✓ Base price for ${sym} from DexScreener: $${price}`);
                  return { id, price };
                }
              }
            } catch (e) {
              console.log(`DexScreener base price error for ${sym}:`, e);
            }
            return null;
          })
        );
        for (const r of dexResults) {
          if (r) baseNowPrices.set(r.id, r.price);
        }
      } catch (e) {
        console.log('DexScreener base price parallel fetch error:', e);
      }
    }

    // Build net flows per day per token (true historical balances)
    const USE_FLOWS = false; // Disable flows to avoid counting staking as outflows; price current balances over time
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
    // Track ALL tokens we could price to match Tokens section totals (APT + all Aptos tokens)
    const allIds = new Set<string>([...priceLookup.keys()]);
    for (const t of uniqueTokenBalances) allIds.add(t.coinGeckoId);

    const trackedIds = new Set<string>(Array.from(allIds));
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
      // Fallback to base/live price if no historical data for this token
      const base = baseNowPrices.get(id);
      if (typeof base === 'number' && isFinite(base) && base > 0) return base;
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

    // Inject a live snapshot for "today" using current balances and real-time prices
    // Use CoinGecko for live prices, fallback to latest historical price we already fetched
    try {
      const tracked = Array.from(trackedIds);
      const ids = tracked;
      let nowPrices = new Map<string, number>();
      
      // Try CoinGecko for live prices
      if (ids.length > 0) {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.join(','))}&vs_currencies=usd`;
        const resp = await fetch(url);
        if (resp.ok) {
          const j = await resp.json();
          for (const id of ids) {
            const p = j?.[id]?.usd;
            if (typeof p === 'number') {
              nowPrices.set(id, p);
              console.log(`✓ Live price for ${id}: $${p}`);
            }
          }
        } else {
          console.log('CoinGecko simple/price fetch failed:', resp.status);
        }
      }

      // Ensure APT live price via CoinGecko coins endpoint if missing
      if (ids.includes('aptos') && !nowPrices.has('aptos')) {
        try {
          const cgResp = await fetch('https://api.coingecko.com/api/v3/coins/aptos?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false');
          if (cgResp.ok) {
            const cg = await cgResp.json();
            const p = Number(cg?.market_data?.current_price?.usd);
            if (Number.isFinite(p)) {
              nowPrices.set('aptos', p);
              console.log(`✓ Live price for aptos via CG coins: $${p}`);
            }
          } else {
            console.log('CG coins fallback failed:', cgResp.status);
          }
        } catch (e) {
          console.log('CG coins fallback error:', e);
        }
      }

      // Final fallback for APT live price via Binance if still missing
      if (ids.includes('aptos') && !nowPrices.has('aptos')) {
        try {
          const bin = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=APTUSDT');
          if (bin.ok) {
            const j = await bin.json();
            const p = Number(j?.price);
            if (Number.isFinite(p) && p > 0) {
              nowPrices.set('aptos', p);
              console.log(`✓ Live price for aptos via Binance: $${p}`);
            }
          } else {
            console.log('Binance ticker failed for APT live:', bin.status);
          }
        } catch (e) {
          console.log('Binance APT live error:', e);
        }
      }

      // Fallback: For tokens missing from CoinGecko, try DexScreener (Aptos chain only)
      const missingIds = ids.filter((id) => !nowPrices.has(id) && id !== 'aptos');
      if (missingIds.length > 0) {
        // Build id -> symbol map
        const symbolById = new Map<string, string>();
        for (const t of uniqueTokenBalances) {
          symbolById.set(t.coinGeckoId, t.symbol);
        }
        try {
          const dexResults = await Promise.all(
            missingIds.map(async (id) => {
              const sym = symbolById.get(id);
              if (!sym) return null;
              try {
                const dexUrl = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(sym)}%20aptos`;
                const dexResp = await fetch(dexUrl);
                if (dexResp.ok) {
                  const dexData = await dexResp.json();
                  const pairs = dexData?.pairs || [];
                  const aptPair = pairs.find((p: any) => p.chainId === 'aptos' && p.priceUsd && (p.baseToken?.symbol === sym || p.quoteToken?.symbol === sym));
                  if (aptPair?.priceUsd) {
                    const price = parseFloat(aptPair.priceUsd);
                    console.log(`✓ Live price for ${sym} from DexScreener: $${price}`);
                    return { id, price };
                  }
                }
              } catch (e) {
                console.log(`DexScreener error for ${sym}:`, e);
              }
              return null;
            })
          );
          for (const r of dexResults) {
            if (r) nowPrices.set(r.id, r.price);
          }
        } catch (e) {
          console.log('DexScreener parallel fetch error:', e);
        }
      }

      const gotLive = nowPrices.size > 0;

      let snapshot = 0;
      for (const id of tracked) {
        const bal = currentById.get(id) || 0;
        if (!bal) continue;
        let price = 0;
        if (id === 'usd-coin' || id === 'tether') {
          price = 1;
        } else if (gotLive && nowPrices.has(id)) {
          price = nowPrices.get(id) || 0;
        } else {
          // Fallback to latest historical price
          price = getPriceFor(id, dateList.length - 1);
        }
        snapshot += bal * price;
        console.log(`  ${id}: ${bal.toFixed(4)} × $${price.toFixed(6)} = $${(bal * price).toFixed(2)}`);
      }
      snapshot = Math.round(snapshot * 100) / 100;

      const todayStr = new Date().toISOString().split('T')[0];
      if (historicalData.length) {
        const lastIdx = historicalData.length - 1;
        if (historicalData[lastIdx].date === todayStr) {
          // Only override today's value if we have a reliable live price for APT
          const overrideToday = nowPrices.has('aptos');
          if (overrideToday) {
            historicalData[lastIdx].value = snapshot;
            console.log(`Updated live snapshot for ${todayStr} with real-time prices: $${snapshot.toFixed(2)}`);
          } else {
            console.log(`Kept computed value for ${todayStr}; apt live price unavailable, used historical fallback in calculation.`);
          }
        } else {
          // If today isn't present, append using best available (live or historical fallback)
          historicalData.push({ date: todayStr, value: snapshot });
          console.log(`Appended snapshot for ${todayStr} using ${gotLive ? 'real-time' : 'historical fallback'} prices: $${snapshot.toFixed(2)}`);
        }
      } else {
        historicalData.push({ date: todayStr, value: snapshot });
        console.log(`Initialized first snapshot for ${todayStr}: $${snapshot.toFixed(2)}`);
      }
    } catch (e) {
      console.log('Failed to append live snapshot:', e);
    }

    return new Response(
      JSON.stringify(historicalData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in portfolio-history function:', error);
    // ==================== Security: Generic Error Message ====================
    return new Response(
      JSON.stringify({ error: 'Service temporarily unavailable' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
