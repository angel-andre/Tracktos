import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APTOS_INDEXER_URL = "https://api.mainnet.aptoslabs.com/v1/graphql";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 10 } = await req.json();
    
    console.log(`Fetching ${limit} recent transactions from Aptos...`);

    // Query recent transactions from Aptos Indexer
    const query = `
      query GetRecentTransactions($limit: Int!) {
        coin_activities(
          limit: $limit
          order_by: { transaction_version: desc }
          where: { activity_type: { _eq: "0x1::coin::TransferEvent" } }
        ) {
          transaction_version
          transaction_timestamp
          activity_type
          amount
          owner_address
          coin_type
          entry_function_id_str
        }
      }
    `;

    const response = await fetch(APTOS_INDEXER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { limit },
      }),
    });

    if (!response.ok) {
      throw new Error(`Aptos API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.errors) {
      console.error("GraphQL errors:", result.errors);
      throw new Error(result.errors[0]?.message || "GraphQL query failed");
    }

    const activities = result.data?.coin_activities || [];
    
    // Transform to our transaction format
    const transactions = activities.map((activity: any) => {
      const aptAmount = activity.coin_type?.includes("AptosCoin") 
        ? parseFloat(activity.amount) / 100000000 
        : parseFloat(activity.amount);
      
      // Determine transaction type from entry function
      let type = "Transfer";
      const entryFunction = activity.entry_function_id_str || "";
      if (entryFunction.includes("swap")) type = "Swap";
      if (entryFunction.includes("stake")) type = "Stake";
      if (entryFunction.includes("mint") || entryFunction.includes("nft")) type = "NFT";
      
      return {
        hash: `0x${activity.transaction_version}`,
        type,
        sender: activity.owner_address,
        receiver: activity.owner_address, // Simplified - would need full tx data for actual receiver
        amount: aptAmount,
        timestamp: new Date(activity.transaction_timestamp).getTime(),
      };
    });

    console.log(`Successfully fetched ${transactions.length} transactions`);

    return new Response(
      JSON.stringify({ transactions }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching transactions:", errorMessage);
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        transactions: [] 
      }),
      {
        status: 200, // Return 200 to allow fallback to mock data
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
