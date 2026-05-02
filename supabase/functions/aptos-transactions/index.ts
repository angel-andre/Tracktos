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
    const { limit = 100 } = await req.json();
    const safeLimit = Math.min(Math.max(parseInt(String(limit)) || 100, 1), 100);
    
    console.log(`Fetching ${safeLimit} recent transactions from Aptos REST API...`);

    // Use the REST API to get recent transactions
    const response = await fetch(`${APTOS_REST_URL}/transactions?limit=${safeLimit}`, {
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
    
    // Transform to our transaction format with stronger classification.
    const transactions = userTransactions.map((tx: any) => {
      const fn: string = tx.payload?.function || "";
      const fnLower = fn.toLowerCase();
      const moduleAddr: string = fn.split("::")[0] || "";
      const moduleName: string = fn.split("::")[1] || "";
      const fnName: string = fn.split("::")[2] || "";

      // Classify with priority: explicit core modules > keyword heuristics.
      let type = "Contract";
      const isCore =
        moduleAddr === "0x1" ||
        moduleAddr === "0x3" ||
        moduleAddr === "0x4";

      if (
        fnName === "transfer" ||
        fnName === "transfer_coins" ||
        moduleName === "aptos_account" ||
        (moduleName === "coin" && fnName?.startsWith("transfer"))
      ) {
        type = "Transfer";
      } else if (
        moduleName.includes("swap") ||
        moduleName.includes("router") ||
        moduleName.includes("dex") ||
        moduleName.includes("amm") ||
        fnLower.includes("swap") ||
        fnLower.includes("liquidity")
      ) {
        type = "Swap";
      } else if (
        moduleName === "stake" ||
        moduleName === "delegation_pool" ||
        moduleName === "staking_contract" ||
        fnLower.includes("delegation") ||
        (fnLower.includes("stake") && !fnLower.includes("mistake"))
      ) {
        type = "Stake";
      } else if (
        moduleName === "token" ||
        moduleName === "token_v2" ||
        moduleName === "aptos_token" ||
        moduleName === "collection" ||
        fnLower.includes("mint") ||
        fnLower.includes("nft") ||
        (isCore === false && fnLower.includes("token"))
      ) {
        type = "NFT";
      } else if (fn.length > 0) {
        type = "Contract";
      } else {
        type = "Transaction";
      }

      // Amount extraction — first try coin events (most accurate),
      // then fall back to numeric tail argument.
      let amount = 0;
      const events: any[] = Array.isArray(tx.events) ? tx.events : [];
      for (const ev of events) {
        const t: string = ev.type || "";
        // Aptos coin/fungible-asset withdraw events carry the actual amount moved.
        if (
          t.endsWith("::coin::WithdrawEvent") ||
          t.endsWith("::coin::DepositEvent") ||
          t.endsWith("::fungible_asset::Withdraw") ||
          t.endsWith("::fungible_asset::Deposit")
        ) {
          const raw = ev.data?.amount;
          if (typeof raw === "string" && /^\d+$/.test(raw)) {
            const apt = parseFloat(raw) / 1e8;
            if (apt > amount) amount = apt; // largest movement
          }
        }
      }
      if (amount === 0 && tx.payload?.arguments && tx.payload.arguments.length > 0) {
        const potentialAmount =
          tx.payload.arguments[tx.payload.arguments.length - 1];
        if (typeof potentialAmount === "string" && /^\d+$/.test(potentialAmount)) {
          const apt = parseFloat(potentialAmount) / 1e8;
          // Sanity cap — guards against arg that's not really an amount.
          if (apt > 0 && apt < 1e9) amount = apt;
        }
      }

      const gasUsed = tx.gas_used ? parseInt(tx.gas_used) : 0;
      const gasUnitPrice = tx.gas_unit_price ? parseInt(tx.gas_unit_price) : 100;
      const gasCost = (gasUsed * gasUnitPrice) / 1e8;

      const proposer = blockProposerCache.get(tx.version) || null;

      // Heuristic whale flag — > 1,000 APT moved in a single tx.
      const whale = amount >= 1000;

      return {
        hash: tx.hash,
        version: tx.version,
        type,
        sender: tx.sender,
        success: tx.success,
        timestamp: parseInt(tx.timestamp) / 1000,
        gasUsed,
        gasCost,
        amount,
        function: fn || "unknown",
        sequenceNumber: tx.sequence_number,
        proposer,
        whale,
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
