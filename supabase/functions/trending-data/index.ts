import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrendingRequest {
  network?: 'mainnet' | 'testnet';
  type: 'wallets' | 'collections';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { network = 'mainnet', type }: TrendingRequest = await req.json();
    
    const graphqlEndpoint = network === 'mainnet' 
      ? 'https://api.mainnet.aptoslabs.com/v1/graphql'
      : 'https://api.testnet.aptoslabs.com/v1/graphql';

    console.log(`Fetching trending ${type} for ${network}`);

    if (type === 'collections') {
      // Query for top NFT collections
      const query = `
        query TrendingCollections {
          current_token_datas_v2(
            limit: 10
            order_by: {last_transaction_version: desc}
            where: {
              is_fungible_v2: {_eq: false}
              current_collection: {
                current_supply: {_gt: "100"}
              }
            }
            distinct_on: collection_id
          ) {
            collection_id
            token_name
            current_collection {
              collection_name
              creator_address
              current_supply
              max_supply
              uri
              description
            }
          }
        }
      `;

      const response = await fetch(graphqlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('GraphQL error:', errorText);
        throw new Error(`GraphQL request failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Collections data fetched:', data.data?.current_token_datas_v2?.length);

      // Transform to match expected format
      const collections = (data.data?.current_token_datas_v2 || []).map((item: any) => ({
        collection_name: item.current_collection?.collection_name || 'Unknown',
        creator_address: item.current_collection?.creator_address || '',
        current_supply: parseInt(item.current_collection?.current_supply || '0'),
        max_supply: item.current_collection?.max_supply || '0',
        total_minted_v2: parseInt(item.current_collection?.current_supply || '0')
      }));

      return new Response(
        JSON.stringify({
          collections: collections,
          source: 'aptos_indexer'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (type === 'wallets') {
      // Query for top wallets by coin balance
      const query = `
        query TrendingWallets {
          current_fungible_asset_balances(
            limit: 10
            order_by: {amount: desc}
            where: {
              asset_type: {_eq: "0x1::aptos_coin::AptosCoin"}
              amount: {_gt: "100000000"}
            }
          ) {
            owner_address
            amount
            asset_type
          }
        }
      `;

      const response = await fetch(graphqlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Wallets data fetched:', data.data?.current_fungible_asset_balances?.length);

      // Get additional stats for each wallet
      const wallets = data.data?.current_fungible_asset_balances || [];
      const enrichedWallets = await Promise.all(
        wallets.slice(0, 4).map(async (wallet: any) => {
          // Query for NFT count
          const nftQuery = `
            query WalletNFTs($owner: String!) {
              current_token_ownerships_v2_aggregate(
                where: {
                  owner_address: {_eq: $owner}
                  amount: {_gt: "0"}
                  is_soulbound_v2: {_eq: false}
                }
              ) {
                aggregate {
                  count
                }
              }
            }
          `;

          try {
            const nftResponse = await fetch(graphqlEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: nftQuery,
                variables: { owner: wallet.owner_address }
              }),
            });

            const nftData = await nftResponse.json();
            const nftCount = nftData.data?.current_token_ownerships_v2_aggregate?.aggregate?.count || 0;

            return {
              address: wallet.owner_address,
              aptBalance: wallet.amount,
              nftCount: nftCount
            };
          } catch (error) {
            console.error(`Error fetching NFT count for ${wallet.owner_address}:`, error);
            return {
              address: wallet.owner_address,
              aptBalance: wallet.amount,
              nftCount: 0
            };
          }
        })
      );

      return new Response(
        JSON.stringify({
          wallets: enrichedWallets,
          source: 'aptos_indexer'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid type parameter' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in trending-data function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: 'Failed to fetch trending data from Aptos Indexer'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
