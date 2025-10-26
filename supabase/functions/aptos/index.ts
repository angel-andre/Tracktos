import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AptosResponse {
  account: {
    address: string;
    aptBalance: string;
  };
  tokens: Array<{
    name: string;
    symbol: string;
    balance: string;
  }>;
  activity: Array<{
    hash: string;
    type: string;
    success: boolean;
    timestamp: string;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address } = await req.json();

    if (!address) {
      return new Response(
        JSON.stringify({ error: 'Missing address' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Fetching live data for address: ${address}`);

    // Fetch account resources (most reliable for live balance data)
    console.log('Fetching account resources from Fullnode API...');
    const resourcesResp = await fetch(
      `https://api.mainnet.aptoslabs.com/v1/accounts/${address}/resources`,
      { headers: { 'Accept': 'application/json' } }
    );

    console.log('Resources API response status:', resourcesResp.status);

    if (!resourcesResp.ok) {
      const errorText = await resourcesResp.text();
      console.error('Resources API error:', resourcesResp.status, errorText);
      throw new Error(`Failed to fetch account resources: ${errorText}`);
    }

    const resources = await resourcesResp.json();
    console.log('Resources fetched:', resources.length);
    
    // Log all resource types for debugging
    console.log('Resource types found:');
    resources.forEach((r: any, idx: number) => {
      if (idx < 25) { // Log first 25 to avoid too much output
        console.log(`  [${idx}] ${r.type}`);
      }
    });

    // Helper to format big integer string using decimals
    const formatUnits = (value: string, decimals: number): string => {
      const v = (value || '0').replace(/\D/g, '');
      const d = Number.isFinite(decimals) ? Math.max(0, Math.min(18, decimals)) : 8;
      if (!v) return '0';
      if (d === 0) return v;
      if (v.length <= d) return `0.${v.padStart(d, '0')}`.replace(/0+$/, '').replace(/\.$/, '');
      const i = v.length - d;
      const out = `${v.slice(0, i)}.${v.slice(i)}`;
      return out.replace(/0+$/, '').replace(/\.$/, '');
    };

    // Parse tokens and APT balance from resources
    let aptBalance = '0';
    const tokens: Array<{ name: string; symbol: string; balance: string }> = [];

    console.log('Parsing resources for coin data...');
    for (const resource of resources) {
      if (typeof resource?.type === 'string') {
        // Log all CoinStore resources we find
        if (resource.type.includes('CoinStore')) {
          console.log('Found CoinStore:', resource.type);
          console.log('  Raw value:', resource.data?.coin?.value);
        }

        if (resource.type.includes('::coin::CoinStore<')) {
          // Extract coin type from the full type string
          const match = resource.type.match(/::coin::CoinStore<(.+)>$/);
          if (match) {
            const coinType = match[1];
            const raw = resource.data?.coin?.value || '0';
            
            console.log('Processing coin type:', coinType, 'raw value:', raw);
            
            if (raw !== '0') {
              const balance = formatUnits(String(raw), 8);
              
              if (coinType.includes('aptos_coin::AptosCoin') || coinType.includes('0x1::aptos_coin::AptosCoin')) {
                aptBalance = balance;
                console.log('✓ APT balance set to:', aptBalance);
              } else {
                const symbol = coinType.split('::').pop() || 'Unknown';
                const name = symbol;
                tokens.push({ name, symbol, balance });
                console.log('✓ Token added:', symbol, 'balance:', balance);
              }
            }
          }
        }
      }
    }

    console.log('Final APT balance:', aptBalance);
    console.log('Total tokens found:', tokens.length);

    // Sort tokens by numeric balance desc and get top 5
    tokens.sort((a, b) => Number(b.balance) - Number(a.balance));
    const topTokens = tokens.slice(0, 5);

    // Fetch recent transactions
    console.log('Fetching transactions from Indexer...');
    const txResponse = await fetch(
      `https://indexer.mainnet.aptoslabs.com/v1/accounts/${address}/transactions?limit=5`,
      { headers: { 'Accept': 'application/json' } }
    );

    console.log('Transactions API response status:', txResponse.status);

    let activity: Array<{ hash: string; type: string; success: boolean; timestamp: string }> = [];

    if (txResponse.ok) {
      const transactions = await txResponse.json();
      console.log('Transactions fetched:', transactions.length);
      
      activity = transactions.map((tx: any) => ({
        hash: tx.hash || "unknown",
        type: tx.type || "unknown",
        success: tx.success !== false,
        timestamp: tx.timestamp || new Date().toISOString()
      }));
    } else {
      console.warn('Transactions API warning:', txResponse.status);
    }

    console.log('Returning response with:', {
      aptBalance,
      tokensCount: topTokens.length,
      activityCount: activity.length
    });

    const response: AptosResponse = {
      account: {
        address,
        aptBalance
      },
      tokens: topTokens,
      activity
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Fetch failed:', error.message);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch account data', details: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
