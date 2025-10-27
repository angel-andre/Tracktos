import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import JourneyCard from "@/components/JourneyCard";
import { Loader2, Sparkles } from "lucide-react";

interface JourneyData {
  address: string;
  totalTransactions: number;
  firstTransactionDate: string;
  nftCount: number;
}

const Index = () => {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [journeyData, setJourneyData] = useState<JourneyData | null>(null);
  const { toast } = useToast();

  const isValidAddress = (addr: string) => {
    return addr.startsWith("0x") && addr.length === 66;
  };

  const fetchAptosData = async () => {
    if (!address.trim()) {
      toast({
        title: "Error",
        description: "Please enter a wallet address",
        variant: "destructive",
      });
      return;
    }

    if (!isValidAddress(address)) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid Aptos address (starts with 0x, 66 characters)",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Fetch account transactions
      const txResponse = await fetch(
        `https://api.mainnet.aptoslabs.com/v1/accounts/${address}/transactions?limit=1000`,
      );

      if (!txResponse.ok) {
        throw new Error("Failed to fetch transaction data");
      }

      const transactions = await txResponse.json();
      const totalTransactions = transactions.length;

      // Get first transaction timestamp
      let firstTransactionDate = "N/A";
      if (transactions.length > 0) {
        const firstTx = transactions[transactions.length - 1];
        const timestamp = parseInt(firstTx.timestamp) / 1000000; // Convert microseconds to milliseconds
        firstTransactionDate = new Date(timestamp).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      }

      // Fetch NFTs using Aptos Indexer GraphQL API
      const nftQuery = `
        query GetAccountNFTs($address: String!) {
          current_token_ownerships_v2(
            where: {
              owner_address: {_eq: $address},
              amount: {_gt: "0"}
            }
          ) {
            amount
          }
        }
      `;

      const nftResponse = await fetch("https://api.mainnet.aptoslabs.com/v1/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: nftQuery,
          variables: { address },
        }),
      });

      let nftCount = 0;
      if (nftResponse.ok) {
        const nftData = await nftResponse.json();
        nftCount = nftData?.data?.current_token_ownerships_v2?.length || 0;
      }

      setJourneyData({
        address,
        totalTransactions,
        firstTransactionDate,
        nftCount,
      });

      toast({
        title: "Success!",
        description: "Journey card generated successfully",
      });
    } catch (error) {
      console.error("Error fetching Aptos data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch data. Please check the address and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4 animate-in fade-in-50 slide-in-from-top-4 duration-700">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="w-8 h-8 text-primary animate-pulse" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
              Aptos Journey Card
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">Discover your on-chain story with a beautiful adventure card</p>
        </div>

        {/* Input Section */}
        <div className="space-y-4 animate-in fade-in-50 slide-in-from-bottom-4 duration-700 delay-150">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              type="text"
              placeholder="Enter Aptos wallet address (0x...)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="flex-1 h-12 bg-input/50 backdrop-blur-sm border-border focus:border-primary transition-all duration-300"
              disabled={loading}
            />
            <Button
              onClick={fetchAptosData}
              disabled={loading}
              className="h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-glow hover:shadow-glow-lg transition-all duration-300"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Loading...
                </>
              ) : (
                "Generate Card"
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Paste any Aptos mainnet address to see their journey
          </p>
        </div>

        {/* Journey Card Display */}
        {journeyData && (
          <div className="pt-4">
            <JourneyCard {...journeyData} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
