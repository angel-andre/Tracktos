import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Music2,
  Pause,
  Play,
  Camera,
  ExternalLink,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
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
import { MODES, MODE_BY_ID, GROUPS, type Mode } from "@/components/pulse/modes";
import { useAudioEngine } from "@/components/pulse/useAudioEngine";
import { AudioControls } from "@/components/pulse/AudioControls";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import aptosLogo from "@/assets/aptos-logo.png";

const LEGEND: { label: string; cssVar: string }[] = [
  { label: "Transfer", cssVar: "--chart-1" },
  { label: "Swap", cssVar: "--chart-5" },
  { label: "Stake", cssVar: "--chart-3" },
  { label: "NFT", cssVar: "--chart-4" },
  { label: "Contract", cssVar: "--chart-2" },
  { label: "Other", cssVar: "--primary" },
];

export default function PulsePage() {
  const {
    transactions,
    stats,
    isConnected,
    lastBurst,
    failureRate,
    blockTick,
  } = useRealtimeTransactions();
  const [mode, setMode] = useState<Mode>("garden");
  const [paused, setPaused] = useState(false);
  const [density, setDensity] = useState(40);
  const [speed, setSpeed] = useState(1);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const snapshotRef = useRef<() => void>(() => {});
  const [whaleAt, setWhaleAt] = useState<number | undefined>();
  const seenWhaleHashesRef = useRef<Set<string>>(new Set());
  const audio = useAudioEngine({ transactions, mode, lastBurst });
  const activeMode = MODE_BY_ID[mode];
  const ActiveIcon = activeMode.icon;

  const recent = transactions.slice(0, 5);

  // Detect whale txs in incoming bursts and trigger a moment.
  useEffect(() => {
    if (!lastBurst) return;
    for (const tx of lastBurst.txs) {
      if (seenWhaleHashesRef.current.has(tx.hash)) continue;
      if (tx.whale || tx.amount >= 1000) {
        seenWhaleHashesRef.current.add(tx.hash);
        setWhaleAt(Date.now());
        toast(`Whale moved ${tx.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} APT`, {
          description: `${tx.type} · ${tx.hash.slice(0, 10)}…`,
          action: {
            label: "Explorer",
            onClick: () =>
              window.open(
                `https://explorer.aptoslabs.com/txn/${tx.hash}?network=mainnet`,
                "_blank",
              ),
          },
        });
        break; // one toast per burst is plenty
      }
    }
  }, [lastBurst]);

  // Epoch progress — derived from ledger timestamp ticking inside a 2hr window.
  // Aptos epochs are roughly 2 hours; we can't read epoch start here, so we
  // approximate from epoch number changes: the ring fills as ledger time
  // advances, resets visually when epoch increments.
  const epochProgress = useMemo(() => {
    const tsMicro = parseInt(stats.ledgerTimestamp || "0");
    if (!tsMicro) return 0;
    const tsMs = tsMicro / 1000;
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    const within = tsMs % TWO_HOURS;
    return within / TWO_HOURS;
  }, [stats.ledgerTimestamp]);

  // Snapshot with HUD watermark burned in.
  const handleSnapshot = () => {
    const inner = snapshotRef.current;
    if (!inner) return;
    // Locate the canvas element and draw an overlay before exporting.
    const canvas = document.querySelector<HTMLCanvasElement>(
      "canvas.cursor-crosshair",
    );
    if (!canvas) {
      inner();
      return;
    }
    // Build a composite image of canvas + watermark.
    const out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext("2d");
    if (!ctx) {
      inner();
      return;
    }
    ctx.drawImage(canvas, 0, 0);
    // Watermark
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pad = 16 * dpr;
    const lh = 16 * dpr;
    const lines = [
      `Aptos Pulse · ${activeMode.label}`,
      `Ledger ${Number(stats.latestVersion).toLocaleString()}`,
      `Block ${Number(stats.blockHeight).toLocaleString()}  ·  ${stats.tps.toFixed(1)} TPS`,
      `${new Date().toISOString()}`,
      `tracktos.com`,
    ];
    ctx.font = `${11 * dpr}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    const maxW = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const boxW = maxW + pad * 2;
    const boxH = lh * lines.length + pad;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(out.width - boxW - pad, out.height - boxH - pad, boxW, boxH);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    lines.forEach((line, i) => {
      ctx.fillText(
        line,
        out.width - boxW - pad + pad,
        out.height - boxH - pad + pad + (i + 0.4) * lh,
      );
    });
    const url = out.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `aptos-pulse-${Date.now()}.png`;
    a.click();
    toast.success("Snapshot saved");
  };

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
              <Music2 className="w-4 h-4 text-primary" />
              Aptos Pulse
            </h1>
          </div>

          <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <SelectTrigger className="h-8 w-[200px] text-xs bg-card/40 border-border/60">
              <SelectValue placeholder="Visualization" />
            </SelectTrigger>
            <SelectContent>
              {GROUPS.map((group) => {
                const items = MODES.filter((m) => m.group === group);
                return (
                  <SelectGroup key={group}>
                    <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {group}
                    </SelectLabel>
                    {items.map((m) => {
                      const Icon = m.icon;
                      return (
                        <SelectItem key={m.id} value={m.id} className="text-xs">
                          <div className="flex items-center gap-2">
                            <Icon className="w-3.5 h-3.5" />
                            <span>{m.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                );
              })}
            </SelectContent>
          </Select>

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
          speed={speed}
          lastBurst={lastBurst}
          versionDelta={lastBurst?.versionDelta}
          rendered={lastBurst?.rendered}
          blockTickAt={blockTick?.at}
          epochProgress={epochProgress}
          whaleAt={whaleAt}
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
              {activeMode.description}
            </div>
            <div className="pt-2 mt-2 border-t border-border/40 space-y-1 font-mono text-[10px]">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">LEDGER</span>
                <span className="text-foreground">
                  {Number(stats.latestVersion).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">BLOCK</span>
                <span className="text-foreground">
                  {Number(stats.blockHeight).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">TPS</span>
                <span className="text-primary">{stats.tps.toFixed(1)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">FAIL %</span>
                <span
                  className={
                    failureRate > 0.15
                      ? "text-destructive"
                      : failureRate > 0.05
                      ? "text-yellow-500"
                      : "text-foreground"
                  }
                >
                  {(failureRate * 100).toFixed(1)}%
                </span>
              </div>
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
            onClick={handleSnapshot}
          >
            <Camera className="w-3.5 h-3.5" />
            <span className="text-xs">Snapshot</span>
          </Button>
          <div className="w-px h-5 bg-border/60" />
          <div className="flex items-center gap-2 min-w-[160px]">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Flows
            </span>
            <Slider
              value={[density]}
              min={10}
              max={80}
              step={5}
              onValueChange={(v) => setDensity(v[0])}
              className="w-24"
            />
            <span className="text-xs font-mono w-8 text-right">{density}</span>
          </div>
          <div className="w-px h-5 bg-border/60" />
          <div className="flex items-center gap-2 min-w-[140px]">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Speed
            </span>
            <Slider
              value={[Math.round(speed * 10)]}
              min={5}
              max={20}
              step={1}
              onValueChange={(v) => setSpeed(v[0] / 10)}
              className="w-20"
            />
            <span className="text-xs font-mono w-9 text-right">{speed.toFixed(1)}×</span>
          </div>
          <div className="w-px h-5 bg-border/60" />
          <AudioControls
            muted={audio.muted}
            volume={audio.volume}
            voice={audio.voice}
            onToggleMute={() => audio.setMuted(!audio.muted)}
            onVolumeChange={audio.setVolume}
            onVoiceChange={audio.setVoice}
          />
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