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
    firstTransactionTimestamp?: string;
    lastTransactionTimestamp?: string;
    usdChange24h: number;
    percentChange24h: number;
  };
  tokens: Array<{
    name: string;
    symbol: string;
    balance: string;
    usdPrice: number;
    usdValue: number;
    logoUrl: string;
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
  totalUsdValue: number;
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
        current_token_ownerships_v2(where: {owner_address: {_eq: $address}, amount: {_gt: "0"}}, limit: 100) {
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

    // Helper to fetch USD prices from multiple sources
    const fetchCoinPrices = async (symbols: string[], assetTypes: Record<string, string>): Promise<Map<string, number>> => {
      const priceMap = new Map<string, number>();
      
      // CoinGecko coin IDs for common tokens
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

      // Try CoinGecko first for known tokens
      try {
        const idsToFetch = symbols
          .map(s => coinGeckoIds[s.toUpperCase()])
          .filter(Boolean);

        if (idsToFetch.length > 0) {
          const ids = idsToFetch.join(',');
          const coingeckoUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
          
          console.log('Fetching prices from CoinGecko for:', symbols.join(', '));
          const response = await fetch(coingeckoUrl);
          
          if (response.ok) {
            const data = await response.json();
            console.log('CoinGecko response:', JSON.stringify(data));

            for (const [symbol, coinId] of Object.entries(coinGeckoIds)) {
              if (data[coinId]?.usd) {
                const price = data[coinId].usd;
                priceMap.set(symbol, price);
                console.log(`✓ Price for ${symbol}: $${price}`);
              }
            }
          }
        }
      } catch (error) {
        console.log('CoinGecko error:', error);
      }

      // For tokens not found in CoinGecko, try DexScreener IN PARALLEL
      const missingTokens = symbols.filter(s => !priceMap.has(s.toUpperCase()));
      
      if (missingTokens.length > 0) {
        console.log('Fetching prices from DexScreener (parallel) for missing tokens:', missingTokens.join(', '));
        
        // Fetch all DexScreener prices concurrently
        const dexPromises = missingTokens.map(async (symbol) => {
          const assetType = assetTypes[symbol];
          if (!assetType) return null;

          try {
            const dexUrl = `https://api.dexscreener.com/latest/dex/search?q=${symbol}%20aptos`;
            const response = await fetch(dexUrl);
            
            if (response.ok) {
              const data = await response.json();
              const pairs = data?.pairs || [];
              
              const aptPair = pairs.find((p: any) => 
                p.chainId === 'aptos' && 
                (p.baseToken?.symbol === symbol || p.quoteToken?.symbol === symbol) &&
                p.priceUsd
              );
              
              if (aptPair?.priceUsd) {
                const price = parseFloat(aptPair.priceUsd);
                console.log(`✓ Price for ${symbol} from DexScreener: $${price}`);
                return { symbol: symbol.toUpperCase(), price };
              } else {
                console.log(`⚠️ No price found for ${symbol} on DexScreener`);
              }
            }
          } catch (error) {
            console.log(`Error fetching DexScreener price for ${symbol}:`, error);
          }
          return null;
        });

        const dexResults = await Promise.all(dexPromises);
        dexResults.forEach(result => {
          if (result) {
            priceMap.set(result.symbol, result.price);
          }
        });
      }

      return priceMap;
    };

    // Helper to fetch historical prices (24h ago) - PARALLELIZED
    const fetchHistoricalPrices = async (symbols: string[]): Promise<Map<string, number>> => {
      const priceMap = new Map<string, number>();
      
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

      console.log('Fetching 24h-ago prices (parallel) for:', symbols.join(', '));

      // Fetch all historical prices concurrently
      const historicalPromises = symbols.map(async (symbol) => {
        const sym = symbol.toUpperCase();
        const coinId = coinGeckoIds[sym];

        // 1) Try CoinGecko market_chart
        if (coinId) {
          try {
            const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=1&interval=hourly`;
            const response = await fetch(url);
            if (response.ok) {
              const data: any = await response.json();
              if (Array.isArray(data?.prices) && data.prices.length > 0) {
                const price24hAgo = Number(data.prices[0][1]);
                if (Number.isFinite(price24hAgo) && price24hAgo > 0) {
                  console.log(`✓ CG market_chart 24h-ago ${sym}: $${price24hAgo}`);
                  return { symbol: sym, price: price24hAgo };
                }
              }
            }
          } catch (err) {
            console.log(`CG market_chart error for ${sym}:`, err);
          }

          // 2) Fallback: CoinGecko coins endpoint with 24h percent
          try {
            const url = `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;
            const response = await fetch(url);
            if (response.ok) {
              const data: any = await response.json();
              const current = Number(data?.market_data?.current_price?.usd);
              const pct = Number(data?.market_data?.price_change_percentage_24h);
              if (Number.isFinite(current) && Number.isFinite(pct)) {
                const price24hAgo = current / (1 + pct / 100);
                if (price24hAgo > 0) {
                  console.log(`✓ CG coins back-calc 24h-ago ${sym}: $${price24hAgo}`);
                  return { symbol: sym, price: price24hAgo };
                }
              }
            }
          } catch (err) {
            console.log(`CG coins error for ${sym}:`, err);
          }
        }

        // 3) Fallback: DexScreener priceChange.h24
        try {
          const dexUrl = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(sym + ' aptos')}`;
          const response = await fetch(dexUrl);
          if (response.ok) {
            const data: any = await response.json();
            const pairs: any[] = Array.isArray(data?.pairs) ? data.pairs : [];
            const aptPair = pairs.find((p: any) => p.chainId === 'aptos' && (p.baseToken?.symbol === sym || p.quoteToken?.symbol === sym) && p.priceUsd);
            const priceUsdRaw = aptPair?.priceUsd;
            const h24Raw = aptPair?.priceChange?.h24;
            if (typeof priceUsdRaw === 'number' && isFinite(priceUsdRaw) && typeof h24Raw === 'number' && isFinite(h24Raw)) {
              const price24hAgo = priceUsdRaw / (1 + h24Raw / 100);
              if (price24hAgo > 0) {
                console.log(`✓ Dex back-calc 24h-ago ${sym}: $${price24hAgo}`);
                return { symbol: sym, price: price24hAgo };
              }
            }
          }
        } catch (err) {
          console.log(`DexScreener error for ${sym}:`, err);
        }

        console.log(`⚠️ No 24h-ago price found for ${sym}`);
        return null;
      });

      const results = await Promise.all(historicalPromises);
      results.forEach(result => {
        if (result) {
          priceMap.set(result.symbol, result.price);
        }
      });

      console.log(`Fetched ${priceMap.size}/${symbols.length} 24h-ago prices.`);
      return priceMap;
    };

    // Parse fungible asset balances (includes APT)
    let aptRaw = 0n;
    let aptBalance = '0';
    const tokens: Array<{ name: string; symbol: string; balance: string }> = [];
    const tokenAssetTypes: Record<string, string> = {};

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
            tokenAssetTypes[symbol] = assetType;
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

    // Fetch USD prices for all tokens (current AND historical in parallel)
    console.log('Fetching USD prices (current + historical)...');
    const tokenSymbols = ['APT', ...tokens.map(t => t.symbol)];
    const allAssetTypes = { ...tokenAssetTypes, 'APT': '0x1::aptos_coin::AptosCoin' };
    
    // Run current and historical price fetching concurrently for speed
    const [priceMap, historicalPriceMap] = await Promise.all([
      fetchCoinPrices(tokenSymbols, allAssetTypes),
      fetchHistoricalPrices(tokenSymbols)
    ]);
    
    // Token logo URLs (common Aptos tokens)
    const logoUrls: Record<string, string> = {
      'APT': 'https://raw.githubusercontent.com/aptos-labs/aptos-core/main/ecosystem/typescript/sdk/examples/typescript/public/aptos.png',
      'USDC': 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
      'USDT': 'https://cryptologos.cc/logos/tether-usdt-logo.png',
      'WETH': 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
      'BTC': 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
      'SOL': 'https://cryptologos.cc/logos/solana-sol-logo.png'
    };

    // Enrich tokens with USD data
    const tokensWithUsd = tokens.map(token => {
      const usdPrice = priceMap.get(token.symbol.toUpperCase()) || 0;
      const balance = parseFloat(token.balance) || 0;
      const usdValue = balance * usdPrice;
      const logoUrl = logoUrls[token.symbol.toUpperCase()] || '';

      return {
        name: token.name,
        symbol: token.symbol,
        balance: token.balance,
        usdPrice,
        usdValue,
        logoUrl
      };
    });

    // Sort tokens by USD value (highest first), fallback to balance
    tokensWithUsd.sort((a, b) => {
      if (b.usdValue !== a.usdValue) return b.usdValue - a.usdValue;
      return Number(b.balance) - Number(a.balance);
    });
    
    const topTokens = tokensWithUsd.slice(0, 10);
    
    // Calculate total USD value including APT balance
    const aptPrice = priceMap.get('APT') || 0;
    const aptUsdValue = parseFloat(aptBalance) * aptPrice;
    const tokensUsdValue = topTokens.reduce((sum, token) => sum + token.usdValue, 0);
    const totalUsdValue = aptUsdValue + tokensUsdValue;
    
    console.log(`✓ Total portfolio USD value: $${totalUsdValue.toFixed(2)}`);

    // Calculate 24h change (using already-fetched historical prices)
    console.log('Calculating 24h portfolio change...');
    
    const aptPrice24hAgo = historicalPriceMap.get('APT') || aptPrice; // fallback to current if unavailable
    const aptUsdValue24hAgo = parseFloat(aptBalance) * aptPrice24hAgo;
    
    const tokensUsdValue24hAgo = topTokens.reduce((sum, token) => {
      const price24hAgo = historicalPriceMap.get(token.symbol.toUpperCase()) || token.usdPrice; // fallback to current
      const balance = parseFloat(token.balance) || 0;
      return sum + (balance * price24hAgo);
    }, 0);
    
    const totalUsdValue24hAgo = aptUsdValue24hAgo + tokensUsdValue24hAgo;
    const usdChange24h = totalUsdValue - totalUsdValue24hAgo;
    const percentChange24h = totalUsdValue24hAgo > 0 
      ? (usdChange24h / totalUsdValue24hAgo) * 100 
      : 0;
    
    console.log(`✓ 24h change: $${usdChange24h.toFixed(2)} (${percentChange24h.toFixed(2)}%)`);

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

    // Helper to normalize various timestamp formats to ISO string
    const toISOFromTx = (tx: any): string => {
      const raw: any = tx?.timestamp_us ?? tx?.timestamp ?? tx?.time_microseconds ?? tx?.time ?? null;
      if (typeof raw === 'string' && raw.includes('T')) return raw; // already ISO
      const num = typeof raw === 'string' ? parseInt(raw, 10) : (typeof raw === 'number' ? raw : NaN);
      if (!isNaN(num)) {
        if (num > 1e14) { // microseconds
          return new Date(Math.floor(num / 1000)).toISOString();
        }
        if (num > 1e12) { // milliseconds
          return new Date(num).toISOString();
        }
        if (num > 1e9) { // seconds
          return new Date(num * 1000).toISOString();
        }
      }
      return new Date().toISOString();
    };

    const nftPriceMap = new Map<string, { price: string; hash: string }>();
    let matchedByTokenId = 0;
    let matchedByNameCollection = 0;
    let firstTransactionTimestamp = '';
    let lastTransactionTimestamp = '';
    
    // Fetch more transactions to find NFT purchases (limit increased for better coverage)
    const txUrl = `${fullnodeBase}/accounts/${address}/transactions?limit=300`;
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
            const eventAccount = String(event?.guid?.account_address || '');
            const isWithdraw = /WithdrawEvent/.test(eventType) || eventType.includes('0x1::coin::WithdrawEvent');
            const isFromBuyer = eventAccount.toLowerCase() === address.toLowerCase();
            const isApt = String(data?.coin_type || '').includes('0x1::aptos_coin::AptosCoin') || true;
            if (isWithdraw && isFromBuyer && isApt) {
              const amt = String(data?.amount || '0').replace(/\D/g, '') || '0';
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
        timestamp: toISOFromTx(tx)
      }));
      
      // Compute accurate first/last transaction timestamps via dedicated queries
      try {
        const oldestResp = await fetch(`${fullnodeBase}/accounts/${address}/transactions?start=0&limit=1`, {
          headers: { 'Accept': 'application/json' }
        });
        if (oldestResp.ok) {
          const arr = await oldestResp.json();
          if (Array.isArray(arr) && arr.length > 0) {
            firstTransactionTimestamp = toISOFromTx(arr[0]);
          }
        }
      } catch (_) {
        console.log('Oldest tx fetch failed');
      }

      try {
        if (totalTransactionCount > 0) {
          const startSeq = Math.max(0, totalTransactionCount - 1);
          const latestResp = await fetch(`${fullnodeBase}/accounts/${address}/transactions?start=${startSeq}&limit=1`, {
            headers: { 'Accept': 'application/json' }
          });
          if (latestResp.ok) {
            const arr = await latestResp.json();
            if (Array.isArray(arr) && arr.length > 0) {
              lastTransactionTimestamp = toISOFromTx(arr[0]);
            }
          }
        }
      } catch (_) {
        console.log('Latest tx fetch failed');
      }

      // Fallback to min/max from recent window if dedicated lookups failed
      if ((!firstTransactionTimestamp || !lastTransactionTimestamp) && transactions.length > 0) {
        let minT = Number.POSITIVE_INFINITY;
        let maxT = Number.NEGATIVE_INFINITY;
        for (const tx of transactions) {
          const iso = toISOFromTx(tx);
          const t = Date.parse(iso);
          if (!isNaN(t)) {
            if (t < minT) {
              minT = t;
              firstTransactionTimestamp ||= new Date(t).toISOString();
            }
            if (t > maxT) {
              maxT = t;
              lastTransactionTimestamp ||= new Date(t).toISOString();
            }
          }
        }
      }
      
      console.log('✓ Recent transactions fetched:', activity.length);
      console.log('✓ NFT prices found:', nftPriceMap.size, 'byTokenId:', matchedByTokenId, 'byNameCollection:', matchedByNameCollection);
    }

    // Fallback/enrichment via GraphQL join between token activities and fungible asset withdrawals
    try {
      const priceJoinQuery = `
        query PriceJoins($address: String!) {
          token_activities_v2(
            where: {to_address: {_eq: $address}},
            order_by: {transaction_version: desc},
            limit: 500
          ) {
            transaction_version
            token_data_id
          }
          fungible_asset_activities(
            where: {owner_address: {_eq: $address}},
            order_by: {transaction_version: desc},
            limit: 2000
          ) {
            transaction_version
            amount
            asset_type
            entry_function_id_str
          }
        }
      `;

      const joinResp = await fetch(graphqlUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: priceJoinQuery, variables: { address } })
      });

      if (joinResp.ok) {
        const joinData = await joinResp.json();
        if (!joinData.errors) {
          const toks = joinData.data?.token_activities_v2 || [];
          const faas = joinData.data?.fungible_asset_activities || [];

          // Build map of largest withdraw per version for any asset, preferring APT
          const withdrawByVersion = new Map<number, { amt: string; asset: string }>();
          const isApt = (asset: string) => asset.includes('0x1::aptos_coin::AptosCoin');
          for (const fa of faas) {
            const v = Number(fa.transaction_version ?? -1);
            const amt = String(fa.amount ?? '0').replace(/\D/g, '') || '0';
            const asset = String(fa.asset_type || '');
            const prev = withdrawByVersion.get(v);
            if (!prev) {
              withdrawByVersion.set(v, { amt, asset });
            } else {
              // Prefer APT over non-APT; if same type, keep larger amount
              if (isApt(asset) && !isApt(prev.asset)) {
                withdrawByVersion.set(v, { amt, asset });
              } else if ((isApt(asset) === isApt(prev.asset)) && BigInt(amt) > BigInt(prev.amt)) {
                withdrawByVersion.set(v, { amt, asset });
              }
            }
          }

          let joined = 0;
          for (const ta of toks) {
            const v = Number(ta.transaction_version ?? -1);
            const rec = withdrawByVersion.get(v);
            if (rec && rec.amt !== '0') {
              const asset = rec.asset;
              const lower = asset.toLowerCase();
              let symbol = 'APT';
              let decimals = 8;
              if (!isApt(asset)) {
                if (lower.includes('usdc')) { symbol = 'USDC'; decimals = 6; }
                else if (lower.includes('usdt')) { symbol = 'USDT'; decimals = 6; }
                else {
                  const parts = asset.split('::');
                  symbol = parts[parts.length - 1] || symbol;
                  decimals = 8;
                }
              }
              const priceStr = `${formatUnits(rec.amt, decimals)} ${symbol}`;
              const tokenId = String(ta.token_data_id || '').toLowerCase();
              if (tokenId) {
                if (!nftPriceMap.has(tokenId)) {
                  nftPriceMap.set(tokenId, { price: priceStr, hash: String(v) });
                  joined++;
                }
              }
            }
          }
          console.log('✓ Enriched NFT prices via GraphQL join:', joined, 'total in map:', nftPriceMap.size);
        } else {
          console.log('GraphQL join errors:', JSON.stringify(joinData.errors).slice(0, 200));
        }
      } else {
        console.log('GraphQL join HTTP error:', joinResp.status);
      }
    } catch (err) {
      console.log('GraphQL price join failed:', String(err));
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
        stakedApt,
        firstTransactionTimestamp: firstTransactionTimestamp || undefined,
        lastTransactionTimestamp: lastTransactionTimestamp || undefined,
        usdChange24h,
        percentChange24h
      },
      tokens: topTokens,
      nfts: sortedNfts.slice(0, 10),
      activity,
      totalNftCount,
      totalTransactionCount,
      totalUsdValue
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
