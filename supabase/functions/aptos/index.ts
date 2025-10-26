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
    let stakedApt = '0';
    const tokens: Array<{ name: string; symbol: string; balance: string }> = [];

    console.log('Parsing resources for coin data...');
    for (const resource of resources) {
      if (typeof resource?.type === 'string') {
        
        // Check for liquid APT in CoinStore
        if (resource.type.includes('::coin::CoinStore<')) {
          const match = resource.type.match(/::coin::CoinStore<(.+)>$/);
          if (match) {
            const coinType = match[1];
            const raw = resource.data?.coin?.value || '0';
            
            if (raw !== '0') {
              const balance = formatUnits(String(raw), 8);
              
              if (coinType.includes('aptos_coin::AptosCoin') || coinType.includes('0x1::aptos_coin::AptosCoin')) {
                aptBalance = balance;
                console.log('✓ Liquid APT found:', aptBalance);
              } else {
                const symbol = coinType.split('::').pop() || 'Unknown';
                const name = symbol;
                tokens.push({ name, symbol, balance });
                console.log('✓ Coin token:', symbol, 'balance:', balance);
              }
            }
          }
        }

        // Check for staked APT
        if (resource.type === '0x1::stake::StakePool') {
          const active = resource.data?.active?.value || '0';
          const pending_active = resource.data?.pending_active?.value || '0';
          const pending_inactive = resource.data?.pending_inactive?.value || '0';
          
          const totalStaked = (BigInt(active) + BigInt(pending_active) + BigInt(pending_inactive)).toString();
          if (totalStaked !== '0') {
            stakedApt = formatUnits(totalStaked, 8);
            console.log('✓ Staked APT found:', stakedApt);
          }
        }

        // Check for delegation
        if (resource.type === '0x1::delegation_pool::DelegationPool' || 
            resource.type.includes('::delegation_pool::')) {
          const delegated = resource.data?.active_shares?.value || '0';
          if (delegated !== '0') {
            const delegatedFormatted = formatUnits(String(delegated), 8);
            stakedApt = stakedApt === '0' ? delegatedFormatted : 
              formatUnits((BigInt(stakedApt.replace('.', '')) + BigInt(delegated)).toString(), 8);
            console.log('✓ Delegated APT found:', delegatedFormatted);
          }
        }

        // Check for Fungible Asset balances (FA standard)
        if (resource.type === '0x1::fungible_asset::FungibleStore' || 
            resource.type.includes('::fungible_asset::FungibleStore')) {
          const balance_raw = resource.data?.balance || '0';
          const metadata_addr = resource.data?.metadata?.inner || resource.data?.metadata;
          
          if (balance_raw !== '0' && metadata_addr) {
            // Try to get metadata for this FA
            const symbol = metadata_addr.toString().slice(0, 10) + '...';
            const balance = formatUnits(String(balance_raw), 8);
            tokens.push({ 
              name: `FA-${symbol}`, 
              symbol: `FA-${symbol}`, 
              balance 
            });
            console.log('✓ FA token found:', symbol, 'balance:', balance);
          }
        }

        // Check for primary fungible store
        if (resource.type.includes('::primary_fungible_store::PrimaryStore')) {
          const balance_raw = resource.data?.balance || '0';
          if (balance_raw !== '0') {
            const balance = formatUnits(String(balance_raw), 8);
            const assetMatch = resource.type.match(/PrimaryStore<(.+)>$/);
            const assetType = assetMatch ? assetMatch[1].split('::').pop() : 'Unknown';
            tokens.push({ 
              name: assetType, 
              symbol: assetType, 
              balance 
            });
            console.log('✓ Primary FA store found:', assetType, 'balance:', balance);
          }
        }
      }
    }

    // Combine liquid + staked APT for total
    const totalApt = stakedApt === '0' ? aptBalance : 
      formatUnits(
        (BigInt((parseFloat(aptBalance) * 100000000).toFixed(0)) + 
         BigInt((parseFloat(stakedApt) * 100000000).toFixed(0))).toString(), 
        8
      );

    console.log('Final APT (liquid):', aptBalance);
    console.log('Final APT (staked):', stakedApt);
    console.log('Final APT (total):', totalApt);
    console.log('Final APT (liquid):', aptBalance);
    console.log('Final APT (staked):', stakedApt);
    console.log('Final APT (total):', totalApt);
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
      aptBalance: totalApt,
      tokensCount: topTokens.length,
      activityCount: activity.length
    });

    const response: AptosResponse = {
      account: {
        address,
        aptBalance: totalApt
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
