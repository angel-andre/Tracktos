import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Clock, Timer } from "lucide-react";

interface EpochProgressProps {
  epoch: number;
  epochProgress: number;
}

export function EpochProgress({ epoch, epochProgress }: EpochProgressProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  
  // Aptos epochs are approximately 2 hours
  const EPOCH_DURATION_SECONDS = 2 * 60 * 60;
  
  useEffect(() => {
    const remainingPercentage = 100 - epochProgress;
    const remainingSeconds = Math.floor((remainingPercentage / 100) * EPOCH_DURATION_SECONDS);
    
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;
    
    if (hours > 0) {
      setTimeRemaining(`${hours}h ${minutes}m`);
    } else if (minutes > 0) {
      setTimeRemaining(`${minutes}m ${seconds}s`);
    } else {
      setTimeRemaining(`${seconds}s`);
    }
  }, [epochProgress]);

  // Calculate color based on progress
  const getProgressColor = () => {
    if (epochProgress > 90) return "bg-red-500";
    if (epochProgress > 75) return "bg-yellow-500";
    return "bg-primary";
  };

  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Current Epoch</span>
          </div>
          <span className="text-lg font-bold text-foreground">{epoch.toLocaleString()}</span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="relative h-3 bg-muted/30 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${getProgressColor()}`}
              style={{ width: `${epochProgress}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-medium text-foreground drop-shadow-sm">
                {epochProgress.toFixed(1)}%
              </span>
            </div>
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
          <span>Validators rotate on epoch change</span>
        </div>
      </CardContent>
    </Card>
  );
}
