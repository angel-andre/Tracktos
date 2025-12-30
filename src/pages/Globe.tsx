import { Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { ArrowLeft, Activity, Globe as GlobeIcon, Zap, Server, ExternalLink, AlertCircle, BarChart3 } from "lucide-react";
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
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background pointer-events-none" />
      
      {/* Header */}
      <header className="relative z-10 border-b border-border/50 backdrop-blur-xl bg-background/80">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <img src={aptosLogo} alt="Aptos" className="w-8 h-8" />
              <div>
                <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <GlobeIcon className="w-5 h-5 text-primary" />
                  Aptos Network Globe
                </h1>
                <p className="text-sm text-muted-foreground">
                  {networkStats.totalValidators} validators across {networkStats.countries} countries
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">{networkStats.totalValidators} Validators</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">{Math.round(networkStats.tps)} TPS</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-sm text-muted-foreground">
                {isConnected ? 'Live' : 'Connecting...'}
              </span>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-0 flex h-[calc(100vh-80px)]">
        {/* Left Panel - Network Stats & Charts */}
        <div className="hidden lg:block w-80 border-r border-border/50 bg-card/30 backdrop-blur-xl overflow-y-auto">
          <div className="p-4 border-b border-border/30">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Live Analytics
            </h2>
          </div>
          
          {/* Live Charts Section */}
          <div className="p-3 space-y-3">
            {/* TPS Chart */}
            <TPSChart currentTPS={txStats.tps} peakTPS={networkStats.peakTps} />
            
            {/* Transaction Type Distribution */}
            <TransactionTypeChart transactions={transactions} />
            
            {/* Epoch Progress - now using real ledger timestamp */}
            <EpochProgress 
              epoch={parseInt(txStats.epoch) || 0} 
              ledgerTimestamp={txStats.ledgerTimestamp}
            />
          </div>
          
          {/* Network Stats */}
          <div className="border-t border-border/30">
            <div className="p-4 pb-2">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" />
                Network Stats
              </h3>
            </div>
            <NetworkStatsPanel stats={networkStats} />
          </div>
          
          {/* Live Blockchain Data */}
          <div className="p-4 border-t border-border/30">
            <h3 className="text-sm font-medium text-foreground mb-3">Blockchain State</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Block Height</span>
                <span className="font-mono text-foreground">{parseInt(txStats.blockHeight).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Latest Version</span>
                <span className="font-mono text-foreground">{parseInt(txStats.latestVersion).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Transactions</span>
                <span className="font-mono text-primary">{(parseInt(txStats.latestVersion) / 1e9).toFixed(2)}B</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3D Globe */}
        <div className="flex-1 relative">
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
          <div className="absolute bottom-4 left-4 right-4 lg:right-auto flex flex-col gap-2">
            <div className="text-xs text-muted-foreground bg-background/50 backdrop-blur-sm px-3 py-2 rounded-lg">
              <p>Validator nodes shown at accurate locations • Transaction pulses indicate live activity</p>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-xs text-yellow-500 bg-yellow-500/10 backdrop-blur-sm px-3 py-2 rounded-lg">
                <AlertCircle className="w-3 h-3" />
                <span>Using cached data - {error}</span>
              </div>
            )}
          </div>

          {/* Mobile stats bar */}
          <div className="lg:hidden absolute top-4 left-4 right-4 flex gap-2 overflow-x-auto pb-2">
            <Badge variant="secondary" className="whitespace-nowrap">
              <Server className="w-3 h-3 mr-1" />
              {networkStats.totalValidators} Validators
            </Badge>
            <Badge variant="secondary" className="whitespace-nowrap">
              <Zap className="w-3 h-3 mr-1" />
              {Math.round(networkStats.tps)} TPS
            </Badge>
            <Badge variant="secondary" className="whitespace-nowrap">
              {networkStats.countries} Countries
            </Badge>
          </div>
        </div>

        {/* Right Panel - Transactions */}
        <div className="w-80 border-l border-border/50 bg-card/30 backdrop-blur-xl overflow-hidden flex flex-col">
          <Tabs defaultValue="transactions" className="flex-1 flex flex-col">
            <TabsList className="m-2 grid grid-cols-2">
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
        <div className="absolute bottom-4 left-4 z-20 max-w-md lg:left-80 lg:ml-4">
          <Card className="bg-card/90 backdrop-blur-xl border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Transaction Details</span>
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
                  className="font-mono truncate max-w-[180px] text-primary hover:underline flex items-center gap-1"
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
                  <span className="text-primary font-medium">{selectedTransaction.amount.toFixed(4)} APT</span>
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
