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
      // Query for top NFT collections by volume and activity
      const query = `
        query TrendingCollections {
          current_collections_v2(
            limit: 10
            order_by: [
              {last_transaction_version: desc}
            ]
            where: {
              max_supply: {_gt: "100"}
            }
          ) {
            collection_id
            collection_name
            creator_address
            current_supply
            max_supply
            total_minted_v2
            uri
            description
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
      console.log('Collections data fetched:', data.data?.current_collections_v2?.length);

      return new Response(
        JSON.stringify({
          collections: data.data?.current_collections_v2 || [],
          source: 'aptos_indexer'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (type === 'wallets') {
      // Query for top wallets by coin balance and activity
      const query = `
        query TrendingWallets {
          current_coin_balances(
            limit: 10
            order_by: {amount: desc}
            where: {
              coin_type: {_eq: "0x1::aptos_coin::AptosCoin"}
              amount: {_gt: "100000000"}
            }
          ) {
            owner_address
            amount
            coin_type
            last_transaction_version
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
      console.log('Wallets data fetched:', data.data?.current_coin_balances?.length);

      // Get additional stats for each wallet
      const wallets = data.data?.current_coin_balances || [];
      const enrichedWallets = await Promise.all(
        wallets.slice(0, 4).map(async (wallet: any) => {
          // Query for NFT count
          const nftQuery = `
            query WalletNFTs($owner: String!) {
              current_token_ownerships_v2_aggregate(
                where: {
                  owner_address: {_eq: $owner}
                  amount: {_gt: "0"}
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
              nftCount: nftCount,
              lastActivity: wallet.last_transaction_version
            };
          } catch (error) {
            console.error(`Error fetching NFT count for ${wallet.owner_address}:`, error);
            return {
              address: wallet.owner_address,
              aptBalance: wallet.amount,
              nftCount: 0,
              lastActivity: wallet.last_transaction_version
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
