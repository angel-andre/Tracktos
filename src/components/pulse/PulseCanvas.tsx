import { useCallback, useEffect, useState } from "react";
import { useFlowEngine } from "./useFlowEngine";
import type { Transaction } from "@/hooks/useRealtimeTransactions";
import type { Mode } from "./modes";

interface Props {
  transactions: Transaction[];
  mode: Mode;
  density: number;
  paused: boolean;
  tps: number;
  speed: number;
  lastBurst: { txs: Transaction[]; ledgerVersion: string; at: number } | null;
  onSelect: (tx: Transaction | null) => void;
  registerSnapshot?: (fn: () => void) => void;
  versionDelta?: number;
  rendered?: number;
  blockTickAt?: number;
  epochProgress?: number;
  whaleAt?: number;
}

export function PulseCanvas({
  transactions,
  mode,
  density,
  paused,
  tps,
  speed,
  lastBurst,
  onSelect,
  registerSnapshot,
  versionDelta,
  rendered,
  blockTickAt,
  epochProgress,
  whaleAt,
}: Props) {
  const engine = useFlowEngine({
    transactions,
    mode,
    maxFlows: density,
    paused,
    tps,
    speed,
    burstAt: lastBurst?.at,
    versionDelta,
    rendered,
    blockTickAt,
    epochProgress,
    whaleAt,
  });

  if (registerSnapshot) registerSnapshot(engine.snapshot);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const c = engine.canvasRef.current;
      if (!c) return;
      const rect = c.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // Prefer the currently-hovered transaction (works for any flow).
      if (engine.hoverInfo) {
        onSelect(engine.hoverInfo.tx);
        return;
      }
      const a = engine.getAnchorAt(x, y);
      if (!a) {
        onSelect(null);
        return;
      }
      const recent = transactions.find(
        (t) => "src:" + t.sender === a.key || "dst:" + t.sender === a.key,
      );
      onSelect(recent ?? null);
    },
    [engine, onSelect, transactions],
  );

  const hover = engine.hoverInfo;
  // Clamp tooltip so it stays inside the canvas viewport.
  const TOOLTIP_W = 260;
  const TOOLTIP_H = 150;
  const canvasRect = engine.canvasRef.current?.getBoundingClientRect();
  const cw = canvasRect?.width ?? 0;
  const ch = canvasRect?.height ?? 0;
  let tipLeft = 0;
  let tipTop = 0;
  if (hover) {
    tipLeft = Math.min(Math.max(8, hover.x + 14), Math.max(8, cw - TOOLTIP_W - 8));
    tipTop = Math.min(Math.max(8, hover.y + 14), Math.max(8, ch - TOOLTIP_H - 8));
  }

  return (
    <>
      <canvas
        ref={engine.canvasRef}
        onClick={handleClick}
        className="absolute inset-0 w-full h-full cursor-crosshair"
      />
      <BurstChip burst={lastBurst} />
      {hover && (
        <HoverTooltip
          tx={hover.tx}
          left={tipLeft}
          top={tipTop}
          anchorX={hover.x}
          anchorY={hover.y}
        />
      )}
    </>
  );
}

function BurstChip({
  burst,
}: {
  burst: { txs: Transaction[]; ledgerVersion: string; at: number } | null;
}) {
  // Show for 1.6s after each burst.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!burst) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 100);
    const off = setTimeout(() => clearInterval(id), 1800);
    return () => {
      clearInterval(id);
      clearTimeout(off);
    };
  }, [burst?.at]);
  if (!burst) return null;
  const age = now - burst.at;
  if (age > 1600) return null;
  const opacity = Math.max(0, 1 - age / 1600);
  const ledger = Number(burst.ledgerVersion).toLocaleString();
  return (
    <div
      className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 z-20"
      style={{ opacity }}
    >
      <div className="rounded-full border border-primary/40 bg-card/90 backdrop-blur-xl px-3 py-1.5 text-[11px] flex items-center gap-2 shadow-lg">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        <span className="font-medium">+{burst.txs.length} txns</span>
        <span className="text-muted-foreground">@ ledger</span>
        <span className="font-mono text-primary">{ledger}</span>
      </div>
    </div>
  );
}

function HoverTooltip({
  tx,
  left,
  top,
  anchorX,
  anchorY,
}: {
  tx: Transaction;
  left: number;
  top: number;
  anchorX: number;
  anchorY: number;
}) {
  const ageMs = Date.now() - tx.timestamp;
  const ageStr =
    ageMs < 1000
      ? "just now"
      : ageMs < 60_000
      ? `${Math.floor(ageMs / 1000)}s ago`
      : `${Math.floor(ageMs / 60_000)}m ago`;
  const fnLabel = tx.function
    ? tx.function.split("::").slice(0, 2).join("::")
    : "—";
  return (
    <>
      {/* Crosshair marker on the hovered element */}
      <div
        className="pointer-events-none absolute z-20"
        style={{ left: anchorX - 8, top: anchorY - 8 }}
      >
        <div className="w-4 h-4 rounded-full border border-primary/80 animate-pulse" />
      </div>
      <div
        className="pointer-events-none absolute z-30 w-[260px] rounded-lg border border-primary/40 bg-card/95 backdrop-blur-xl p-3 text-xs shadow-xl"
        style={{ left, top }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Live
            </span>
          </span>
          <span className="text-[10px] uppercase tracking-wider text-primary">
            {tx.type}
          </span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Hash</span>
            <span className="font-mono truncate max-w-[150px]" title={tx.hash}>
              {tx.hash.slice(0, 8)}…{tx.hash.slice(-6)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Sender</span>
            <span className="font-mono truncate max-w-[150px]" title={tx.sender}>
              {tx.sender.slice(0, 8)}…{tx.sender.slice(-6)}
            </span>
          </div>
          {tx.amount > 0 && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Amount</span>
              <span className="text-primary font-medium">
                {tx.amount.toFixed(4)} APT
              </span>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Gas</span>
            <span>{tx.gasCost.toFixed(6)} APT</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Function</span>
            <span className="font-mono truncate max-w-[150px]" title={tx.function}>
              {fnLabel}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Status</span>
            <span className={tx.success ? "text-green-500" : "text-red-500"}>
              {tx.success ? "Success" : "Failed"}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Seen</span>
            <span>{ageStr}</span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-border/40 text-[10px] text-muted-foreground">
          Click to pin · Live mainnet transaction
        </div>
      </div>
    </>
  );
}
