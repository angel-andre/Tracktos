import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APTOS_REST_URL = "https://api.mainnet.aptoslabs.com/v1";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 10 } = await req.json();
    
    console.log(`Fetching ${limit} recent transactions from Aptos REST API...`);

    // Use the REST API to get recent transactions
    const response = await fetch(`${APTOS_REST_URL}/transactions?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Aptos API error: ${response.status}`, errorText);
      throw new Error(`Aptos API error: ${response.status}`);
    }

    const rawTransactions = await response.json();
    console.log(`Received ${rawTransactions.length} raw transactions`);
    
    // Transform to our transaction format
    const transactions = rawTransactions
      .filter((tx: any) => tx.type === 'user_transaction')
      .map((tx: any) => {
        // Determine transaction type from payload
        let type = "Transaction";
        const functionName = tx.payload?.function || "";
        
        if (functionName.includes("transfer") || functionName.includes("coin")) {
          type = "Transfer";
        } else if (functionName.includes("swap") || functionName.includes("liquidity")) {
          type = "Swap";
        } else if (functionName.includes("stake") || functionName.includes("delegation")) {
          type = "Stake";
        } else if (functionName.includes("mint") || functionName.includes("nft") || functionName.includes("token")) {
          type = "NFT";
        } else if (functionName.includes("::")) {
          type = "Contract";
        }

        // Extract amount if it's a coin transfer
        let amount = 0;
        if (tx.payload?.arguments && tx.payload.arguments.length > 0) {
          const potentialAmount = tx.payload.arguments[tx.payload.arguments.length - 1];
          if (typeof potentialAmount === 'string' && /^\d+$/.test(potentialAmount)) {
            amount = parseFloat(potentialAmount) / 100000000; // Convert from octas to APT
          }
        }

        // Get gas used
        const gasUsed = tx.gas_used ? parseInt(tx.gas_used) : 0;
        const gasUnitPrice = tx.gas_unit_price ? parseInt(tx.gas_unit_price) : 100;
        const gasCost = (gasUsed * gasUnitPrice) / 100000000; // Convert to APT

        return {
          hash: tx.hash,
          version: tx.version,
          type,
          sender: tx.sender,
          success: tx.success,
          timestamp: parseInt(tx.timestamp) / 1000, // Convert microseconds to milliseconds
          gasUsed,
          gasCost,
          amount,
          function: tx.payload?.function || 'unknown',
          sequenceNumber: tx.sequence_number,
        };
      });

    console.log(`Successfully processed ${transactions.length} user transactions`);

    // Also fetch ledger info for network stats
    const ledgerResponse = await fetch(`${APTOS_REST_URL}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    let ledgerInfo = null;
    if (ledgerResponse.ok) {
      ledgerInfo = await ledgerResponse.json();
      console.log(`Ledger version: ${ledgerInfo.ledger_version}, Block height: ${ledgerInfo.block_height}`);
    }

    return new Response(
      JSON.stringify({ 
        transactions,
        ledgerInfo: ledgerInfo ? {
          ledgerVersion: ledgerInfo.ledger_version,
          blockHeight: ledgerInfo.block_height,
          chainId: ledgerInfo.chain_id,
          epoch: ledgerInfo.epoch,
          ledgerTimestamp: ledgerInfo.ledger_timestamp,
        } : null
      }),
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
        transactions: [],
        ledgerInfo: null
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
