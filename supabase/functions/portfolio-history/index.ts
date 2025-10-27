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

    // Calculate time range
    const now = Date.now();
    const days = timeframe === '7D' ? 7 : timeframe === '30D' ? 30 : 90;
    const startTimestamp = now - (days * 24 * 60 * 60 * 1000);
    
    // Number of data points (approximately one per day for better granularity)
    const dataPoints = Math.min(days, 30);
    const interval = (now - startTimestamp) / dataPoints;

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

    console.log(`Found ${tokenBalances.length} tokens with balances:`, tokenBalances.map(t => t.symbol));

    if (tokenBalances.length === 0) {
      // Return empty array if no tokens
      return new Response(
        JSON.stringify([]),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Fetch historical prices and calculate portfolio values
    const historicalData: HistoricalDataPoint[] = [];
    const coinGeckoIdsList = tokenBalances.map(t => t.coinGeckoId).join(',');

    for (let i = 0; i <= dataPoints; i++) {
      const timestamp = startTimestamp + (interval * i);
      const date = new Date(timestamp);
      const dateStr = date.toISOString().split('T')[0];
      
      // CoinGecko historical price endpoint (free tier, 1 call per token)
      // Format: DD-MM-YYYY
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const formattedDate = `${day}-${month}-${year}`;
      
      console.log(`Fetching prices for ${dateStr}...`);
      
      let totalValue = 0;
      
      // Fetch prices for each token at this historical date
      for (const token of tokenBalances) {
        try {
          const priceUrl = `https://api.coingecko.com/api/v3/coins/${token.coinGeckoId}/history?date=${formattedDate}`;
          const priceResp = await fetch(priceUrl);
          
          if (priceResp.ok) {
            const priceData = await priceResp.json();
            const price = priceData.market_data?.current_price?.usd || 0;
            const value = token.balance * price;
            totalValue += value;
            
            console.log(`  ${token.symbol}: $${price.toFixed(4)} x ${token.balance.toFixed(2)} = $${value.toFixed(2)}`);
          } else {
            console.log(`  ${token.symbol}: Price not available`);
          }
          
          // Rate limiting: wait 1.5s between requests (CoinGecko free tier allows ~10-30 calls/min)
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (error) {
          console.error(`Error fetching price for ${token.symbol}:`, error);
        }
      }
      
      historicalData.push({
        date: dateStr,
        value: Math.round(totalValue * 100) / 100
      });
      
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
