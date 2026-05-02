import { useCallback } from "react";
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
  onSelect: (tx: Transaction | null) => void;
  registerSnapshot?: (fn: () => void) => void;
}

export function PulseCanvas({
  transactions,
  mode,
  density,
  paused,
  tps,
  speed,
  onSelect,
  registerSnapshot,
}: Props) {
  const engine = useFlowEngine({
    transactions,
    mode,
    maxFlows: density,
    paused,
    tps,
    speed,
  });

  if (registerSnapshot) registerSnapshot(engine.snapshot);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const c = engine.canvasRef.current;
      if (!c) return;
      const rect = c.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const a = engine.getAnchorAt(x, y);
      if (!a) {
        onSelect(null);
        return;
      }
      // Find a recent tx touching this anchor
      const recent = transactions.find(
        (t) => "src:" + t.sender === a.key || ("dst:" + t.sender === a.key),
      );
      onSelect(recent ?? null);
    },
    [engine, onSelect, transactions],
  );

  return (
    <canvas
      ref={engine.canvasRef}
      onClick={handleClick}
      className="absolute inset-0 w-full h-full cursor-crosshair"
    />
  );
}
