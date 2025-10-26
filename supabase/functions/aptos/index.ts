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
    const url = new URL(req.url);
    const address = url.searchParams.get('address');

    if (!address) {
      return new Response(
        JSON.stringify({ error: 'Missing address' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Fetching data for address: ${address}`);

    // Fetch account coins/tokens
    const coinsResponse = await fetch(
      `https://api.mainnet.aptoslabs.com/v1/accounts/${address}/resources`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!coinsResponse.ok) {
      console.error('Coins API error:', coinsResponse.status, await coinsResponse.text());
      throw new Error('Failed to fetch account resources');
    }

    const resources = await coinsResponse.json();
    
    // Extract APT balance
    let aptBalance = "0";
    const coinStoreResource = resources.find((r: any) => 
      r.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
    );
    
    if (coinStoreResource) {
      const rawBalance = coinStoreResource.data?.coin?.value || "0";
      aptBalance = (parseInt(rawBalance) / 100000000).toFixed(2);
    }

    // Extract fungible assets
    const tokens: Array<{ name: string; symbol: string; balance: string }> = [];
    
    resources.forEach((resource: any) => {
      if (resource.type.includes("::coin::CoinStore<")) {
        const match = resource.type.match(/::([^:]+)::([^>]+)>/);
        if (match && !resource.type.includes("aptos_coin::AptosCoin")) {
          const symbol = match[2] || "Unknown";
          const rawBalance = resource.data?.coin?.value || "0";
          const balance = (parseInt(rawBalance) / 100000000).toFixed(4);
          
          tokens.push({
            name: symbol,
            symbol: symbol,
            balance: balance
          });
        }
      }
    });

    // Fetch recent transactions
    const txResponse = await fetch(
      `https://api.mainnet.aptoslabs.com/v1/accounts/${address}/transactions?limit=5`,
      { headers: { 'Accept': 'application/json' } }
    );

    let activity: Array<{ hash: string; type: string; success: boolean; timestamp: string }> = [];

    if (txResponse.ok) {
      const transactions = await txResponse.json();
      
      activity = transactions.map((tx: any) => ({
        hash: tx.hash || "unknown",
        type: tx.type || "unknown",
        success: tx.success !== false,
        timestamp: tx.timestamp || new Date().toISOString()
      }));
    } else {
      console.warn('Transactions API warning:', txResponse.status);
    }

    const response: AptosResponse = {
      account: {
        address,
        aptBalance
      },
      tokens: tokens.slice(0, 5),
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
    console.error('Indexer fetch failed:', error.message);
    return new Response(
      JSON.stringify({ error: 'Indexer fetch failed', details: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
