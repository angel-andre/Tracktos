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

    // Calculate time range - ensure we're using past dates only
    const now = new Date();
    // Set to yesterday to ensure we have historical data
    now.setDate(now.getDate() - 1);
    now.setHours(0, 0, 0, 0);
    
    const days = timeframe === '7D' ? 7 : timeframe === '30D' ? 30 : 90;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    
    // Reduce data points to avoid timeout (1 point every 3 days for 30D/90D)
    const dataPoints = timeframe === '7D' ? 7 : timeframe === '30D' ? 10 : 15;
    const interval = (now.getTime() - startDate.getTime()) / dataPoints;

    console.log(`Generating ${dataPoints} data points over ${days} days`);

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

    // Map token symbols to CoinGecko IDs
    const coinGeckoIds: Record<string, string> = {
      'APT': 'aptos',
      'USDC': 'usd-coin',
      'USDT': 'tether',
      'WETH': 'weth',
      'BTC': 'bitcoin',
      'SOL': 'solana',
      'GUI': 'gui-inu',
      'CAKE': 'pancakeswap-token',
      'WBTC': 'wrapped-bitcoin'
    };

    // Process current balances
    const tokenBalances: TokenBalance[] = [];
    const balances = graphqlData.data?.current_fungible_asset_balances || [];
    
    for (const item of balances) {
      const symbol = item.metadata?.symbol?.toUpperCase() || '';
      const decimals = item.metadata?.decimals ?? 8;
      const balance = formatUnits(item.amount, decimals);
      
      if (balance > 0 && coinGeckoIds[symbol]) {
        tokenBalances.push({
          symbol,
          balance,
          coinGeckoId: coinGeckoIds[symbol]
        });
      }
    }

    // Deduplicate tokens by CoinGecko ID and sum balances (avoid double counting same token)
    const aggregated = new Map<string, TokenBalance>();
    for (const t of tokenBalances) {
      const existing = aggregated.get(t.coinGeckoId);
      if (existing) {
        existing.balance += t.balance;
        aggregated.set(t.coinGeckoId, existing);
      } else {
        aggregated.set(t.coinGeckoId, { ...t });
      }
    }
    const uniqueTokenBalances = Array.from(aggregated.values());

    console.log(`Found ${uniqueTokenBalances.length} unique tokens with balances:`, uniqueTokenBalances.map(t => `${t.symbol}(${t.balance.toFixed(2)})`));

    if (uniqueTokenBalances.length === 0) {
      // Return empty array if no tokens
      return new Response(
        JSON.stringify([]),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Fetch historical prices once per token and calculate portfolio values
    const historicalData: HistoricalDataPoint[] = [];

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

    // For each date, sum current balances * historical price
    for (const dateStr of dateList) {
      let totalValue = 0;
      for (const token of uniqueTokenBalances) {
        const tokenPrices = priceLookup.get(token.coinGeckoId) || {};
        const price = tokenPrices[dateStr] ?? 0;
        totalValue += token.balance * price;
      }
      historicalData.push({ date: dateStr, value: Math.round(totalValue * 100) / 100 });
      console.log(`✓ ${dateStr}: $${totalValue.toFixed(2)}`);
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
