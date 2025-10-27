import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AccountCard } from "@/components/dashboard/AccountCard";
import { TokensCard } from "@/components/dashboard/TokensCard";
import { ActivityCard } from "@/components/dashboard/ActivityCard";
import { NFTsCard } from "@/components/dashboard/NFTsCard";
import { PremiumNFTsCard } from "@/components/dashboard/PremiumNFTsCard";
import aptosLogo from "@/assets/aptos-logo.png";

interface AccountData {
  address: string;
  aptBalance: string;
  stakedApt: string;
  firstTransactionTimestamp?: string;
  lastTransactionTimestamp?: string;
}

interface Token {
  name: string;
  symbol: string;
  balance: string;
  usdPrice: number;
  usdValue: number;
  logoUrl: string;
}

interface NFT {
  name: string;
  collection: string;
  image: string;
  price?: string;
  purchaseHash?: string;
}

interface Transaction {
  hash: string;
  type: string;
  success: boolean;
  timestamp: string;
}

interface AptosData {
  account: AccountData;
  tokens: Token[];
  nfts: NFT[];
  activity: Transaction[];
  totalNftCount: number;
  totalTransactionCount: number;
  totalUsdValue: number;
}

export default function IndexPage() {
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState<"mainnet" | "testnet">("mainnet");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<AptosData | null>(null);

  const loadStats = async () => {
    if (!address.trim()) {
      setError("Please enter a wallet address");
      return;
    }

    setError("");
    setLoading(true);
    setData(null);

    try {
      const { data: responseData, error: functionError } = await supabase.functions.invoke(
        'aptos',
        {
          body: { address: address.trim(), network },
        }
      );

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (responseData.error) {
        throw new Error(responseData.error);
      }

      setData(responseData as AptosData);
    } catch (err: any) {
      console.error("Error fetching Aptos data:", err);
      setError(err.message || "Failed to load wallet data. Please check the address and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      loadStats();
    }
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-2">
            <img src={aptosLogo} alt="Aptos Logo" className="w-10 h-10" />
            <h1 className="text-4xl font-bold text-white">
              Tracktos
            </h1>
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <p className="text-muted-foreground">Explore your Aptos adventure through wallet analytics and insights</p>
        </div>

        {/* Control Panel */}
        <div className="backdrop-blur-xl bg-card/50 border border-border/50 rounded-xl shadow-xl p-6 space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={() => setNetwork("mainnet")}
              variant={network === "mainnet" ? "default" : "outline"}
              className="font-medium"
            >
              Mainnet
            </Button>
            <Button
              onClick={() => setNetwork("testnet")}
              variant={network === "testnet" ? "default" : "outline"}
              className="font-medium"
            >
              Testnet
            </Button>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter Aptos wallet address (0x...)"
              className="flex-1"
              disabled={loading}
            />
            <Button
              onClick={loadStats}
              disabled={loading || !address.trim()}
              className="sm:w-auto gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "Analyze Wallet"
              )}
            </Button>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <AccountCard 
              data={data?.account || null} 
              loading={loading}
              transactionCount={data?.totalTransactionCount || 0}
              nftCount={data?.totalNftCount || 0}
              tokenCount={data?.tokens?.length || 0}
            />
            <TokensCard 
              tokens={data?.tokens || null} 
              totalUsdValue={data?.totalUsdValue || 0}
              loading={loading} 
            />
          </div>
          
          <div className="space-y-6">
            <ActivityCard activity={data?.activity || null} loading={loading} />
          </div>
        </div>

        {/* Featured NFTs Section */}
        <PremiumNFTsCard nfts={data?.nfts || null} loading={loading} />

        {/* Full Width NFT Section */}
        <NFTsCard nfts={data?.nfts || null} loading={loading} />
      </div>
    </div>
  );
}
