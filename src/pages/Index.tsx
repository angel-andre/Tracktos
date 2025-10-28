import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles, Plus, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSavedWallets, saveWallet, type SavedWallet } from "@/lib/walletStorage";
import { AccountCard } from "@/components/dashboard/AccountCard";
import { TokensCard } from "@/components/dashboard/TokensCard";
import { ActivityCard } from "@/components/dashboard/ActivityCard";
import { NFTsCard } from "@/components/dashboard/NFTsCard";
import { PortfolioChartCard } from "@/components/dashboard/PortfolioChartCard";
import { WalletIdentityCard } from "@/components/dashboard/WalletIdentityCard";
import { TransactionAnalyticsCard } from "@/components/dashboard/TransactionAnalyticsCard";
import { DeFiActivityCard } from "@/components/dashboard/DeFiActivityCard";
import { ShareExportCard } from "@/components/dashboard/ShareExportCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import aptosLogo from "@/assets/aptos-logo.png";

interface AccountData {
  address: string;
  aptBalance: string;
  stakedApt: string;
  firstTransactionTimestamp?: string;
  lastTransactionTimestamp?: string;
  usdChange24h: number;
  percentChange24h: number;
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
  tokenDataId?: string;
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

export default function IndexPage() {
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState<"mainnet" | "testnet">("mainnet");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<AptosData | null>(null);
  const [savedWallets, setSavedWallets] = useState<SavedWallet[]>([]);
  const [showNewWalletInput, setShowNewWalletInput] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const wallets = getSavedWallets();
    setSavedWallets(wallets);
    if (wallets.length > 0) {
      setAddress(wallets[0].address);
    } else {
      setShowNewWalletInput(true);
    }
  }, []);

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
      setLastUpdated(new Date());
      
      // Save wallet to local storage
      saveWallet(address.trim());
      setSavedWallets(getSavedWallets());
      setShowNewWalletInput(false);
    } catch (err: any) {
      console.error("Error fetching Aptos data:", err);
      setError(err.message || "Failed to load wallet data. Please check the address and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleWalletSelect = (value: string) => {
    if (value === "new") {
      setShowNewWalletInput(true);
      setAddress("");
    } else {
      setAddress(value);
      setShowNewWalletInput(false);
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
        {/* Beta Banner */}
        <Alert className="bg-primary/10 border-primary/30">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription className="text-foreground">
            Still in beta, doing public testing
          </AlertDescription>
        </Alert>

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
            {!showNewWalletInput && savedWallets.length > 0 ? (
              <div className="flex gap-2 flex-1">
                <Select value={address} onValueChange={handleWalletSelect}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a wallet" />
                  </SelectTrigger>
                  <SelectContent>
                    {savedWallets.map((wallet) => (
                      <SelectItem key={wallet.address} value={wallet.address}>
                        {wallet.label || `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`}
                      </SelectItem>
                    ))}
                    <SelectItem value="new">
                      <div className="flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Add New Wallet
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <Input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter Aptos wallet address (0x...)"
                className="flex-1"
                disabled={loading}
              />
            )}
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

          {lastUpdated && data && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Last updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
              </span>
              <Button
                onClick={loadStats}
                variant="ghost"
                size="sm"
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          )}
        </div>

        {/* Dashboard Tabs */}
        {(data || loading) && (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="inline-flex h-auto w-full flex-wrap justify-start gap-2 bg-muted/50 p-2">
              <TabsTrigger value="overview" className="flex-1 min-w-[100px]">Overview</TabsTrigger>
              <TabsTrigger value="tokens" className="flex-1 min-w-[100px]">Tokens</TabsTrigger>
              <TabsTrigger value="nfts" className="flex-1 min-w-[100px]">NFTs</TabsTrigger>
              <TabsTrigger value="activity" className="flex-1 min-w-[100px]">Activity</TabsTrigger>
              <TabsTrigger value="defi" className="flex-1 min-w-[100px]">DeFi</TabsTrigger>
              <TabsTrigger value="identity" className="flex-1 min-w-[100px]">Identity</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <AccountCard 
                data={data?.account || null} 
                loading={loading}
                transactionCount={data?.totalTransactionCount || 0}
                nftCount={data?.totalNftCount || 0}
                tokenCount={data?.tokens?.length || 0}
                sentimentReasons={data?.sentimentReasons || []}
              />
              {data && (
                <PortfolioChartCard address={address} currentTotalUsdValue={data.totalUsdValue} />
              )}
            </TabsContent>

            <TabsContent value="tokens" className="space-y-6">
              <TokensCard 
                tokens={data?.tokens || null} 
                totalUsdValue={data?.totalUsdValue || 0}
                loading={loading} 
              />
            </TabsContent>

            <TabsContent value="nfts" className="space-y-6">
              <NFTsCard nfts={data?.nfts || null} loading={loading} network={network} />
            </TabsContent>

            <TabsContent value="activity" className="space-y-6">
              {data?.transactionAnalytics && (
                <TransactionAnalyticsCard analytics={data.transactionAnalytics} />
              )}
              <ActivityCard activity={data?.activity || null} loading={loading} />
            </TabsContent>

            <TabsContent value="defi" className="space-y-6">
              {data?.defiActivity && (
                <DeFiActivityCard defiActivity={data.defiActivity} />
              )}
              {!data?.defiActivity && !loading && (
                <div className="backdrop-blur-xl bg-card/50 border border-border/50 rounded-xl p-8 text-center">
                  <p className="text-muted-foreground">No DeFi activity found for this wallet</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="identity" className="space-y-6">
              <WalletIdentityCard
                data={data?.walletIdentity || null}
                loading={loading}
                walletAge={data?.account?.firstTransactionTimestamp}
                transactionCount={data?.totalTransactionCount || 0}
                portfolioValue={data?.totalUsdValue || 0}
                tokenCount={data?.tokens?.length || 0}
              />
              {data && (
                <ShareExportCard
                  address={address}
                  portfolioValue={data.totalUsdValue}
                  transactionCount={data.totalTransactionCount}
                  tokenCount={data.tokens?.length || 0}
                  nftCount={data.totalNftCount}
                  walletAge={data.account?.firstTransactionTimestamp}
                  walletIdentity={data.walletIdentity}
                />
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
