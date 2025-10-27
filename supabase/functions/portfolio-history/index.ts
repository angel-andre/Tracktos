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
      const timestamp = startDate.getTime() + (interval * i);
      const date = new Date(timestamp);
      
      // Ensure we're not querying future dates
      if (date > now) continue;
      
      const dateStr = date.toISOString().split('T')[0];
      
      // CoinGecko historical price endpoint (free tier, 1 call per token)
      // Format: DD-MM-YYYY
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const formattedDate = `${day}-${month}-${year}`;
      
      console.log(`Fetching prices for ${dateStr}...`);
      
      let totalValue = 0;
      
      // Fetch prices for ALL tokens in parallel for this date to reduce time
      const pricePromises = tokenBalances.map(async (token) => {
        try {
          const priceUrl = `https://api.coingecko.com/api/v3/coins/${token.coinGeckoId}/history?date=${formattedDate}`;
          const priceResp = await fetch(priceUrl);
          
          if (priceResp.ok) {
            const priceData = await priceResp.json();
            const price = priceData.market_data?.current_price?.usd || 0;
            const value = token.balance * price;
            
            console.log(`  ${token.symbol}: $${price.toFixed(4)} x ${token.balance.toFixed(2)} = $${value.toFixed(2)}`);
            return value;
          } else {
            console.log(`  ${token.symbol}: Price not available (${priceResp.status})`);
            return 0;
          }
        } catch (error) {
          console.error(`Error fetching price for ${token.symbol}:`, error);
          return 0;
        }
      });
      
      const values = await Promise.all(pricePromises);
      totalValue = values.reduce((sum, val) => sum + val, 0);
      
      // Rate limiting: wait 2s between date points (batch requests)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
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
