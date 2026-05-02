import { Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { ArrowLeft, Activity, Globe as GlobeIcon, Zap, Server, ExternalLink, AlertCircle, BarChart3, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobeScene } from "@/components/globe/GlobeScene";
import { TransactionFeed } from "@/components/globe/TransactionFeed";
import { NetworkStatsPanel } from "@/components/globe/NetworkStatsPanel";
import { TPSChart } from "@/components/globe/TPSChart";
import { TransactionTypeChart } from "@/components/globe/TransactionTypeChart";
import { EpochProgress } from "@/components/globe/EpochProgress";
import { useRealtimeTransactions, type Transaction } from "@/hooks/useRealtimeTransactions";
import { useValidatorNodes } from "@/hooks/useValidatorNodes";
import aptosLogo from "@/assets/aptos-logo.png";

export default function GlobePage() {
  const { transactions, stats: txStats, isConnected, error } = useRealtimeTransactions();
  const { validators, stats: networkStats, getValidatorLocation } = useValidatorNodes();
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Artistic background — aurora blobs + dotted grid (matches landing) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-grid-aptos opacity-30" />
        <div className="absolute -top-40 -left-40 w-[42rem] h-[42rem] rounded-full bg-[hsl(125_60%_85%/0.45)] blur-3xl animate-float-slow dark:bg-[hsl(125_60%_30%/0.3)]" />
        <div className="absolute top-1/4 -right-40 w-[38rem] h-[38rem] rounded-full bg-[hsl(205_70%_80%/0.45)] blur-3xl animate-float-slow dark:bg-[hsl(205_50%_30%/0.3)]" style={{ animationDelay: "-6s" }} />
        <div className="absolute bottom-0 left-1/3 w-[34rem] h-[34rem] rounded-full bg-[hsl(12_99%_75%/0.3)] blur-3xl animate-float-slow dark:bg-[hsl(12_99%_45%/0.22)]" style={{ animationDelay: "-3s" }} />
      </div>

      {/* Header */}
      <header className="relative z-10 px-4 sm:px-6 pt-4">
        <div className="max-w-[1600px] mx-auto glass-panel rounded-2xl px-4 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Link to="/">
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 hover:bg-foreground/5">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-[hsl(205_70%_60%/0.4)] blur-md animate-pulse-ring" />
                <img src={aptosLogo} alt="Aptos" className="relative w-8 h-8" />
              </div>
              <div className="leading-none">
                <h1 className="text-base font-bold tracking-tight flex items-center gap-2">
                  <span className="text-gradient-aptos">Live Network</span>
                  <GlobeIcon className="w-3.5 h-3.5 text-[hsl(205_60%_50%)]" />
                </h1>
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Aptos validator topology</span>
              </div>
            </div>

            {/* Stats pill row */}
            <div className="flex items-center gap-1 glass-panel rounded-full px-2 py-1 text-xs">
              <div className="flex items-center gap-1.5 px-2">
                <Server className="w-3.5 h-3.5 text-[hsl(125_50%_45%)]" />
                <span className="font-semibold">{networkStats.totalValidators}</span>
                <span className="text-muted-foreground">Validators</span>
              </div>
              <span className="w-px h-3.5 bg-border/60" />
              <div className="flex items-center gap-1.5 px-2">
                <Zap className="w-3.5 h-3.5 text-accent" />
                <span className="font-semibold">{Math.round(txStats.tps)}</span>
                <span className="text-muted-foreground">TPS</span>
              </div>
              <span className="w-px h-3.5 bg-border/60" />
              <div className="flex items-center gap-1.5 px-2">
                <GlobeIcon className="w-3.5 h-3.5 text-[hsl(205_60%_50%)]" />
                <span className="font-semibold">{networkStats.countries}</span>
                <span className="text-muted-foreground">Countries</span>
              </div>
              <span className="w-px h-3.5 bg-border/60" />
              <div className="flex items-center gap-1.5 px-2">
                <span className="font-semibold">{networkStats.cities}</span>
                <span className="text-muted-foreground">Cities</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 glass-panel rounded-full px-3 py-1.5 text-xs">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[hsl(125_60%_50%)] animate-pulse shadow-[0_0_8px_hsl(125_60%_50%)]' : 'bg-destructive'}`} />
                <span className="text-muted-foreground">{isConnected ? 'Live' : 'Connecting'}</span>
              </div>
              <Link to="/pulse">
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-full glass-panel border-foreground/15">
                  <Music2 className="w-3.5 h-3.5 text-accent" />
                  Pulse
                </Button>
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-0 flex gap-3 px-4 sm:px-6 py-3 h-[calc(100vh-92px)]">
        {/* Left Panel - Network Stats & Charts */}
        <div className="hidden lg:flex flex-col w-80 glass-panel rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border/40">
            <h2 className="font-semibold flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "hsl(205 60% 88%)" }}>
                <BarChart3 className="w-4 h-4" style={{ color: "hsl(205 70% 40%)" }} />
              </span>
              <span className="text-gradient-aptos">Live Analytics</span>
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {/* Live Charts Section */}
            <div className="p-3 space-y-3">
              <TPSChart currentTPS={txStats.tps} peakTPS={networkStats.peakTps} />
              <TransactionTypeChart transactions={transactions} />
              <EpochProgress
                epoch={parseInt(txStats.epoch) || 0}
                ledgerTimestamp={txStats.ledgerTimestamp}
              />
            </div>

            {/* Network Stats */}
            <div className="border-t border-border/40">
              <div className="p-4 pb-2">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Server className="w-4 h-4 text-[hsl(125_50%_45%)]" />
                  Network Stats
                </h3>
              </div>
              <NetworkStatsPanel stats={networkStats} />
            </div>

            {/* Live Blockchain Data */}
            <div className="p-4 border-t border-border/40">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-accent" />
                Blockchain State
              </h3>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Block Height</span>
                  <span>{parseInt(txStats.blockHeight).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Latest Version</span>
                  <span>{parseInt(txStats.latestVersion).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Transactions</span>
                  <span className="text-accent">{(parseInt(txStats.latestVersion) / 1e9).toFixed(2)}B</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3D Globe */}
        <div className="flex-1 relative glass-panel rounded-2xl overflow-hidden">
          <Canvas
            camera={{ position: [0, 0, 2.5], fov: 45 }}
            style={{ background: 'transparent' }}
          >
            <Suspense fallback={null}>
              <ambientLight intensity={1.2} />
              <directionalLight position={[5, 3, 5]} intensity={2} />
              <directionalLight position={[-5, -3, -5]} intensity={0.8} color="#4da6ff" />
              <pointLight position={[10, 10, 10]} intensity={1.5} />
              <hemisphereLight intensity={0.6} groundColor="#000000" />
              <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={0.5} />
              <GlobeScene
                transactions={transactions}
                validators={validators}
                onTransactionSelect={setSelectedTransaction}
                getValidatorLocation={getValidatorLocation}
              />
              <OrbitControls
                enableZoom={true}
                enablePan={false}
                minDistance={1.5}
                maxDistance={4}
                autoRotate
                autoRotateSpeed={0.2}
              />
            </Suspense>
          </Canvas>

          {/* Globe overlay info */}
          <div className="absolute bottom-4 left-4 right-4 lg:right-auto flex flex-col gap-2 max-w-md">
            <div className="text-xs text-muted-foreground glass-panel rounded-full px-4 py-2 inline-flex items-center gap-2 w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-[hsl(125_60%_50%)] animate-pulse" />
              Validators rendered at accurate geo-locations · pulses are live transactions
            </div>
            {error && (
              <div className="flex items-center gap-2 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 backdrop-blur-md px-3 py-2 rounded-full w-fit">
                <AlertCircle className="w-3 h-3" />
                <span>Using cached data - {error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Transactions */}
        <div className="hidden md:flex w-80 glass-panel rounded-2xl overflow-hidden flex-col">
          <Tabs defaultValue="transactions" className="flex-1 flex flex-col">
            <TabsList className="m-2 grid grid-cols-2 bg-card/40 backdrop-blur-md">
              <TabsTrigger value="transactions" className="text-xs">
                <Activity className="w-3 h-3 mr-1" />
                Live TXs
              </TabsTrigger>
              <TabsTrigger value="stats" className="text-xs lg:hidden">
                <Server className="w-3 h-3 mr-1" />
                Stats
              </TabsTrigger>
            </TabsList>

            <TabsContent value="transactions" className="flex-1 overflow-hidden m-0">
              <TransactionFeed
                transactions={transactions}
                selectedTransaction={selectedTransaction}
                onSelect={setSelectedTransaction}
              />
            </TabsContent>

            <TabsContent value="stats" className="flex-1 overflow-y-auto m-0 lg:hidden">
              <NetworkStatsPanel stats={networkStats} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Selected Transaction Details */}
      {selectedTransaction && (
        <div className="absolute bottom-6 left-6 z-20 max-w-md lg:left-[22rem]">
          <Card className="glass-panel border-accent/40 shadow-[var(--shadow-elevated)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="text-gradient-aptos">Transaction Details</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedTransaction(null)}
                  className="h-6 w-6 p-0"
                >
                  ×
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground">Hash</span>
                <a
                  href={`https://explorer.aptoslabs.com/txn/${selectedTransaction.hash}?network=mainnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono truncate max-w-[180px] text-accent hover:underline flex items-center gap-1"
                >
                  {selectedTransaction.hash.slice(0, 10)}...{selectedTransaction.hash.slice(-6)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Version</span>
                <span className="font-mono">{selectedTransaction.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <Badge variant="secondary">{selectedTransaction.type}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={selectedTransaction.success ? "default" : "destructive"}>
                  {selectedTransaction.success ? "Success" : "Failed"}
                </Badge>
              </div>
              {selectedTransaction.amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="text-accent font-medium">{selectedTransaction.amount.toFixed(4)} APT</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gas Cost</span>
                <span>{selectedTransaction.gasCost.toFixed(6)} APT</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground">Sender</span>
                <span className="font-mono truncate max-w-[150px]">
                  {selectedTransaction.sender.slice(0, 8)}...{selectedTransaction.sender.slice(-6)}
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground">Function</span>
                <span className="truncate max-w-[150px] text-right">
                  {selectedTransaction.function !== 'unknown'
                    ? selectedTransaction.function.split('::').slice(-2).join('::')
                    : 'N/A'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
