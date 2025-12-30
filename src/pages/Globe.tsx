import { Suspense, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { ArrowLeft, Activity, Globe as GlobeIcon, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobeScene } from "@/components/globe/GlobeScene";
import { TransactionFeed } from "@/components/globe/TransactionFeed";
import { useRealtimeTransactions, type Transaction } from "@/hooks/useRealtimeTransactions";
import aptosLogo from "@/assets/aptos-logo.png";

export default function GlobePage() {
  const { transactions, stats, isConnected } = useRealtimeTransactions();
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
                  Live Network
                </h1>
                <p className="text-sm text-muted-foreground">Real-time Aptos transactions</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
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

      {/* Stats Bar */}
      <div className="relative z-10 border-b border-border/30 bg-card/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{stats.tps.toFixed(1)} TPS</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{stats.totalToday.toLocaleString()} today</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stats.topTypes.slice(0, 3).map((type, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {type}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-0 flex h-[calc(100vh-140px)]">
        {/* 3D Globe */}
        <div className="flex-1 relative">
          <Canvas
            camera={{ position: [0, 0, 2.5], fov: 45 }}
            style={{ background: 'transparent' }}
          >
            <Suspense fallback={null}>
              <ambientLight intensity={0.3} />
              <pointLight position={[10, 10, 10]} intensity={1} />
              <pointLight position={[-10, -10, -10]} intensity={0.5} color="#00d9ff" />
              <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
              <GlobeScene 
                transactions={transactions}
                onTransactionSelect={setSelectedTransaction}
              />
              <OrbitControls
                enableZoom={true}
                enablePan={false}
                minDistance={1.5}
                maxDistance={4}
                autoRotate
                autoRotateSpeed={0.3}
              />
            </Suspense>
          </Canvas>
          
          {/* Globe overlay info */}
          <div className="absolute bottom-4 left-4 text-xs text-muted-foreground">
            <p>Drag to rotate • Scroll to zoom</p>
          </div>
        </div>

        {/* Transaction Feed Sidebar */}
        <div className="w-80 border-l border-border/50 bg-card/50 backdrop-blur-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border/30">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Live Transactions
            </h2>
          </div>
          <TransactionFeed 
            transactions={transactions}
            selectedTransaction={selectedTransaction}
            onSelect={setSelectedTransaction}
          />
        </div>
      </div>

      {/* Selected Transaction Details */}
      {selectedTransaction && (
        <div className="absolute bottom-4 left-4 z-20 max-w-md">
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
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
