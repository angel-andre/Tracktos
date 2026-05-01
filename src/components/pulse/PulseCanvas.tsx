import { useCallback } from "react";
import { useBloomEngine } from "./useBloomEngine";
import type { Transaction } from "@/hooks/useRealtimeTransactions";
import type { Mode } from "./positioning";

interface Props {
  transactions: Transaction[];
  mode: Mode;
  density: number;
  paused: boolean;
  tps: number;
  onSelect: (tx: Transaction | null) => void;
  registerSnapshot?: (fn: () => void) => void;
}

export function PulseCanvas({
  transactions,
  mode,
  density,
  paused,
  tps,
  onSelect,
  registerSnapshot,
}: Props) {
  const engine = useBloomEngine({ transactions, mode, density, paused, tps });

  if (registerSnapshot) registerSnapshot(engine.snapshot);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const c = engine.canvasRef.current;
      if (!c) return;
      const rect = c.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const found = engine.getBloomAt(x, y);
      onSelect(found ? found.tx : null);
    },
    [engine, onSelect],
  );

  return (
    <canvas
      ref={engine.canvasRef}
      onClick={handleClick}
      className="absolute inset-0 w-full h-full cursor-crosshair"
    />
  );
}