import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Timer, AlertCircle } from "lucide-react";

interface EpochProgressProps {
  epoch: number;
  ledgerTimestamp?: string; // Microseconds from Aptos API
}

// Aptos epoch duration is approximately 2 hours (7200 seconds)
const EPOCH_DURATION_SECONDS = 2 * 60 * 60;

export function EpochProgress({ epoch, ledgerTimestamp }: EpochProgressProps) {
  const [, setTick] = useState(0);
  
  // Calculate epoch progress from ledger timestamp
  // The ledger timestamp in microseconds tells us the current blockchain time
  // We estimate progress based on time within the current epoch cycle
  const { epochProgress, timeRemaining } = useMemo(() => {
    if (!ledgerTimestamp || ledgerTimestamp === "0") {
      return { epochProgress: 0, timeRemaining: "Calculating..." };
    }
    
    // Convert microseconds to seconds
    const ledgerTimeSeconds = parseInt(ledgerTimestamp) / 1_000_000;
    
    // Aptos epochs started at genesis (Oct 12, 2022)
    // Each epoch is ~2 hours. We calculate progress within current epoch
    // by finding position in the 2-hour cycle
    const secondsIntoEpoch = ledgerTimeSeconds % EPOCH_DURATION_SECONDS;
    const progress = (secondsIntoEpoch / EPOCH_DURATION_SECONDS) * 100;
    
    const remainingSeconds = EPOCH_DURATION_SECONDS - secondsIntoEpoch;
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = Math.floor(remainingSeconds % 60);
    
    let timeStr = "";
    if (hours > 0) {
      timeStr = `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      timeStr = `${minutes}m ${seconds}s`;
    } else {
      timeStr = `${seconds}s`;
    }
    
    return { epochProgress: progress, timeRemaining: timeStr };
  }, [ledgerTimestamp]);

  // Re-render every second for countdown
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate color based on progress
  const getProgressColor = () => {
    if (epochProgress > 90) return "bg-red-500";
    if (epochProgress > 75) return "bg-yellow-500";
    return "bg-primary";
  };

  const isLoading = !ledgerTimestamp || ledgerTimestamp === "0";

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
