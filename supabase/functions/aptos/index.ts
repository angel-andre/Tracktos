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
    tokenDataId?: string;
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
  sentimentScore: number;
  sentimentReasons: string[];
  walletIdentity: {
    activeDays: number;
    totalGasSpent: string;
    badges: Array<{
      name: string;
      description: string;
      icon: string;
    }>;
  };
  transactionAnalytics?: {
    activityHeatmap: { date: string; count: number }[];
    typeBreakdown: { type: string; count: number; percentage: number }[];
    gasOverTime: { date: string; gas: string }[];
    topContracts: { address: string; name: string; count: number; type: string }[];
  };
  defiActivity?: {
    swapHistory: { timestamp: string; protocol: string; fromToken: string; toToken: string; fromAmount: string; toAmount: string; volumeUsd: number }[];
    protocolVolumes: { protocol: string; type: string; volumeUsd: number; txCount: number }[];
    stakingActivities: { protocol: string; action: string; amount: string; timestamp: string }[];
    totalDefiVolumeUsd: number;
    uniqueProtocols: number;
  };
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
        current_token_ownerships_v2(where: {owner_address: {_eq: $address}, amount: {_gt: "0"}}, limit: 50) {
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
        'WBTC': 'wrapped-bitcoin',
        'CELL': 'cellena-finance',
        'WAR': 'war-coin',
        'STKAPT': 'staked-aptos',
        'ZUSDC': 'usd-coin',
        'DAI': 'dai',
        'USDD': 'usdd',
        'BUSD': 'binance-usd',
        'WSOL': 'wrapped-solana',
        'CELO': 'celo',
        'THL': 'thala',
        'MOVE': 'movementlabs',
        'AMAPT': 'amnis-aptos'
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

    // Add APT to the tokens list (combine liquid + staked)
    const aptPrice = priceMap.get('APT') || 0;
    const totalAptBalance = parseFloat(aptBalance) + parseFloat(stakedApt);
    const aptUsdValue = totalAptBalance * aptPrice;
    tokensWithUsd.push({
      name: 'Aptos Coin',
      symbol: 'APT',
      balance: totalAptBalance.toString(),
      usdPrice: aptPrice,
      usdValue: aptUsdValue,
      logoUrl: logoUrls['APT'] || ''
    });

    // Sort tokens by USD value (highest first), fallback to balance
    tokensWithUsd.sort((a, b) => {
      if (b.usdValue !== a.usdValue) return b.usdValue - a.usdValue;
      return Number(b.balance) - Number(a.balance);
    });
    
    // Take top 20 tokens to ensure we don't miss any significant holdings
    const topTokens = tokensWithUsd.slice(0, 20);
    
    // Calculate total USD value from all top tokens (APT now included)
    const totalUsdValue = topTokens.reduce((sum, token) => sum + token.usdValue, 0);
    
    console.log(`✓ Total portfolio USD value: $${totalUsdValue.toFixed(2)}`);

    // Calculate 24h change (using already-fetched historical prices)
    console.log('Calculating 24h portfolio change...');
    
    const totalUsdValue24hAgo = topTokens.reduce((sum, token) => {
      const price24hAgo = historicalPriceMap.get(token.symbol.toUpperCase()) || token.usdPrice; // fallback to current
      const balance = parseFloat(token.balance) || 0;
      return sum + (balance * price24hAgo);
    }, 0);
    
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
    let activeDays = 0;
    let totalGasSpent = '0';
    
    // Fetch ALL transactions for gas calculation (parallel, large batches)
    console.log(`Fetching ALL ${totalTransactionCount} transactions for gas and analytics...`);
    const gasCalcBatchSize = 500;
    const gasCalcBatches = Math.ceil(totalTransactionCount / gasCalcBatchSize);
    
    console.log(`Will fetch ${gasCalcBatches} batches of ${gasCalcBatchSize} transactions each`);
    
    // Fetch in smaller parallel chunks to avoid overwhelming the API
    let allTransactions: any[] = [];
    const parallelChunkSize = 5;
    
    // To ensure we get recent transactions for analytics, fetch from both ends
    // First: fetch recent transactions (from the end)
    const recentBatchCount = Math.min(10, gasCalcBatches); // Last 5000 txs
    const recentStartBatch = Math.max(0, gasCalcBatches - recentBatchCount);
    
    console.log(`Fetching recent transactions from batch ${recentStartBatch} to ${gasCalcBatches}...`);
    for (let chunkStart = recentStartBatch; chunkStart < gasCalcBatches; chunkStart += parallelChunkSize) {
      const chunkEnd = Math.min(chunkStart + parallelChunkSize, gasCalcBatches);
      const chunkPromises = [];
      
      for (let i = chunkStart; i < chunkEnd; i++) {
        const offset = i * gasCalcBatchSize;
        const txUrl = `${fullnodeBase}/accounts/${address}/transactions?start=${offset}&limit=${gasCalcBatchSize}`;
        chunkPromises.push(
          fetch(txUrl, { headers: { 'Accept': 'application/json' } })
            .then(r => {
              if (!r.ok) {
                console.log(`Recent batch ${i} failed with status ${r.status}`);
                return [];
              }
              return r.json();
            })
            .catch(err => {
              console.log(`Recent batch ${i} error:`, err.message);
              return [];
            })
        );
      }
      
      const chunkResults = await Promise.all(chunkPromises);
      const chunkTransactions = chunkResults.flat().filter(tx => tx && typeof tx === 'object');
      allTransactions.push(...chunkTransactions);
      
      console.log(`Fetched recent chunk ${chunkStart}-${chunkEnd}: ${chunkTransactions.length} transactions`);
    }
    
    // Then: fetch older transactions (from the beginning) if we haven't covered them
    if (recentStartBatch > 0) {
      console.log(`Fetching older transactions from batch 0 to ${recentStartBatch}...`);
      for (let chunkStart = 0; chunkStart < recentStartBatch; chunkStart += parallelChunkSize) {
        const chunkEnd = Math.min(chunkStart + parallelChunkSize, recentStartBatch);
        const chunkPromises = [];
        
        for (let i = chunkStart; i < chunkEnd; i++) {
          const offset = i * gasCalcBatchSize;
          const txUrl = `${fullnodeBase}/accounts/${address}/transactions?start=${offset}&limit=${gasCalcBatchSize}`;
          chunkPromises.push(
            fetch(txUrl, { headers: { 'Accept': 'application/json' } })
              .then(r => {
                if (!r.ok) {
                  console.log(`Old batch ${i} failed with status ${r.status}`);
                  return [];
                }
                return r.json();
              })
              .catch(err => {
                console.log(`Old batch ${i} error:`, err.message);
                return [];
              })
          );
        }
        
        const chunkResults = await Promise.all(chunkPromises);
        const chunkTransactions = chunkResults.flat().filter(tx => tx && typeof tx === 'object');
        allTransactions.push(...chunkTransactions);
        
        console.log(`Fetched old chunk ${chunkStart}-${chunkEnd}: ${chunkTransactions.length} transactions`);
      }
    }
    
    console.log(`✓ Fetched ${allTransactions.length} total transactions (${totalTransactionCount} in account)`);
    
    // Calculate total gas spent from ALL transactions (dedup + user txs only)
    const parseBig = (v: any): bigint => {
      try { return BigInt(typeof v === 'string' ? v : String(v)); } catch { return 0n; }
    };

    // Deduplicate by version/hash and keep only user transactions
    const seen = new Set<string>();
    const userTxs: any[] = [];
    for (const tx of allTransactions) {
      const key = String(tx.version ?? tx.hash ?? '');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      if (tx.type === 'user_transaction') userTxs.push(tx);
    }

    let totalGasInOctas = 0n;
    const uniqueDates = new Set<string>();

    for (const tx of userTxs) {
      // Track active days using robust timestamp helper
      const iso = toISOFromTx(tx);
      const date = iso.split('T')[0];
      uniqueDates.add(date);

      // Sum up gas spent (gas_used * gas_unit_price)
      if (tx.gas_used != null && tx.gas_unit_price != null) {
        const gasUsed = parseBig(tx.gas_used);
        const gasPrice = parseBig(tx.gas_unit_price);
        totalGasInOctas += gasUsed * gasPrice;
      }
    }

    activeDays = uniqueDates.size;
    totalGasSpent = formatUnits(String(totalGasInOctas), 8);

    const fetchedPct = ((userTxs.length / Math.max(1, totalTransactionCount)) * 100).toFixed(1);
    if (userTxs.length !== totalTransactionCount) {
      console.log(`! Warning: fetched ${userTxs.length}/${totalTransactionCount} user txs (${fetchedPct}%). Results may be slightly undercounted.`);
    }
    console.log(`✓ Gas calc on ${userTxs.length} unique user txs (${allTransactions.length} raw): ${totalGasSpent} APT. Active days: ${activeDays}`);
    
    // Transaction Analytics: Analyze transaction patterns
    console.log('Computing transaction analytics...');
    
    // Activity Heatmap: Count transactions per day
    const dailyCounts = new Map<string, number>();
    const dailyGas = new Map<string, bigint>();
    const contractCounts = new Map<string, { name: string; count: number; type: string }>();
    const typeCounts = new Map<string, number>();
    
    // DeFi Activity Tracking
    const swapHistory: Array<{ timestamp: string; protocol: string; fromToken: string; toToken: string; fromAmount: string; toAmount: string; volumeUsd: number }> = [];
    const protocolVolumes = new Map<string, { protocol: string; type: string; volumeUsd: number; txCount: number }>();
    const stakingActivities: Array<{ protocol: string; action: string; amount: string; timestamp: string }> = [];
    
    // Known decimals for common tokens (fallback defaults to 8)
    const getDecimals = (sym: string): number => {
      const s = (sym || '').toUpperCase();
      if (s === 'USDC' || s === 'USDT' || s === 'ZUSDC') return 6;
      if (s === 'APT') return 8;
      return 8;
    };
    
    // Symbol aliases for price lookups (wrapped/staked versions map to base tokens)
    const symbolAliases = new Map<string, string>([
      ['ZUSDC', 'USDC'],
      ['ZOUSDC', 'USDC'],
      ['ZUSDT', 'USDT'],
      ['LAPTOS', 'APT'],
      ['STAPT', 'APT'],
      ['STKAPT', 'APT'],
      ['ZAPT', 'APT'],
      ['AMAPT', 'APT'],
      ['WETH', 'ETH'],
      ['WSOL', 'SOL'],
      ['WBTC', 'BTC']
    ]);
    
    // Protocol-specific swap event parsers
    const protocolParsers = {
      // PancakeSwap: Uses standard Withdraw/Deposit events
      pancakeswap: (events: any[]) => {
        let from = '', to = '', fromAmt = '0', toAmt = '0';
        for (const e of events) {
          const type = String(e?.type || '');
          const data = e?.data || {};
          if (type.includes('WithdrawEvent')) {
            const coin = String(data?.coin_type || '');
            const amt = String(data?.amount || '0');
            if (coin && BigInt(amt) > 0n && !from) {
              from = coin.split('::').pop()?.replace(/>/g, '') || '';
              fromAmt = amt;
            }
          }
          if (type.includes('DepositEvent')) {
            const coin = String(data?.coin_type || '');
            const amt = String(data?.amount || '0');
            if (coin && BigInt(amt) > 0n && !to) {
              to = coin.split('::').pop()?.replace(/>/g, '') || '';
              toAmt = amt;
            }
          }
        }
        return { from, to, fromAmt, toAmt };
      },
      
      // LiquidSwap: Check for Swap events and standard coin events
      liquidswap: (events: any[]) => {
        let from = '', to = '', fromAmt = '0', toAmt = '0';
        for (const e of events) {
          const type = String(e?.type || '');
          const data = e?.data || {};
          
          // LiquidSwap-specific swap event
          if (type.includes('SwapEvent') || type.includes('liquidswap')) {
            const x_in = String(data?.x_in || '0');
            const y_in = String(data?.y_in || '0');
            const x_out = String(data?.x_out || '0');
            const y_out = String(data?.y_out || '0');
            
            if (BigInt(x_in) > 0n && BigInt(y_out) > 0n) {
              fromAmt = x_in;
              toAmt = y_out;
            } else if (BigInt(y_in) > 0n && BigInt(x_out) > 0n) {
              fromAmt = y_in;
              toAmt = x_out;
            }
          }
          
          // Standard events as fallback
          if (!from && type.includes('WithdrawEvent')) {
            const coin = String(data?.coin_type || '');
            if (coin) from = coin.split('::').pop()?.replace(/>/g, '') || '';
            if (!fromAmt || fromAmt === '0') fromAmt = String(data?.amount || '0');
          }
          if (!to && type.includes('DepositEvent')) {
            const coin = String(data?.coin_type || '');
            if (coin) to = coin.split('::').pop()?.replace(/>/g, '') || '';
            if (!toAmt || toAmt === '0') toAmt = String(data?.amount || '0');
          }
        }
        return { from, to, fromAmt, toAmt };
      },
      
      // Thala: Similar to LiquidSwap
      thala: (events: any[]) => {
        let from = '', to = '', fromAmt = '0', toAmt = '0';
        for (const e of events) {
          const type = String(e?.type || '');
          const data = e?.data || {};
          
          if (type.includes('SwapEvent')) {
            const amount_in = String(data?.amount_in || data?.amountIn || '0');
            const amount_out = String(data?.amount_out || data?.amountOut || '0');
            if (BigInt(amount_in) > 0n) fromAmt = amount_in;
            if (BigInt(amount_out) > 0n) toAmt = amount_out;
          }
          
          if (!from && type.includes('WithdrawEvent')) {
            const coin = String(data?.coin_type || '');
            if (coin) from = coin.split('::').pop()?.replace(/>/g, '') || '';
            if (!fromAmt || fromAmt === '0') fromAmt = String(data?.amount || '0');
          }
          if (!to && type.includes('DepositEvent')) {
            const coin = String(data?.coin_type || '');
            if (coin) to = coin.split('::').pop()?.replace(/>/g, '') || '';
            if (!toAmt || toAmt === '0') toAmt = String(data?.amount || '0');
          }
        }
        return { from, to, fromAmt, toAmt };
      }
    };
    
    for (const tx of userTxs) {
      const iso = toISOFromTx(tx);
      const date = iso.split('T')[0];
      
      // Heatmap data
      dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
      
      // Gas over time
      if (tx.gas_used != null && tx.gas_unit_price != null) {
        const gasUsed = parseBig(tx.gas_used);
        const gasPrice = parseBig(tx.gas_unit_price);
        const txGas = gasUsed * gasPrice;
        dailyGas.set(date, (dailyGas.get(date) || 0n) + txGas);
      }
      
      // Categorize transaction type
      let txType = 'Other';
      let isDexSwap = false;
      let isStaking = false;
      let capturedSwap = false;
      
      if (tx.payload?.type === 'entry_function_payload' && tx.payload.function) {
        const func = tx.payload.function.toLowerCase();
        const funcParts = tx.payload.function.split('::');
        const contractAddr = funcParts[0] || '';
        const module = funcParts[1] || '';
        const functionName = funcParts[2] || '';
        
        // Enhanced protocol detection
        let contractName = 'Unknown Contract';
        let contractType = 'DeFi';
        
        // DEX Protocol Detection
        if (contractAddr.includes('190d44266241744264b964a37b8f09863167a12d3e70cda39376cfb4e3561e12') ||
            module.includes('scripts') && functionName.includes('swap')) {
          contractName = 'PancakeSwap';
          contractType = 'DEX';
          isDexSwap = true;
        } else if (contractAddr.includes('liquidswap') || module.includes('liquidswap') || module.includes('scripts_v2')) {
          contractName = 'LiquidSwap';
          contractType = 'DEX';
          isDexSwap = true;
        } else if (contractAddr.includes('thala') || module.includes('thala') || module.includes('amm')) {
          contractName = 'Thala';
          contractType = 'DEX';
          isDexSwap = true;
        } else if (contractAddr.includes('aries') || module.includes('aries')) {
          contractName = 'Aries Markets';
          contractType = 'Lending';
        } else if (contractAddr.includes('tortuga') || module.includes('tortuga')) {
          contractName = 'Tortuga';
          contractType = 'Staking';
          isStaking = true;
        } else if (contractAddr.includes('ditto') || module.includes('ditto')) {
          contractName = 'Ditto';
          contractType = 'Staking';
          isStaking = true;
        } else if (contractAddr === '0x1' && module === 'staking_contract') {
          contractName = 'Aptos Staking';
          contractType = 'Staking';
          isStaking = true;
        } else if (module.includes('router') || module.includes('swap')) {
          contractName = module.charAt(0).toUpperCase() + module.slice(1);
          contractType = 'DEX';
          isDexSwap = true;
        } else if (module.includes('stake')) {
          contractName = 'Staking Protocol';
          contractType = 'Staking';
          isStaking = true;
        } else if (module.includes('coin')) {
          contractName = 'Coin Operations';
          contractType = 'Transfer';
        } else if (module.includes('token')) {
          contractName = 'NFT Operations';
          contractType = 'NFT';
        } else {
          contractName = `${module.charAt(0).toUpperCase() + module.slice(1)}`;
        }
        
        // Transaction type classification
        if (func.includes('transfer') || func.includes('send')) {
          txType = 'Transfer';
        } else if (func.includes('swap') || func.includes('trade') || isDexSwap) {
          txType = 'Swap';
        } else if (func.includes('mint')) {
          txType = 'NFT Mint';
        } else if (func.includes('stake') && !func.includes('unstake')) {
          txType = 'Staking';
          isStaking = true;
        } else if (func.includes('unstake') || func.includes('withdraw_stake')) {
          txType = 'Unstaking';
          isStaking = true;
        } else if (func.includes('claim')) {
          txType = 'Claim';
        }
        
        const existing = contractCounts.get(contractAddr) || { name: contractName, count: 0, type: contractType };
        contractCounts.set(contractAddr, { ...existing, count: existing.count + 1 });
        
        // Extract swap data - look for any transaction with token movements
        if (tx.success && (isDexSwap || txType === 'Swap' || contractType === 'DEX')) {
          let fromToken = '';
          let toToken = '';
          let fromAmount = '0';
          let toAmount = '0';
          
          // Try protocol-specific parser first
          const events = tx.events || [];
          let parsed = { from: '', to: '', fromAmt: '0', toAmt: '0' };
          
          if (contractName === 'PancakeSwap' && protocolParsers.pancakeswap) {
            parsed = protocolParsers.pancakeswap(events);
          } else if (contractName === 'LiquidSwap' && protocolParsers.liquidswap) {
            parsed = protocolParsers.liquidswap(events);
          } else if (contractName === 'Thala' && protocolParsers.thala) {
            parsed = protocolParsers.thala(events);
          }
          
          if (parsed.from) fromToken = parsed.from;
          if (parsed.to) toToken = parsed.to;
          if (parsed.fromAmt && BigInt(parsed.fromAmt) > 0n) fromAmount = parsed.fromAmt;
          if (parsed.toAmt && BigInt(parsed.toAmt) > 0n) toAmount = parsed.toAmt;
          
          // Generic fallback: scan all events for Withdraw/Deposit
          if (!fromToken || !toToken || fromAmount === '0' || toAmount === '0') {
            for (const event of events) {
              const eventType = String(event?.type || '');
              const data = event?.data || {};
              
              // Extract coin type from event type or data
              let coinType = String(data?.coin_type || data?.type_info?.type || '');
              if (!coinType && eventType.includes('<') && eventType.includes('>')) {
                coinType = eventType.substring(eventType.indexOf('<') + 1, eventType.lastIndexOf('>'));
              }
              
              if (eventType.includes('WithdrawEvent') || eventType.includes('0x1::coin::WithdrawEvent')) {
                const amount = String(data?.amount || '0');
                if (amount && BigInt(amount) > 0n && !fromToken) {
                  const symbol = (coinType ? coinType.split('::').pop() : '') || '';
                  fromToken = symbol.replace(/>/g, '') || '';
                  fromAmount = amount;
                }
              }
              
              if (eventType.includes('DepositEvent') || eventType.includes('0x1::coin::DepositEvent')) {
                const amount = String(data?.amount || '0');
                if (amount && BigInt(amount) > 0n && !toToken) {
                  const symbol = (coinType ? coinType.split('::').pop() : '') || '';
                  toToken = symbol.replace(/>/g, '') || '';
                  toAmount = amount;
                }
              }
            }
          }
          
          // Final fallback: infer from payload type_arguments
          if ((!fromToken || !toToken) && tx.payload && Array.isArray((tx.payload as any).type_arguments)) {
            const args = ((tx.payload as any).type_arguments as string[]).slice(0, 2);
            const toSymbol = (t: string) => {
              const gen = t && t.includes('<') && t.includes('>') ? t.substring(t.indexOf('<') + 1, t.lastIndexOf('>')) : t;
              return (gen?.split('::').pop() || '').replace(/>/g, '');
            };
            if (!fromToken && args[0]) fromToken = toSymbol(args[0]);
            if (!toToken && args[1]) toToken = toSymbol(args[1]);
          }
          
          // Extract amounts from arguments if still missing
          if ((!fromAmount || fromAmount === '0' || !toAmount || toAmount === '0') && tx.payload && Array.isArray((tx.payload as any).arguments)) {
            const args = ((tx.payload as any).arguments as any[]);
            // Common pattern: first numeric arg is amount_in, second is min_amount_out
            for (const arg of args) {
              const argStr = String(arg);
              if (/^\d+$/.test(argStr) && BigInt(argStr) > 0n) {
                if (fromAmount === '0') fromAmount = argStr;
                else if (toAmount === '0') toAmount = argStr;
              }
            }
          }
          
          // Enhanced volume calculation with symbol aliases
          let volumeUsd = 0;
          if (fromToken && fromAmount && BigInt(fromAmount) > 0n) {
            let lookupSymbol = fromToken.toUpperCase();
            if (symbolAliases.has(lookupSymbol)) {
              lookupSymbol = symbolAliases.get(lookupSymbol)!;
            }
            const price = priceMap.get(lookupSymbol) || 0;
            const decimals = getDecimals(fromToken);
            const amount = Number(formatUnits(fromAmount, decimals));
            volumeUsd = amount * price;
          }
          if (volumeUsd === 0 && toToken && toAmount && BigInt(toAmount) > 0n) {
            let lookupSymbol = toToken.toUpperCase();
            if (symbolAliases.has(lookupSymbol)) {
              lookupSymbol = symbolAliases.get(lookupSymbol)!;
            }
            const price = priceMap.get(lookupSymbol) || 0;
            const decimals = getDecimals(toToken);
            const amount = Number(formatUnits(toAmount, decimals));
            volumeUsd = amount * price;
          }
          
          // Record swap if we have tokens (even if volumeUsd is 0)
          if (fromToken && toToken && fromToken !== toToken) {
            swapHistory.push({
              timestamp: iso,
              protocol: contractName,
              fromToken,
              toToken,
              fromAmount: formatUnits(fromAmount, getDecimals(fromToken)),
              toAmount: formatUnits(toAmount, getDecimals(toToken)),
              volumeUsd
            });
            capturedSwap = true;
          }
          
          // Always count protocol interaction
          const key = `${contractName}::${contractType}`;
          const prevVolume = protocolVolumes.get(key) || { protocol: contractName, type: contractType, volumeUsd: 0, txCount: 0 };
          protocolVolumes.set(key, {
            ...prevVolume,
            volumeUsd: prevVolume.volumeUsd + volumeUsd,
            txCount: prevVolume.txCount + 1
          });
        }
        
        // Track staking/unstaking activities
        if (tx.success && (isStaking || txType === 'Staking' || txType === 'Unstaking')) {
          const events = tx.events || [];
          let amount = '0';
          
          for (const event of events) {
            const eventType = String(event?.type || '');
            const data = event?.data || {};
            
            // Look for stake/unstake amounts in various event types
            if (eventType.includes('StakeEvent') || eventType.includes('UnstakeEvent') ||
                eventType.includes('DepositEvent') || eventType.includes('WithdrawEvent')) {
              const amt = String(data?.amount || data?.coins_amount || '0');
              if (BigInt(amt) > BigInt(amount)) {
                amount = amt;
              }
            }
          }
          
          if (BigInt(amount) > 0n) {
            stakingActivities.push({
              protocol: contractName,
              action: txType === 'Unstaking' ? 'Unstake' : 'Stake',
              amount: formatUnits(amount, 8),
              timestamp: iso
            });
          }
        }
      }
      
      typeCounts.set(txType, (typeCounts.get(txType) || 0) + 1);
    }
    
    // Calculate total DeFi volume and unique protocols
    const protocolVolumesArray = Array.from(protocolVolumes.values());
    const totalDefiVolumeUsd = protocolVolumesArray.reduce((sum, p) => sum + p.volumeUsd, 0);
    const uniqueProtocols = new Set(protocolVolumesArray.map(p => p.protocol)).size;
    
    // Format heatmap data
    const activityHeatmap = Array.from(dailyCounts.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    // Format type breakdown with percentages
    const totalTyped = Array.from(typeCounts.values()).reduce((sum, c) => sum + c, 0);
    const typeBreakdown = Array.from(typeCounts.entries())
      .map(([type, count]) => ({
        type,
        count,
        percentage: Math.round((count / totalTyped) * 100)
      }))
      .sort((a, b) => b.count - a.count);
    
    // Format gas over time
    const gasOverTime = Array.from(dailyGas.entries())
      .map(([date, gas]) => ({ date, gas: formatUnits(String(gas), 8) }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    // Format top contracts
    const topContracts = Array.from(contractCounts.entries())
      .map(([address, data]) => ({ address, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    console.log(`✓ Analytics: ${activityHeatmap.length} active days, ${typeBreakdown.length} tx types, ${topContracts.length} contracts`);
    console.log(`✓ DeFi Activity: ${swapHistory.length} swaps, ${protocolVolumesArray.length} protocols, $${totalDefiVolumeUsd.toFixed(2)} total volume`);
    
    // Fetch sample transactions for detailed analysis (NFT purchases, activity parsing)
    let transactions: any[] = [];
    const analysisBatchSize = 500;
    const maxAnalysisTransactions = Math.min(totalTransactionCount, 2000);
    
    console.log(`Fetching ${maxAnalysisTransactions} transactions for detailed analysis...`);
    
    const analysisNumBatches = Math.ceil(maxAnalysisTransactions / analysisBatchSize);
    const analysisFetchPromises = [];
    
    for (let i = 0; i < analysisNumBatches; i++) {
      const offset = i * analysisBatchSize;
      const txUrl = `${fullnodeBase}/accounts/${address}/transactions?start=${offset}&limit=${analysisBatchSize}`;
      analysisFetchPromises.push(
        fetch(txUrl, { headers: { 'Accept': 'application/json' } })
          .then(r => r.ok ? r.json() : [])
          .catch(() => [])
      );
    }
    
    const analysisResults = await Promise.all(analysisFetchPromises);
    transactions = analysisResults.flat().filter(tx => tx && typeof tx === 'object');
    
    console.log(`✓ Fetched ${transactions.length} transactions for detailed analysis`);
    
    let activity: Array<{ hash: string; type: string; success: boolean; timestamp: string }> = [];
    
    if (transactions.length > 0) {
      
      // Parse transactions for NFT purchases
      for (const tx of transactions) {
        if (!tx.success || tx.type !== 'user_transaction') continue;
        
        const payload = tx.payload;
        const events = tx.events || [];
        const changes = tx.changes || [];
        
        // Look for common NFT marketplace functions and minting functions
        const fnStr: string = payload?.function || '';
        const isNftTransaction = 
          /token|nft|mint|buy|purchase|claim|list|delist|transfer_token|offer|bid/i.test(fnStr) ||
          fnStr.includes('::token::') ||
          fnStr.includes('::nft::') ||
          events.some((e: any) => {
            const et = String(e?.type || '');
            return /token|nft|mint/i.test(et);
          });
        
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
          // Store price even if it's 0 (free mint/airdrop)
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

    // Targeted enrichment: compute purchase prices for the NFTs we currently show (by token_data_id)
    try {
      const ownedTokenIds = nfts
        .map((n) => String(n.tokenDataId || '').toLowerCase())
        .filter((s) => !!s);

      if (ownedTokenIds.length > 0) {
        // 1) Get recent token activities for these token ids where this wallet is the recipient
        const taQuery = `
          query TokenActivities($address: String!, $ids: [String!]) {
            token_activities_v2(
              where: { to_address: { _eq: $address }, token_data_id: { _in: $ids } }
              order_by: { transaction_version: asc }
              limit: 5000
            ) {
              token_data_id
              transaction_version
            }
            fungible_asset_activities(
              where: { owner_address: { _eq: $address } }
              order_by: { transaction_version: desc }
              limit: 3000
            ) {
              transaction_version
              amount
              asset_type
            }
          }
        `;

        const taResp = await fetch(graphqlUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: taQuery, variables: { address, ids: ownedTokenIds } })
        });

        if (taResp.ok) {
          const taData = await taResp.json();
          if (!taData.errors) {
            const acts: Array<{ token_data_id: string; transaction_version: number }> = taData.data?.token_activities_v2 || [];
            const faas: Array<{ transaction_version: number; amount: string; asset_type: string }> = taData.data?.fungible_asset_activities || [];

            // Earliest incoming version per token id (first acquisition)
            const firstVersionByToken = new Map<string, number>();
            for (const a of acts) {
              const id = String(a.token_data_id || '').toLowerCase();
              const v = Number(a.transaction_version ?? -1);
              if (!firstVersionByToken.has(id) || v < (firstVersionByToken.get(id) || Number.POSITIVE_INFINITY)) {
                firstVersionByToken.set(id, v);
              }
            }

            // Build withdraw mapping per version (prefer APT; otherwise take larger amount)
            const withdrawByVersion = new Map<number, { amt: string; asset: string }>();
            const isApt = (asset: string) => asset.includes('0x1::aptos_coin::AptosCoin');
            const isUsdc = (asset: string) => asset.toLowerCase().includes('usdc');
            const isUsdt = (asset: string) => asset.toLowerCase().includes('usdt');

            for (const fa of faas) {
              const v = Number(fa.transaction_version ?? -1);
              const amt = String(fa.amount ?? '0').replace(/\D/g, '') || '0';
              const asset = String(fa.asset_type || '');
              const prev = withdrawByVersion.get(v);
              if (!prev) {
                withdrawByVersion.set(v, { amt, asset });
              } else {
                if (isApt(asset) && !isApt(prev.asset)) {
                  withdrawByVersion.set(v, { amt, asset });
                } else if ((isApt(asset) === isApt(prev.asset)) && BigInt(amt) > BigInt(prev.amt)) {
                  withdrawByVersion.set(v, { amt, asset });
                }
              }
            }

            // Use current APT USD price for conversions
            const aptUsd = priceMap.get('APT') || 0;
            const toApt = (amtRaw: string, asset: string): string => {
              if (isApt(asset)) {
                return formatUnits(amtRaw, 8);
              }
              let decimals = 8;
              let usdPrice = 0;
              if (isUsdc(asset) || isUsdt(asset)) {
                decimals = 6;
                usdPrice = 1;
              } else {
                const parts = asset.split('::');
                const sym = (parts[parts.length - 1] || '').toUpperCase();
                usdPrice = priceMap.get(sym) || 0;
                decimals = 8;
              }
              if (!aptUsd || !usdPrice) return '0';
              const amount = Number(formatUnits(amtRaw, decimals) || '0');
              const usd = amount * usdPrice;
              const apt = usd / aptUsd;
              return String(apt);
            };

            // Map token ids to prices in APT (using first acquisition version)
            let joined = 0;
            let zeroPriced = 0;
            for (const [id, version] of firstVersionByToken.entries()) {
              const wd = withdrawByVersion.get(version);
              if (wd) {
                const priceApt = toApt(wd.amt, wd.asset);
                if (!nftPriceMap.has(id)) {
                  nftPriceMap.set(id, { price: priceApt, hash: String(version) });
                  joined++;
                }
              } else {
                // No payment observed on acquisition tx -> assume free mint/airdrop
                if (!nftPriceMap.has(id)) {
                  nftPriceMap.set(id, { price: '0', hash: String(version) });
                  zeroPriced++;
                }
              }
            }
            console.log('✓ Targeted price enrichment:', joined, 'priced,', zeroPriced, 'assumed free mints, out of', ownedTokenIds.length, 'shown NFTs');
          } else {
            console.log('Token activities query errors:', JSON.stringify(taData.errors).slice(0, 200));
          }
        } else {
          console.log('Token activities HTTP error:', taResp.status);
        }
      }
    } catch (err) {
      console.log('Targeted price enrichment failed:', String(err));
    }

    // Match NFT prices to owned NFTs (by tokenDataId or collection+name fallback)
    const nftsWithPrices = nfts.map(nft => {
      const keyById = String(nft.tokenDataId || '').toLowerCase();
      const keyByNC = `${nft.collection}::${nft.name}`.toLowerCase();
      
      // Try multiple matching strategies
      let priceData = nftPriceMap.get(keyById);
      
      // Try collection::name format
      if (!priceData) {
        priceData = nftPriceMap.get(keyByNC);
      }
      
      // Try just the token data id without case sensitivity
      if (!priceData && nft.tokenDataId) {
        for (const [key, value] of nftPriceMap.entries()) {
          if (key === keyById || key.includes(keyById) || keyById.includes(key)) {
            priceData = value;
            console.log(`✓ Matched NFT by partial token ID: ${nft.name}`);
            break;
          }
        }
      }
      
      // Try matching by name only (last resort)
      if (!priceData) {
        const nftNameLower = nft.name.toLowerCase();
        for (const [key, value] of nftPriceMap.entries()) {
          if (key.includes(nftNameLower)) {
            priceData = value;
            console.log(`✓ Matched NFT by name: ${nft.name}`);
            break;
          }
        }
      }
      
      if (priceData) {
        console.log(`✓ Price found for "${nft.name}": ${priceData.price}`);
      } else {
        console.log(`⚠️ No price found for "${nft.name}" (tokenId: ${keyById})`);
      }
      
      return {
        name: nft.name,
        collection: nft.collection,
        image: nft.image,
        price: priceData?.price,
        purchaseHash: priceData?.hash,
        tokenDataId: nft.tokenDataId,
      };
    });
    
    // Sort NFTs by price (most expensive first) for those with prices
    const sortedNfts = [...nftsWithPrices].sort((a, b) => {
      const priceA = a.price ? parseFloat(a.price) : -1;
      const priceB = b.price ? parseFloat(b.price) : -1;
      return priceB - priceA;
    });

    // ==================== Sentiment Calculation Algorithm ====================
    console.log('Calculating sentiment score...');
    const sentimentReasons: string[] = [];
    let sentimentScore = 50; // Base score

    // Factor 1: Transaction Volume (more nuanced thresholds)
    const txPoints = Math.min(totalTransactionCount / 100, 20); // Max 20 points
    sentimentScore += txPoints;
    if (totalTransactionCount > 1000) {
      sentimentReasons.push('Exceptionally high transaction activity');
    } else if (totalTransactionCount > 500) {
      sentimentReasons.push('Very high transaction activity');
    } else if (totalTransactionCount > 200) {
      sentimentReasons.push('High transaction activity');
    } else if (totalTransactionCount > 50) {
      sentimentReasons.push('Moderate transaction activity');
    } else if (totalTransactionCount > 10) {
      sentimentReasons.push('Low transaction history');
    } else {
      sentimentReasons.push('Very low transaction history');
    }

    // Factor 2: NFT Holdings (more nuanced thresholds)
    const nftPoints = Math.min(totalNftCount / 10, 15); // Max 15 points
    sentimentScore += nftPoints;
    if (totalNftCount > 100) {
      sentimentReasons.push('Exceptional NFT collector');
    } else if (totalNftCount > 50) {
      sentimentReasons.push('Large NFT collection');
    } else if (totalNftCount > 20) {
      sentimentReasons.push('Active NFT collector');
    } else if (totalNftCount > 5) {
      sentimentReasons.push('Moderate NFT holdings');
    } else if (totalNftCount > 0) {
      sentimentReasons.push('Small NFT collection');
    } else {
      sentimentReasons.push('No NFT holdings');
    }

    // Factor 3: Token Diversity (more nuanced thresholds)
    const tokenDiversityPoints = Math.min(topTokens.length * 2, 10); // Max 10 points
    sentimentScore += tokenDiversityPoints;
    if (topTokens.length > 10) {
      sentimentReasons.push('Highly diverse portfolio');
    } else if (topTokens.length > 5) {
      sentimentReasons.push('Well-diversified portfolio');
    } else if (topTokens.length > 2) {
      sentimentReasons.push('Moderately diverse portfolio');
    } else if (topTokens.length > 0) {
      sentimentReasons.push('Limited token diversity');
    } else {
      sentimentReasons.push('No token diversity');
    }

    // Factor 4: Staking Behavior (more nuanced thresholds)
    const stakedAptValue = parseFloat(stakedApt) || 0;
    const stakingPoints = Math.min(stakedAptValue / 10, 15); // Max 15 points
    sentimentScore += stakingPoints;
    if (stakedAptValue > 1000) {
      sentimentReasons.push('Very high staking activity');
    } else if (stakedAptValue > 100) {
      sentimentReasons.push('High staking activity');
    } else if (stakedAptValue > 10) {
      sentimentReasons.push('Moderate staking activity');
    } else if (stakedAptValue > 0) {
      sentimentReasons.push('Low staking activity');
    } else {
      sentimentReasons.push('No staked APT');
    }

    // Factor 5: Portfolio Value (more realistic thresholds)
    const valuePoints = Math.min(totalUsdValue / 100, 10); // Max 10 points
    sentimentScore += valuePoints;
    if (totalUsdValue > 100000) {
      sentimentReasons.push('Exceptional portfolio value');
    } else if (totalUsdValue > 50000) {
      sentimentReasons.push('Very high portfolio value');
    } else if (totalUsdValue > 10000) {
      sentimentReasons.push('High portfolio value');
    } else if (totalUsdValue > 4000) {
      sentimentReasons.push('Moderate-high portfolio value');
    } else if (totalUsdValue > 1000) {
      sentimentReasons.push('Moderate portfolio value');
    } else if (totalUsdValue > 100) {
      sentimentReasons.push('Low portfolio value');
    } else {
      sentimentReasons.push('Very low portfolio value');
    }

    // Cap sentiment score at 100
    sentimentScore = Math.min(Math.round(sentimentScore), 100);
    console.log(`✓ Sentiment score: ${sentimentScore}/100 with ${sentimentReasons.length} reasons`);
    // ==================== End Sentiment Calculation ====================

    // ==================== Calculate Achievement Badges ====================
    const badges: Array<{ name: string; description: string; icon: string }> = [];

    // Early Adopter Badge - based on wallet age (first transaction)
    if (firstTransactionTimestamp) {
      const firstTxDate = new Date(firstTransactionTimestamp);
      const now = new Date();
      const daysSinceFirst = Math.floor((now.getTime() - firstTxDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceFirst > 730) { // 2+ years
        badges.push({
          name: 'Pioneer',
          description: 'Wallet age 2+ years - True Aptos OG',
          icon: 'trophy'
        });
      } else if (daysSinceFirst > 365) { // 1+ year
        badges.push({
          name: 'Early Adopter',
          description: 'Wallet age 1+ year - Been here since the beginning',
          icon: 'star'
        });
      } else if (daysSinceFirst > 180) { // 6+ months
        badges.push({
          name: 'Veteran',
          description: 'Wallet age 6+ months - Seasoned in Aptos',
          icon: 'shield'
        });
      }
    }

    // Active Trader Badge - based on transaction count
    if (totalTransactionCount > 1000) {
      badges.push({
        name: 'Power User',
        description: '1,000+ transactions - Extremely active on Aptos',
        icon: 'zap'
      });
    } else if (totalTransactionCount > 500) {
      badges.push({
        name: 'Active Trader',
        description: '500+ transactions - Very active wallet',
        icon: 'activity'
      });
    } else if (totalTransactionCount > 100) {
      badges.push({
        name: 'Frequent User',
        description: '100+ transactions - Regular Aptos user',
        icon: 'trending-up'
      });
    }

    // NFT Collector Badge - based on NFT holdings
    if (totalNftCount > 100) {
      badges.push({
        name: 'NFT Whale',
        description: '100+ NFTs - Serious collector',
        icon: 'image'
      });
    } else if (totalNftCount > 50) {
      badges.push({
        name: 'NFT Enthusiast',
        description: '50+ NFTs - Passionate collector',
        icon: 'gallery-horizontal'
      });
    } else if (totalNftCount > 20) {
      badges.push({
        name: 'NFT Collector',
        description: '20+ NFTs - Building a collection',
        icon: 'layers'
      });
    }

    // Whale Badge - based on portfolio value
    if (totalUsdValue > 100000) {
      badges.push({
        name: 'Mega Whale',
        description: '$100K+ portfolio - Top tier holder',
        icon: 'crown'
      });
    } else if (totalUsdValue > 50000) {
      badges.push({
        name: 'Whale',
        description: '$50K+ portfolio - Significant holder',
        icon: 'gem'
      });
    } else if (totalUsdValue > 10000) {
      badges.push({
        name: 'Dolphin',
        description: '$10K+ portfolio - Established holder',
        icon: 'wallet'
      });
    }

    // DeFi User Badge - based on token diversity
    if (topTokens.length > 10) {
      badges.push({
        name: 'DeFi Explorer',
        description: '10+ different tokens - Diverse DeFi user',
        icon: 'compass'
      });
    } else if (topTokens.length > 5) {
      badges.push({
        name: 'Token Holder',
        description: '5+ different tokens - Active in DeFi',
        icon: 'coins'
      });
    }

    // Gas Contributor Badge - based on gas spent
    const gasSpent = parseFloat(totalGasSpent || '0');
    if (gasSpent > 100) {
      badges.push({
        name: 'Network Supporter',
        description: '100+ APT in gas - Supporting the network',
        icon: 'heart'
      });
    } else if (gasSpent > 50) {
      badges.push({
        name: 'Gas Contributor',
        description: '50+ APT in gas - Active contributor',
        icon: 'fuel'
      });
    } else if (gasSpent > 10) {
      badges.push({
        name: 'Network User',
        description: '10+ APT in gas - Regular contributor',
        icon: 'flame'
      });
    }

    console.log(`✓ Earned ${badges.length} badges`);
    // ==================== End Badge Calculation ====================

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
      nfts: sortedNfts,
      activity,
      totalNftCount,
      totalTransactionCount,
      totalUsdValue,
      sentimentScore,
      sentimentReasons,
      walletIdentity: {
        activeDays,
        totalGasSpent,
        badges
      },
      transactionAnalytics: {
        activityHeatmap,
        typeBreakdown,
        gasOverTime,
        topContracts
      },
      defiActivity: {
        swapHistory: swapHistory.slice(0, 20), // Limit to most recent 20 swaps
        protocolVolumes: protocolVolumesArray.sort((a, b) => b.volumeUsd - a.volumeUsd),
        stakingActivities: stakingActivities.slice(0, 10), // Limit to most recent 10 staking activities
        totalDefiVolumeUsd,
        uniqueProtocols
      }
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
