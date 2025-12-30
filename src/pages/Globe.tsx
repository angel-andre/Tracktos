import { Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { ArrowLeft, Activity, Globe as GlobeIcon, Zap, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobeScene } from "@/components/globe/GlobeScene";
import { TransactionFeed } from "@/components/globe/TransactionFeed";
import { NetworkStatsPanel } from "@/components/globe/NetworkStatsPanel";
import { useRealtimeTransactions, type Transaction } from "@/hooks/useRealtimeTransactions";
import { useValidatorNodes } from "@/hooks/useValidatorNodes";
import aptosLogo from "@/assets/aptos-logo.png";

export default function GlobePage() {
  const { transactions, stats: txStats, isConnected } = useRealtimeTransactions();
  const { validators, stats: networkStats } = useValidatorNodes();
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
        {/* Left Panel - Network Stats */}
        <div className="hidden lg:block w-72 border-r border-border/50 bg-card/30 backdrop-blur-xl overflow-y-auto">
          <div className="p-4 border-b border-border/30">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" />
              Network Stats
            </h2>
          </div>
          <NetworkStatsPanel stats={networkStats} />
        </div>

        {/* 3D Globe */}
        <div className="flex-1 relative">
          <Canvas
            camera={{ position: [0, 0, 2.5], fov: 45 }}
            style={{ background: 'transparent' }}
          >
            <Suspense fallback={null}>
              <ambientLight intensity={0.4} />
              <pointLight position={[10, 10, 10]} intensity={1.2} />
              <pointLight position={[-10, -10, -10]} intensity={0.4} color="#00d9ff" />
              <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={0.5} />
              <GlobeScene 
                transactions={transactions}
                validators={validators}
                onTransactionSelect={setSelectedTransaction}
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
          <div className="absolute bottom-4 left-4 text-xs text-muted-foreground bg-background/50 backdrop-blur-sm px-3 py-2 rounded-lg">
            <p>Drag to rotate • Scroll to zoom • Hover nodes for details</p>
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
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hash</span>
                <span className="font-mono truncate max-w-[200px]">{selectedTransaction.hash}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <Badge variant="secondary">{selectedTransaction.type}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="text-primary font-medium">{selectedTransaction.amount} APT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Route</span>
                <span>{selectedTransaction.fromCity} → {selectedTransaction.toCity}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
