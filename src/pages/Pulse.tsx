import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Sparkles,
  Pause,
  Play,
  Camera,
  ExternalLink,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  useRealtimeTransactions,
  type Transaction,
} from "@/hooks/useRealtimeTransactions";
import { PulseCanvas } from "@/components/pulse/PulseCanvas";
import type { Mode } from "@/components/pulse/positioning";
import aptosLogo from "@/assets/aptos-logo.png";

const LEGEND: { label: string; cssVar: string }[] = [
  { label: "Transfer", cssVar: "--chart-1" },
  { label: "Swap", cssVar: "--chart-5" },
  { label: "Stake", cssVar: "--chart-3" },
  { label: "NFT", cssVar: "--chart-4" },
  { label: "Contract", cssVar: "--chart-2" },
  { label: "Other", cssVar: "--primary" },
];

const MODES: { value: Mode; label: string }[] = [
  { value: "garden", label: "Garden" },
  { value: "stream", label: "Stream" },
  { value: "constellation", label: "Constellation" },
];

export default function PulsePage() {
  const { transactions, stats, isConnected } = useRealtimeTransactions();
  const [mode, setMode] = useState<Mode>("garden");
  const [paused, setPaused] = useState(false);
  const [density, setDensity] = useState(250);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const snapshotRef = useRef<() => void>(() => {});

  const recent = transactions.slice(0, 5);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 backdrop-blur-xl bg-background/70">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <img src={aptosLogo} alt="Aptos" className="w-7 h-7" />
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Aptos Pulse
            </h1>
          </div>

          <div className="flex items-center gap-1 rounded-md border border-border/60 bg-card/40 p-0.5">
            {MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={`text-xs px-3 py-1 rounded-sm transition-colors ${
                  mode === m.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span className="font-medium">{Math.round(stats.tps)}</span>
              <span className="text-muted-foreground">TPS</span>
            </div>
            <div className="w-px h-4 bg-border/60" />
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
                }`}
              />
              <span className="text-muted-foreground">
                {isConnected ? "Live" : "Connecting"}
              </span>
            </div>
            <ThemeToggle />
            <Link to="/globe">
              <Button variant="outline" size="sm" className="h-8 text-xs">
                Globe
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Canvas + overlays */}
      <div className="relative h-[calc(100vh-65px)]">
        <PulseCanvas
          transactions={transactions}
          mode={mode}
          density={density}
          paused={paused}
          tps={stats.tps}
          onSelect={setSelected}
          registerSnapshot={(fn) => {
            snapshotRef.current = fn;
          }}
        />

        {/* Legend */}
        <Card className="absolute top-4 left-4 bg-card/40 backdrop-blur-xl border-border/50 w-[180px]">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Legend
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-1.5">
            {LEGEND.map((l) => (
              <div key={l.label} className="flex items-center gap-2 text-xs">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: `hsl(var(${l.cssVar}))` }}
                />
                <span className="text-foreground">{l.label}</span>
              </div>
            ))}
            <div className="pt-2 mt-2 border-t border-border/40 text-[10px] text-muted-foreground leading-relaxed">
              Size = gas · Stroke = APT amount · Position = sender
            </div>
          </CardContent>
        </Card>

        {/* Recent feed */}
        <Card className="absolute top-4 right-4 bg-card/40 backdrop-blur-xl border-border/50 w-[260px] hidden md:block">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Recent Blooms
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-1.5">
            {recent.length === 0 && (
              <div className="text-xs text-muted-foreground">Waiting…</div>
            )}
            {recent.map((tx) => (
              <button
                key={tx.hash}
                onClick={() => setSelected(tx)}
                className="w-full flex items-center justify-between gap-2 text-xs hover:bg-accent/30 rounded px-1.5 py-1 transition-colors text-left"
              >
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                  {tx.type}
                </Badge>
                <span className="font-mono text-muted-foreground truncate flex-1">
                  {tx.hash.slice(0, 8)}…
                </span>
                {tx.amount > 0 && (
                  <span className="text-primary text-[10px] shrink-0">
                    {tx.amount.toFixed(2)}
                  </span>
                )}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Bottom controls */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-card/50 backdrop-blur-xl border border-border/50 rounded-full px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2"
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span className="text-xs">{paused ? "Resume" : "Pause"}</span>
          </Button>
          <div className="w-px h-5 bg-border/60" />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2"
            onClick={() => snapshotRef.current?.()}
          >
            <Camera className="w-3.5 h-3.5" />
            <span className="text-xs">Snapshot</span>
          </Button>
          <div className="w-px h-5 bg-border/60" />
          <div className="flex items-center gap-2 min-w-[160px]">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Density
            </span>
            <Slider
              value={[density]}
              min={50}
              max={500}
              step={10}
              onValueChange={(v) => setDensity(v[0])}
              className="w-24"
            />
            <span className="text-xs font-mono w-8 text-right">{density}</span>
          </div>
        </div>

        {/* Selected detail */}
        {selected && (
          <Card className="absolute bottom-20 left-4 max-w-md bg-card/90 backdrop-blur-xl border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Transaction</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(null)}
                  className="h-6 w-6 p-0"
                >
                  ×
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <Badge variant="secondary">{selected.type}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={selected.success ? "default" : "destructive"}>
                  {selected.success ? "Success" : "Failed"}
                </Badge>
              </div>
              {selected.amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="text-primary font-medium">
                    {selected.amount.toFixed(4)} APT
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gas</span>
                <span>{selected.gasCost.toFixed(6)} APT</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground">Sender</span>
                <span className="font-mono truncate max-w-[200px]">
                  {selected.sender.slice(0, 10)}…{selected.sender.slice(-6)}
                </span>
              </div>
              <a
                href={`https://explorer.aptoslabs.com/txn/${selected.hash}?network=mainnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline pt-1"
              >
                View on Explorer <ExternalLink className="w-3 h-3" />
              </a>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}