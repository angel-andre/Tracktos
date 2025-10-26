import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AptosResponse {
  account: {
    address: string;
    aptBalance: string;
    stakedApt: string;
  };
  tokens: Array<{
    name: string;
    symbol: string;
    balance: string;
  }>;
  nfts: Array<{
    name: string;
    collection: string;
    image: string;
  }>;
  activity: Array<{
    hash: string;
    type: string;
    success: boolean;
    timestamp: string;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address, network = 'mainnet' } = await req.json();

    if (!address) {
      return new Response(
        JSON.stringify({ error: 'Missing address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching data for ${address} on ${network}`);

    const graphqlUrl = network === 'testnet' 
      ? 'https://indexer-testnet.staging.gcp.aptosdev.com/v1/graphql'
      : 'https://api.mainnet.aptoslabs.com/v1/graphql';

    // Updated GraphQL query using current (non-deprecated) schema only, with CDN image URIs for NFTs
    const graphqlQuery = `
      query GetAccountData($address: String!) {
        current_fungible_asset_balances(where: {owner_address: {_eq: $address}}) {
          amount
          asset_type
          metadata {
            name
            symbol
            decimals
          }
        }
        current_token_ownerships_v2(where: {owner_address: {_eq: $address}, amount: {_gt: "0"}}, limit: 10) {
          token_data_id
          amount
          current_token_data {
            token_name
            collection_id
            largest_property_version_v1
            token_uri
            cdn_asset_uris {
              cdn_image_uri
              raw_image_uri
              cdn_json_uri
            }
            current_collection {
              collection_name
            }
          }
        }
        delegated_staking_activities(
          where: {delegator_address: {_eq: $address}}
          order_by: {transaction_version: desc}
          limit: 1
        ) {
          amount
        }
      }
    `;

    console.log('Calling Aptos Indexer GraphQL...');
    const graphqlResp = await fetch(graphqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: graphqlQuery,
        variables: { address }
      })
    });

    if (!graphqlResp.ok) {
      const errorText = await graphqlResp.text();
      console.error('GraphQL error:', graphqlResp.status, errorText);
      throw new Error('Failed to fetch from Aptos Indexer');
    }

    const graphqlData = await graphqlResp.json();
    console.log('GraphQL response received');

    if (graphqlData.errors) {
      console.error('GraphQL errors:', graphqlData.errors);
      throw new Error('GraphQL query failed');
    }

    const data = graphqlData.data;

    // Helper to format balance
    const formatUnits = (value: unknown, decimals: number): string => {
      const raw = value ?? '0';
      const v = String(raw).replace(/\D/g, '');
      const d = Number.isFinite(decimals) ? Math.max(0, Math.min(18, decimals)) : 8;
      if (!v) return '0';
      if (d === 0) return v;
      if (v.length <= d) return `0.${v.padStart(d, '0')}`.replace(/0+$/, '').replace(/\.$/, '');
      const i = v.length - d;
      const out = `${v.slice(0, i)}.${v.slice(i)}`;
      return out.replace(/0+$/, '').replace(/\.$/, '');
    };

    // Parse fungible asset balances (includes APT)
    let aptRaw = 0n;
    let aptBalance = '0';
    const tokens: Array<{ name: string; symbol: string; balance: string }> = [];

    if (data.current_fungible_asset_balances) {
      for (const fa of data.current_fungible_asset_balances) {
        const amount = fa.amount ?? '0';
        const rawDigits = String(amount).replace(/\D/g, '');
        const raw = rawDigits ? BigInt(rawDigits) : 0n;
        if (raw > 0n) {
          const metadata = fa.metadata || {};
          const symbol = metadata.symbol || 'FA';
          const name = metadata.name || symbol;
          const decimals = Number(metadata.decimals ?? 8);
          const balance = formatUnits(String(raw), decimals);
          const assetType = fa.asset_type || '';

          const isAPT = assetType.includes('0x1::aptos_coin::AptosCoin') || symbol === 'APT' || (name?.toLowerCase?.().includes('aptos') && name.toLowerCase().includes('coin'));

          if (isAPT) {
            aptRaw += raw;
          } else {
            tokens.push({ name, symbol, balance });
            console.log('✓ FA:', symbol, balance);
          }
        }
      }
    }

    // Finalize APT liquid balance
    aptBalance = formatUnits(String(aptRaw), 8);
    console.log('✓ APT balance (aggregated FA):', aptBalance);

    // Parse staked APT
    let stakedApt = '0';
    if (data.delegated_staking_activities && data.delegated_staking_activities.length > 0) {
      const latestStake = data.delegated_staking_activities[0];
      if (latestStake.amount) {
        stakedApt = formatUnits(latestStake.amount, 8);
        console.log('✓ Staked APT:', stakedApt);
      }
    }

    // Parse NFTs with CDN and metadata fallback
    const nfts: Array<{ name: string; collection: string; image: string }> = [];

    const looksLikeImageUrl = (u: string) => /\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(u);
    const resolveIpfs = (u: string) => {
      if (!u) return u;
      if (u.startsWith('ipfs://ipfs/')) return `https://ipfs.io/${u.slice('ipfs://'.length)}`;
      if (u.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${u.slice('ipfs://'.length)}`;
      return u;
    };

    let metadataFetches = 0;

    if (data.current_token_ownerships_v2) {
      for (const nft of data.current_token_ownerships_v2) {
        const tokenData = nft.current_token_data;
        if (tokenData) {
          const name = tokenData.token_name || 'Unknown NFT';
          const collection = tokenData.current_collection?.collection_name || 'Unknown Collection';
          const cdn = (tokenData.cdn_asset_uris && tokenData.cdn_asset_uris[0]) || null;
          let image = cdn?.cdn_image_uri || cdn?.raw_image_uri || tokenData.token_uri || '';

          // Prefer JSON from CDN if available
          const metadataUrl = cdn?.cdn_json_uri || tokenData.token_uri || '';

          // Fallback: fetch metadata JSON and extract image
          if (metadataUrl && !looksLikeImageUrl(image) && metadataFetches < 10) {
            try {
              const metaResp = await fetch(resolveIpfs(metadataUrl));
              if (metaResp.ok) {
                const meta = await metaResp.json();
                const candidate = resolveIpfs(meta?.image || meta?.image_url || meta?.metadata?.image || '');
                if (candidate) image = candidate;
              }
              metadataFetches++;
            } catch (_) {
              // ignore
            }
          }

          image = resolveIpfs(image);

          nfts.push({ name, collection, image });
          console.log('✓ NFT:', name, 'img:', image?.slice(0, 100));
        }
      }
    }

    // Sort tokens by balance
    tokens.sort((a, b) => Number(b.balance) - Number(a.balance));
    const topTokens = tokens.slice(0, 10);

    // Fetch transactions
    console.log('Fetching transactions...');
    const txUrl = network === 'testnet'
      ? `https://indexer-testnet.staging.gcp.aptosdev.com/v1/accounts/${address}/transactions?limit=5`
      : `https://api.mainnet.aptoslabs.com/v1/accounts/${address}/transactions?limit=5`;
    
    const txResp = await fetch(txUrl, { headers: { 'Accept': 'application/json' } });
    
    let activity: Array<{ hash: string; type: string; success: boolean; timestamp: string }> = [];
    if (txResp.ok) {
      const transactions = await txResp.json();
      activity = transactions.map((tx: any) => ({
        hash: tx.hash || 'unknown',
        type: tx.type || 'unknown',
        success: tx.success !== false,
        timestamp: tx.timestamp || new Date().toISOString()
      }));
      console.log('✓ Transactions:', activity.length);
    }

    const response: AptosResponse = {
      account: {
        address,
        aptBalance,
        stakedApt
      },
      tokens: topTokens,
      nfts: nfts.slice(0, 10),
      activity
    };

    console.log('Returning:', {
      apt: aptBalance,
      staked: stakedApt,
      tokens: topTokens.length,
      nfts: nfts.length,
      txs: activity.length
    });

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error.message);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch account data', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
