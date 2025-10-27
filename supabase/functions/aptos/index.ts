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
    price?: string;
    purchaseHash?: string;
  }>;
  activity: Array<{
    hash: string;
    type: string;
    success: boolean;
    timestamp: string;
  }>;
  totalNftCount: number;
  totalTransactionCount: number;
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
        current_token_ownerships_v2_aggregate(where: {owner_address: {_eq: $address}, amount: {_gt: "0"}}) {
          aggregate {
            count
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

    // Finalize APT liquid balance using Fullnode CoinStore for accuracy
    aptBalance = formatUnits(String(aptRaw), 8); // default fallback from FA aggregation
    try {
      const primaryBase = network === 'testnet'
        ? 'https://fullnode.testnet.aptoslabs.com/v1'
        : 'https://fullnode.mainnet.aptoslabs.com/v1';
      const altBase = network === 'testnet'
        ? 'https://api.testnet.aptoslabs.com/v1'
        : 'https://api.mainnet.aptoslabs.com/v1';

      const coinStorePath = `/accounts/${address}/resource/0x1::coin::CoinStore%3C0x1::aptos_coin::AptosCoin%3E`;

      async function fetchCoinStore(base: string) {
        const resp = await fetch(`${base}${coinStorePath}`, { headers: { 'Accept': 'application/json' } });
        if (!resp.ok) throw new Error(`CoinStore fetch failed ${resp.status}`);
        const js = await resp.json();
        const raw = js?.data?.coin?.value ?? js?.coin?.value ?? '0';
        const digits = String(raw).replace(/\D/g, '');
        return digits ? BigInt(digits) : 0n;
      }

      async function fetchCoinView(base: string) {
        const resp = await fetch(`${base}/view`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            function: '0x1::coin::balance',
            type_arguments: ['0x1::aptos_coin::AptosCoin'],
            arguments: [address]
          })
        });
        if (!resp.ok) throw new Error(`View fetch failed ${resp.status}`);
        const arr = await resp.json();
        const raw = Array.isArray(arr) ? (arr[0] ?? '0') : '0';
        const digits = String(raw).replace(/\D/g, '');
        return digits ? BigInt(digits) : 0n;
      }

      let coinRaw: bigint | null = null;
      try {
        coinRaw = await fetchCoinStore(primaryBase);
        console.log('CoinStore primary ok');
      } catch (e) {
        console.log('CoinStore primary failed, trying alt');
        try {
          coinRaw = await fetchCoinStore(altBase);
          console.log('CoinStore alt ok');
        } catch (_) {
          console.log('CoinStore alt failed, trying view');
          try {
            coinRaw = await fetchCoinView(primaryBase);
            console.log('View primary ok');
          } catch (e2) {
            try {
              coinRaw = await fetchCoinView(altBase);
              console.log('View alt ok');
            } catch (e3) {
              coinRaw = null;
            }
          }
        }
      }

      if (coinRaw !== null && coinRaw >= 0n) {
        aptBalance = formatUnits(String(coinRaw), 8);
        console.log('✓ APT balance (Fullnode):', aptBalance);
      } else {
        console.log('Using FA aggregated fallback APT balance:', aptBalance);
      }
    } catch (e) {
      console.log('Fullnode lookup failed; using FA aggregated fallback APT balance:', aptBalance);
    }

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
    const nfts: Array<{ name: string; collection: string; image: string; tokenDataId?: string }> = [];

    const looksLikeImageUrl = (u: string) => /\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(u);
    const resolveIpfs = (u: string) => {
      if (!u) return u;
      if (u.startsWith('ipfs://ipfs/')) return `https://cloudflare-ipfs.com/${u.slice('ipfs://'.length)}`;
      if (u.startsWith('ipfs://')) return `https://cloudflare-ipfs.com/ipfs/${u.slice('ipfs://'.length)}`;
      return u;
    };

    const normalizeGateway = (u: string) => {
      if (!u) return u;
      try {
        const url = new URL(u);
        const lowerPath = url.pathname.toLowerCase();
        const idx = lowerPath.indexOf('/ipfs/');
        if (idx !== -1) {
          const ipfsPath = url.pathname.slice(idx + '/ipfs/'.length);
          // Use Cloudflare IPFS gateway for better reliability
          return `https://cloudflare-ipfs.com/ipfs/${ipfsPath}`;
        }
      } catch (_) {
        const m = u.match(/ipfs\/(.+)$/i);
        if (m) return `https://cloudflare-ipfs.com/ipfs/${m[1]}`;
      }
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
          image = normalizeGateway(image);
          nfts.push({ 
            name, 
            collection, 
            image,
            tokenDataId: nft.token_data_id 
          });
          console.log('✓ NFT:', name, 'img:', image?.slice(0, 100));
        }
      }
    }

    // Sort tokens by balance
    tokens.sort((a, b) => Number(b.balance) - Number(a.balance));
    const topTokens = tokens.slice(0, 10);

    // Get total NFT count
    const totalNftCount = data.current_token_ownerships_v2_aggregate?.aggregate?.count || 0;

    // Fetch transactions and get total count
    console.log('Fetching transactions...');
    const fullnodeBase = network === 'testnet' 
      ? 'https://fullnode.testnet.aptoslabs.com/v1' 
      : 'https://fullnode.mainnet.aptoslabs.com/v1';
    
    // Get total transaction count
    let totalTransactionCount = 0;
    try {
      const accountResp = await fetch(`${fullnodeBase}/accounts/${address}`, {
        headers: { 'Accept': 'application/json' }
      });
      if (accountResp.ok) {
        const accountData = await accountResp.json();
        totalTransactionCount = parseInt(accountData.sequence_number || '0', 10);
        console.log('✓ Total transactions:', totalTransactionCount);
      }
    } catch (e) {
      console.log('Failed to fetch total transaction count:', e);
    }

    // Parse NFT purchase prices from transaction history
    console.log('Parsing NFT purchase prices...');
    const nftPriceMap = new Map<string, { price: string; hash: string }>();
    let matchedByTokenId = 0;
    let matchedByNameCollection = 0;
    
    // Fetch more transactions to find NFT purchases (limit 100 for performance)
    const txUrl = `${fullnodeBase}/accounts/${address}/transactions?limit=100`;
    const txResp = await fetch(txUrl, { headers: { 'Accept': 'application/json' } });
    
    let activity: Array<{ hash: string; type: string; success: boolean; timestamp: string }> = [];
    if (txResp.ok) {
      const transactions = await txResp.json();
      
      // Parse transactions for NFT purchases
      for (const tx of transactions) {
        if (!tx.success || tx.type !== 'user_transaction') continue;
        
        const payload = tx.payload;
        const events = tx.events || [];
        const changes = tx.changes || [];
        
        // Look for common NFT marketplace functions and minting functions
        const fnStr: string = payload?.function || '';
        const isNftTransaction = /token|nft|mint|buy|purchase/i.test(fnStr);
        
        if (isNftTransaction) {
          let priceInOctas = '0';
          let tokenId: string = '';
          let nameFromChange = '';
          let collectionFromChange = '';
          
          // Extract price from coin withdraw events (buyer paying APT)
          for (const event of events) {
            const eventType = String(event?.type || '');
            const data = event?.data || {};
            const isWithdraw = /WithdrawEvent/.test(eventType) || eventType.includes('0x1::coin::WithdrawEvent');
            const isApt = String(data?.coin_type || '').includes('0x1::aptos_coin::AptosCoin') || true;
            if (isWithdraw && isApt) {
              const amt = String(data?.amount || '0').replace(/\D/g, '') || '0';
              // Keep the largest withdrawal amount in this tx as price
              if (BigInt(amt || '0') > BigInt(priceInOctas || '0')) priceInOctas = amt;
            }
            // Try to get token id from events if provided
            if (!tokenId) {
              const idCandidate = data?.token_id || data?.id?.token_data_id || data?.id || '';
              if (typeof idCandidate === 'string') tokenId = idCandidate;
              else if (idCandidate && typeof idCandidate === 'object') {
                const creator = idCandidate.creator || idCandidate.creator_address || '';
                const coll = idCandidate.collection || idCandidate.collection_name || '';
                const nm = idCandidate.name || idCandidate.token_name || '';
                if (creator && coll && nm) tokenId = `${creator}::${coll}::${nm}`;
              }
            }
          }

          // Scan state changes for token identifier (TokenId)
          if (!tokenId) {
            for (const ch of changes) {
              try {
                const chType = String(ch?.type || '');
                const data = ch?.data || {};
                const keyType = String(data?.key_type || ch?.key_type || '');
                if (chType === 'write_table_item' && /TokenId/.test(keyType)) {
                  let keyVal: any = data?.key ?? ch?.key;
                  if (typeof keyVal === 'string') {
                    try { keyVal = JSON.parse(keyVal); } catch { /* ignore */ }
                  }
                  const creator = keyVal?.creator || keyVal?.creator_address || '';
                  const coll = keyVal?.collection || keyVal?.collection_name || '';
                  const nm = keyVal?.name || keyVal?.token_name || '';
                  if (!tokenId && creator && coll && nm) {
                    tokenId = `${creator}::${coll}::${nm}`;
                    nameFromChange = nm;
                    collectionFromChange = coll;
                  }
                }
              } catch (_) { /* ignore */ }
            }
          }

          // Also check payload arguments for price (many marketplaces pass price as arg)
          if (payload?.arguments && Array.isArray(payload.arguments)) {
            for (const arg of payload.arguments) {
              if (typeof arg === 'string' && /^\d{6,}$/.test(arg)) {
                // large numeric string -> potential octas price
                if (BigInt(arg) > BigInt(priceInOctas || '0')) priceInOctas = arg;
              }
            }
          }
          
          // Convert octas to APT (1 APT = 100000000 octas) and map to identifiers
          if (priceInOctas !== '0') {
            const priceApt = formatUnits(priceInOctas, 8);
            if (tokenId) {
              nftPriceMap.set(String(tokenId).toLowerCase(), { price: priceApt, hash: tx.hash });
              matchedByTokenId++;
            }
            if (nameFromChange && collectionFromChange) {
              const key = `${collectionFromChange}::${nameFromChange}`.toLowerCase();
              if (!nftPriceMap.has(key)) {
                nftPriceMap.set(key, { price: priceApt, hash: tx.hash });
                matchedByNameCollection++;
              }
            }
          }
        }
      }
      
      // Get recent transactions for activity display (only last 5)
      activity = transactions.slice(0, 5).map((tx: any) => ({
        hash: tx.hash || 'unknown',
        type: tx.type || 'unknown',
        success: tx.success !== false,
        timestamp: tx.timestamp || new Date().toISOString()
      }));
      console.log('✓ Recent transactions fetched:', activity.length);
      console.log('✓ NFT prices found:', nftPriceMap.size, 'byTokenId:', matchedByTokenId, 'byNameCollection:', matchedByNameCollection);
    }
    
    // Match NFT prices to owned NFTs (by tokenDataId or collection+name fallback)
    const nftsWithPrices = nfts.map(nft => {
      const keyById = String(nft.tokenDataId || '').toLowerCase();
      const keyByNC = `${nft.collection}::${nft.name}`.toLowerCase();
      const priceData = nftPriceMap.get(keyById) || nftPriceMap.get(keyByNC) || null;
      return {
        name: nft.name,
        collection: nft.collection,
        image: nft.image,
        price: priceData?.price,
        purchaseHash: priceData?.hash
      };
    });
    
    // Sort NFTs by price (most expensive first) for those with prices
    const sortedNfts = [...nftsWithPrices].sort((a, b) => {
      const priceA = a.price ? parseFloat(a.price) : -1;
      const priceB = b.price ? parseFloat(b.price) : -1;
      return priceB - priceA;
    });

    const response: AptosResponse = {
      account: {
        address,
        aptBalance,
        stakedApt
      },
      tokens: topTokens,
      nfts: sortedNfts.slice(0, 10),
      activity,
      totalNftCount,
      totalTransactionCount
    };

    console.log('Returning:', {
      apt: aptBalance,
      staked: stakedApt,
      tokens: topTokens.length,
      nfts: totalNftCount,
      txs: totalTransactionCount
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
