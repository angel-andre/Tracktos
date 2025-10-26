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

    console.log(`Fetching data for address: ${address}`);

    // Try Indexer coins endpoint first; fallback to fullnode resources
    console.log('Calling Indexer API for coins...');
    let coins: any[] | null = null;

    try {
      const coinsResp = await fetch(
        `https://indexer.mainnet.aptoslabs.com/v1/accounts/${address}/coins`,
        { headers: { 'Accept': 'application/json' } }
      );
      console.log('Coins API response status:', coinsResp.status);
      if (coinsResp.ok) {
        const json = await coinsResp.json();
        if (Array.isArray(json)) coins = json;
      } else {
        const errText = await coinsResp.text();
        console.warn('Coins API not available, falling back to resources:', coinsResp.status, errText);
      }
    } catch (e) {
      console.warn('Coins API fetch failed, falling back to resources:', (e as Error).message);
    }

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

    // Parse tokens and APT balance
    let aptBalance = '0';
    const tokens: Array<{ name: string; symbol: string; balance: string }> = [];

    if (Array.isArray(coins)) {
      console.log('Parsing coins from Indexer:', coins.length);
      for (const c of coins) {
        const coinType = c.coin_type || c.asset_type || c.token_type || '';
        const info = c.coin_info || c.metadata || {};
        const symbol: string = info.symbol || (coinType.split('::').pop() || 'Unknown');
        const name: string = info.name || symbol;
        const decimals: number = Number(info.decimals ?? 8);
        const raw = c.amount ?? c.balance ?? c.value ?? '0';
        const balance = formatUnits(String(raw), decimals);
        if (coinType.includes('0x1::aptos_coin::AptosCoin') || symbol.toUpperCase() === 'APT') {
          aptBalance = balance;
        } else if (raw && raw !== '0') {
          tokens.push({ name, symbol, balance });
        }
      }
    } else {
      console.log('Fetching resources fallback...');
      const res = await fetch(
        `https://api.mainnet.aptoslabs.com/v1/accounts/${address}/resources`,
        { headers: { 'Accept': 'application/json' } }
      );
      console.log('Resources API response status:', res.status);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Resources API error:', res.status, errorText);
        throw new Error('Failed to fetch account resources');
      }
      const resources = await res.json();
      console.log('Resources fetched:', resources.length);
      for (const resource of resources) {
        if (typeof resource?.type === 'string' && resource.type.startsWith('0x1::coin::CoinStore<')) {
          const coinType = resource.type.slice('0x1::coin::CoinStore<'.length, -1);
          const raw = resource.data?.coin?.value || '0';
          const balance = formatUnits(String(raw), 8);
          if (coinType.includes('0x1::aptos_coin::AptosCoin')) {
            aptBalance = balance;
          } else if (raw !== '0') {
            const symbol = coinType.split('::').pop() || 'Unknown';
            tokens.push({ name: symbol, symbol, balance });
          }
        }
      }
    }

    // Sort tokens by numeric balance desc and get top 5
    tokens.sort((a, b) => Number(b.balance) - Number(a.balance));
    const topTokens = tokens.slice(0, 5);

    // Fetch recent transactions
    console.log('Calling Indexer API for transactions...');
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
      tokensCount: tokens.length,
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
