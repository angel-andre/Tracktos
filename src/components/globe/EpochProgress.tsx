import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Timer } from "lucide-react";

interface EpochProgressProps {
  epoch: number;
  /** 0-100, computed live from on-chain reconfiguration timestamp. */
  progress: number;
  /** Length of the current epoch in seconds (Aptos ~7200s). */
  intervalSeconds: number;
  /** Seconds elapsed since the last reconfiguration. */
  elapsedSeconds: number;
}

export function EpochProgress({ epoch, progress, intervalSeconds, elapsedSeconds }: EpochProgressProps) {
  const { epochProgress, timeRemaining } = useMemo(() => {
    if (!intervalSeconds || intervalSeconds <= 0) {
      return { epochProgress: 0, timeRemaining: "Calculating..." };
    }
    const remaining = Math.max(0, intervalSeconds - elapsedSeconds);
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = Math.floor(remaining % 60);
    const timeStr = hours > 0 ? `${hours}h ${minutes}m` : minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    return { epochProgress: progress, timeRemaining: timeStr };
  }, [progress, intervalSeconds, elapsedSeconds]);

  // Calculate color based on progress
  const getProgressColor = () => {
    if (epochProgress > 90) return "bg-red-500";
    if (epochProgress > 75) return "bg-yellow-500";
    return "bg-primary";
  };

  const isLoading = !intervalSeconds || intervalSeconds <= 0;

  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Current Epoch</span>
          </div>
          <span className="text-lg font-bold text-foreground">
            {epoch > 0 ? epoch.toLocaleString() : "—"}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="relative h-3 bg-muted/30 rounded-full overflow-hidden">
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground">Loading...</span>
              </div>
            ) : (
              <>
                <div 
                  className={`h-full transition-all duration-500 ${getProgressColor()}`}
                  style={{ width: `${epochProgress}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-medium text-foreground drop-shadow-sm">
                    {epochProgress.toFixed(1)}%
                  </span>
                </div>
              </>
            )}
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Timer className="w-3 h-3" />
              <span>Time remaining:</span>
            </div>
            <span className="font-mono text-foreground font-medium">{timeRemaining}</span>
          </div>
        </div>

        {/* Epoch Info */}
        <div className="flex justify-between mt-3 pt-2 border-t border-border/30 text-[10px] text-muted-foreground">
          <span>~2 hour epochs</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            Live from blockchain
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
