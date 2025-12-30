import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APTOS_REST_URL = "https://api.mainnet.aptoslabs.com/v1";

// Cache for block proposers to avoid redundant API calls
const blockProposerCache = new Map<string, string>();

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
    
    // Get unique block heights from transactions to fetch proposer info
    const versionToBlockMap = new Map<string, string>();
    
    // Fetch block info for transactions to get proposers
    // Group by approximate block (transactions close together are likely in same block)
    const userTransactions = rawTransactions.filter((tx: any) => tx.type === 'user_transaction');
    
    // Fetch block info for a sample of transactions to get proposer data
    const proposerPromises: Promise<void>[] = [];
    const versionsToFetch = new Set<string>();
    
    for (const tx of userTransactions.slice(0, 10)) {
      const version = tx.version;
      if (!blockProposerCache.has(version)) {
        versionsToFetch.add(version);
      }
    }
    
    // Fetch block info for each unique version
    for (const version of versionsToFetch) {
      proposerPromises.push(
        fetch(`${APTOS_REST_URL}/blocks/by_version/${version}`)
          .then(res => res.ok ? res.json() : null)
          .then(blockData => {
            if (blockData) {
              // The block_metadata_transaction contains the proposer
              const blockMetaTx = blockData.transactions?.find(
                (t: any) => t.type === 'block_metadata_transaction'
              );
              if (blockMetaTx?.proposer) {
                // Cache the proposer for all versions in this block
                const firstVersion = blockData.first_version;
                const lastVersion = blockData.last_version;
                for (let v = parseInt(firstVersion); v <= parseInt(lastVersion); v++) {
                  blockProposerCache.set(v.toString(), blockMetaTx.proposer);
                }
              }
            }
          })
          .catch(err => console.error(`Error fetching block for version ${version}:`, err))
      );
    }
    
    await Promise.all(proposerPromises);
    
    // Transform to our transaction format
    const transactions = userTransactions
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

        // Get the block proposer (validator) for this transaction
        const proposer = blockProposerCache.get(tx.version) || null;

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
          proposer, // The validator that proposed the block containing this transaction
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

    // Fetch active validator set for mapping
    let validatorSet = null;
    try {
      const validatorResponse = await fetch(
        `${APTOS_REST_URL}/accounts/0x1/resource/0x1::stake::ValidatorSet`
      );
      if (validatorResponse.ok) {
        validatorSet = await validatorResponse.json();
      }
    } catch (err) {
      console.error('Error fetching validator set:', err);
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
        } : null,
        validatorSet: validatorSet?.data || null,
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
        ledgerInfo: null,
        validatorSet: null,
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
