import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Activity, Plus, RefreshCw, Globe, Music2, Sparkles, ArrowRight, Zap, BarChart3, Wallet } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
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
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";


const DEMO_WALLET = "0x632dad777e05538c1ce47fad67ad801d242b481e45adfbc058a45e59851c3907";

interface AccountData {
  address: string;
  aptBalance: string;
  stakedApt: string;
  stakingBreakdown?: Array<{
    poolAddress: string;
    amount: string;
    type: 'validator' | 'liquid_staking';
    protocol?: string;
  }>;
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
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState<"mainnet" | "testnet">("mainnet");
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState("");
  const [data, setData] = useState<AptosData | null>(null);
  const [savedWallets, setSavedWallets] = useState<SavedWallet[]>([]);
  const [showNewWalletInput, setShowNewWalletInput] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Initialize from URL params or saved wallets
  useEffect(() => {
    const urlAddress = searchParams.get('address');
    const urlNetwork = searchParams.get('network');
    const wallets = getSavedWallets();
    setSavedWallets(wallets);

    // Priority: URL params > saved wallets > show input
    if (urlAddress) {
      setAddress(urlAddress);
      if (urlNetwork === 'testnet' || urlNetwork === 'mainnet') {
        setNetwork(urlNetwork);
      }
      // Auto-load if address in URL
      loadStatsFromUrl(urlAddress, urlNetwork === 'testnet' ? 'testnet' : 'mainnet');
    } else if (wallets.length > 0) {
      setAddress(wallets[0].address);
    } else {
      setShowNewWalletInput(true);
    }
  }, []);

  // Helper function to load stats (used by initial URL load)
  const loadStatsFromUrl = async (addr: string, net: "mainnet" | "testnet") => {
    setError("");
    const hasExistingData = data !== null;
    
    if (hasExistingData) {
      setIsRefreshing(true);
      toast({
        title: "Refreshing wallet data...",
        description: "Keep browsing, data will update soon",
      });
    } else {
      setLoading(true);
      setData(null);
    }
    
    setLoadingProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 300);

    try {
      const { data: responseData, error: functionError } = await supabase.functions.invoke(
        'aptos',
        {
          body: { address: addr.trim(), network: net },
        }
      );

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (responseData.error) {
        throw new Error(responseData.error);
      }

      setLoadingProgress(100);
      setData(responseData as AptosData);
      setLastUpdated(new Date());
      
      saveWallet(addr.trim());
      setSavedWallets(getSavedWallets());
      setShowNewWalletInput(false);
      
      if (hasExistingData) {
        toast({
          title: "Wallet data updated",
          description: "Latest data loaded successfully",
        });
      }
    } catch (err: any) {
      console.error("Error fetching Aptos data:", err);
      setError(err.message || "Failed to load wallet data. Please check the address and try again.");
      toast({
        variant: "destructive",
        title: "Failed to load data",
        description: err.message || "Please try again",
      });
    } finally {
      clearInterval(progressInterval);
      setLoading(false);
      setIsRefreshing(false);
      setTimeout(() => setLoadingProgress(0), 500);
    }
  };

  const loadStats = async () => {
    if (!address.trim()) {
      setError("Please enter a wallet address");
      return;
    }

    // Update URL with current address and network
    setSearchParams({ address: address.trim(), network });

    setError("");
    const hasExistingData = data !== null;
    
    if (hasExistingData) {
      setIsRefreshing(true);
      toast({
        title: "Loading wallet data...",
        description: "Keep browsing, data will update soon",
      });
    } else {
      setLoading(true);
      setData(null);
    }
    
    setLoadingProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 300);

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

      setLoadingProgress(100);
      setData(responseData as AptosData);
      setLastUpdated(new Date());
      
      // Save wallet to local storage
      saveWallet(address.trim());
      setSavedWallets(getSavedWallets());
      setShowNewWalletInput(false);
      
      if (hasExistingData) {
        toast({
          title: "Wallet data updated",
          description: "Latest data loaded successfully",
        });
      }
    } catch (err: any) {
      console.error("Error fetching Aptos data:", err);
      setError(err.message || "Failed to load wallet data. Please check the address and try again.");
      toast({
        variant: "destructive",
        title: "Failed to load data",
        description: err.message || "Please try again",
      });
    } finally {
      clearInterval(progressInterval);
      setLoading(false);
      setIsRefreshing(false);
      setTimeout(() => setLoadingProgress(0), 500);
    }
  };

  const handleWalletSelect = (value: string) => {
    if (value === "new") {
      setShowNewWalletInput(true);
      setAddress("");
      // Clear URL params when adding new wallet
      setSearchParams({});
    } else {
      setAddress(value);
      setShowNewWalletInput(false);
      toast({
        title: "Wallet selected",
        description: "Click 'Analyze Wallet' to load data",
      });
    }
  };

  const handleNetworkChange = (newNetwork: "mainnet" | "testnet") => {
    setNetwork(newNetwork);
    // If we have data loaded, update URL and show feedback
    if (data && address) {
      setSearchParams({ address: address.trim(), network: newNetwork });
      toast({
        title: `Switched to ${newNetwork}`,
        description: "Click refresh to load data for this network",
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      loadStats();
    }
  };

  const handleTryDemo = () => {
    setAddress(DEMO_WALLET);
    setShowNewWalletInput(false);
    setSearchParams({ address: DEMO_WALLET, network });
    loadStatsFromUrl(DEMO_WALLET, network);
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Artistic background layer — aurora blobs, dotted grid */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-grid-aptos opacity-40" />
        <div className="absolute -top-32 -left-32 w-[42rem] h-[42rem] rounded-full bg-[hsl(125_60%_85%/0.55)] blur-3xl animate-float-slow dark:bg-[hsl(125_60%_30%/0.35)]" />
        <div className="absolute top-1/3 -right-40 w-[38rem] h-[38rem] rounded-full bg-[hsl(205_70%_80%/0.5)] blur-3xl animate-float-slow dark:bg-[hsl(205_50%_30%/0.35)]" style={{ animationDelay: "-6s" }} />
        <div className="absolute bottom-0 left-1/3 w-[34rem] h-[34rem] rounded-full bg-[hsl(12_99%_75%/0.35)] blur-3xl animate-float-slow dark:bg-[hsl(12_99%_45%/0.25)]" style={{ animationDelay: "-3s" }} />
      </div>

      {/* Top nav bar */}
      <header className="relative z-10 px-4 sm:px-8 pt-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-accent/40 blur-md animate-pulse-ring" />
              <img src={aptosLogo} alt="Aptos" className="relative w-9 h-9" />
            </div>
            <div className="leading-none">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight">Tracktos</span>
                <Activity className="w-4 h-4 text-accent" />
              </div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Aptos Wallet Intelligence</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 glass-panel rounded-full px-2 py-1.5">
            <Link to="/globe" className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium hover:bg-foreground/5 transition-colors">
              <Globe className="w-4 h-4 text-[hsl(205_60%_50%)]" />
              Live Network
            </Link>
            <Link to="/pulse" className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium hover:bg-foreground/5 transition-colors">
              <Music2 className="w-4 h-4 text-accent" />
              Aptos Pulse
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/globe" className="md:hidden p-2 rounded-full glass-panel">
              <Globe className="w-4 h-4 text-[hsl(205_60%_50%)]" />
            </Link>
            <Link to="/pulse" className="md:hidden p-2 rounded-full glass-panel">
              <Music2 className="w-4 h-4 text-accent" />
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-4 sm:px-8 pt-10 pb-8">
        <div className="max-w-7xl mx-auto">
          <Alert className="mb-8 glass-panel border-accent/30 bg-accent/5">
            <Info className="h-4 w-4 text-accent" />
            <AlertDescription className="text-foreground">
              <span className="font-semibold text-accent">Beta</span> — Tracktos is in public testing. Expect rapid iteration.
            </AlertDescription>
          </Alert>

          <div className="grid lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel text-xs font-medium tracking-wide">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                Built for the Aptos network
              </div>
              <h1 className="text-balance text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
                Watch your wallet{" "}
                <span className="text-gradient-aptos">move with the chain.</span>
              </h1>
              <p className="text-balance text-lg text-muted-foreground max-w-xl">
                Tracktos turns raw Aptos transactions into a living portrait — portfolio, NFTs, DeFi flows, and on-chain identity, rendered with the network's own rhythm.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  onClick={handleTryDemo}
                  disabled={loading}
                  size="lg"
                  className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground rounded-full px-6 shadow-[var(--shadow-elevated)]"
                >
                  Try a live demo wallet
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Link to="/pulse">
                  <Button variant="outline" size="lg" className="gap-2 rounded-full px-6 glass-panel border-foreground/15">
                    <Music2 className="w-4 h-4 text-accent" />
                    Open Aptos Pulse
                  </Button>
                </Link>
              </div>

              {/* Feature pills */}
              <div className="grid grid-cols-3 gap-3 pt-6 max-w-xl">
                {[
                  { icon: Wallet, label: "Portfolio", color: "hsl(125 50% 45%)", bg: "hsl(125 60% 90%)" },
                  { icon: BarChart3, label: "Analytics", color: "hsl(205 70% 40%)", bg: "hsl(205 60% 88%)" },
                  { icon: Zap, label: "DeFi Flows", color: "hsl(12 80% 50%)", bg: "hsl(12 99% 90%)" },
                ].map(({ icon: Icon, label, color, bg }) => (
                  <div key={label} className="glass-panel rounded-xl px-3 py-3 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: bg }}>
                      <Icon className="w-4 h-4" style={{ color }} />
                    </span>
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Decorative network orb */}
            <div className="lg:col-span-5 hidden lg:block">
              <div className="relative aspect-square max-w-md mx-auto">
                <div className="absolute inset-0 rounded-full" style={{ background: "var(--gradient-hero)", filter: "blur(40px)", opacity: 0.55 }} />
                <div className="absolute inset-6 rounded-full glass-panel animate-blob-spin" style={{ borderRadius: "42% 58% 53% 47% / 51% 44% 56% 49%" }} />
                <div className="absolute inset-14 rounded-full bg-card/60 backdrop-blur-2xl border border-border/60 flex items-center justify-center">
                  <img src={aptosLogo} alt="" className="w-24 h-24 opacity-90" />
                </div>
                {/* orbiting dots */}
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full"
                    style={{
                      background: i % 3 === 0 ? "hsl(12 99% 68%)" : i % 3 === 1 ? "hsl(125 50% 55%)" : "hsl(205 60% 60%)",
                      transform: `rotate(${i * 60}deg) translateX(160px)`,
                      boxShadow: "0 0 12px currentColor",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Live ticker */}
          <div className="mt-12 ticker-mask overflow-hidden border-y border-border/60 py-3">
            <div className="flex gap-12 animate-ticker whitespace-nowrap text-xs uppercase tracking-[0.25em] text-muted-foreground">
              {Array.from({ length: 2 }).map((_, k) => (
                <div key={k} className="flex gap-12">
                  <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> Live Aptos data</span>
                  <span>Wallet analytics</span>
                  <span>NFT portfolio</span>
                  <span>DeFi swaps · staking</span>
                  <span>Validator map</span>
                  <span>Transaction pulse</span>
                  <span>Portfolio history</span>
                  <span>On-chain identity</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Main content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 pb-16 space-y-8">
        {/* Control Panel */}
        <div className="glass-panel rounded-2xl p-6 space-y-4 shadow-[var(--shadow-elevated)]">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold">Analyze a wallet</h2>
              <p className="text-sm text-muted-foreground">Paste any Aptos address or pick from your saved wallets.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => handleNetworkChange("mainnet")}
              variant={network === "mainnet" ? "default" : "outline"}
              className={`font-medium rounded-full ${network === "mainnet" ? "bg-foreground text-background hover:bg-foreground/90" : ""}`}
            >
              Mainnet
            </Button>
            <Button
              onClick={() => handleNetworkChange("testnet")}
              variant={network === "testnet" ? "default" : "outline"}
              className={`font-medium rounded-full ${network === "testnet" ? "bg-foreground text-background hover:bg-foreground/90" : ""}`}
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
              disabled={loading || isRefreshing || !address.trim()}
              className="sm:w-auto gap-2"
            >
              {loading || isRefreshing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {Math.round(loadingProgress)}%
                </>
              ) : (
                "Analyze Wallet"
              )}
            </Button>
          </div>

          {(loading || isRefreshing) && loadingProgress > 0 && (
            <div className="space-y-2">
              <Progress value={loadingProgress} className="h-2" />
              <p className="text-sm text-muted-foreground text-center">
                {isRefreshing ? "Refreshing wallet data..." : "Fetching wallet data..."} {Math.round(loadingProgress)}%
              </p>
            </div>
          )}

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
                disabled={loading || isRefreshing}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${(loading || isRefreshing) ? 'animate-spin' : ''}`} />
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
              <div className={isRefreshing ? "opacity-70 transition-opacity" : ""}>
                <AccountCard 
                  data={data?.account || null} 
                  loading={loading}
                  transactionCount={data?.totalTransactionCount || 0}
                  nftCount={data?.totalNftCount || 0}
                  tokenCount={data?.tokens?.length || 0}
                  sentimentReasons={data?.sentimentReasons || []}
                />
              </div>
              {data && (
                <div className={isRefreshing ? "opacity-70 transition-opacity" : ""}>
                  <PortfolioChartCard address={address} currentTotalUsdValue={data.totalUsdValue} />
                </div>
              )}
            </TabsContent>

            <TabsContent value="tokens" className="space-y-6">
              <div className={isRefreshing ? "opacity-70 transition-opacity" : ""}>
                <TokensCard 
                  tokens={data?.tokens || null} 
                  totalUsdValue={data?.totalUsdValue || 0}
                  loading={loading} 
                />
              </div>
            </TabsContent>

            <TabsContent value="nfts" className="space-y-6">
              <div className={isRefreshing ? "opacity-70 transition-opacity" : ""}>
                <NFTsCard nfts={data?.nfts || null} loading={loading} network={network} />
              </div>
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
