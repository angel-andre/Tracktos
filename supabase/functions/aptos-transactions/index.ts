import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APTOS_REST_URL = "https://api.mainnet.aptoslabs.com/v1";

function inferType(entryFunction: string): string {
  const fn = entryFunction.toLowerCase();
  if (fn.includes("swap")) return "Swap";
  if (fn.includes("stake") || fn.includes("staking")) return "Stake";
  if (fn.includes("mint") || fn.includes("nft")) return "NFT";
  if (fn.includes("transfer")) return "Transfer";
  return "Contract";
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 10 } = await req.json();

    console.log(`Fetching ${limit} recent transactions from Aptos REST...`);

    const url = `${APTOS_REST_URL}/transactions?limit=${encodeURIComponent(String(limit))}`;
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "lovable-app-aptos-transactions",
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Aptos API error: ${response.status} ${text.slice(0, 200)}`);
    }

    const raw = await response.json();
    const list: any[] = Array.isArray(raw) ? raw : [];

    const userTxs = list.filter((t) => t?.type === "user_transaction");

    const transactions = userTxs.slice(0, limit).map((t: any) => {
      const entryFn: string =
        (t?.payload?.type === "entry_function_payload" ? t?.payload?.function : "") || "";

      const timestampMicros = Number(t?.timestamp);
      const timestamp = Number.isFinite(timestampMicros)
        ? Math.floor(timestampMicros / 1000)
        : Date.now();

      return {
        hash: t?.hash || `0x${String(t?.version ?? "")}`,
        type: inferType(entryFn),
        sender: t?.sender || "",
        receiver: "", // Receiver requires event parsing; kept empty for now
        amount: 0, // Amount requires event parsing; kept 0 for now
        timestamp,
      };
    });

    console.log(`Successfully fetched ${transactions.length} transactions`);

    return new Response(JSON.stringify({ transactions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching transactions:", errorMessage);

    return new Response(JSON.stringify({ error: errorMessage, transactions: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
