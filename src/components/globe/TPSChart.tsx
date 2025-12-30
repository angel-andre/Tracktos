import { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, TrendingUp, TrendingDown } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis } from "recharts";

interface TPSChartProps {
  currentTPS: number;
  peakTPS: number;
}

interface TPSDataPoint {
  time: number;
  tps: number;
}

export function TPSChart({ currentTPS, peakTPS }: TPSChartProps) {
  const [history, setHistory] = useState<TPSDataPoint[]>([]);
  const lastTPS = useRef<number>(0);
  const trend = currentTPS > lastTPS.current ? "up" : currentTPS < lastTPS.current ? "down" : "stable";

  useEffect(() => {
    lastTPS.current = currentTPS;
    
    setHistory(prev => {
      const now = Date.now();
      const newPoint = { time: now, tps: currentTPS };
      const updated = [...prev, newPoint];
      
      // Keep last 30 data points (about 90 seconds at 3s intervals)
      if (updated.length > 30) {
        return updated.slice(-30);
      }
      return updated;
    });
  }, [currentTPS]);

  const avgTPS = history.length > 0 
    ? Math.round(history.reduce((sum, p) => sum + p.tps, 0) / history.length)
    : currentTPS;

  const maxTPS = history.length > 0
    ? Math.max(...history.map(p => p.tps))
    : currentTPS;

  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Live TPS</span>
          </div>
          <Badge variant="outline" className="text-[10px] animate-pulse">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1" />
            LIVE
          </Badge>
        </div>

        {/* Current TPS Display */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">{Math.round(currentTPS)}</span>
            <span className="text-sm text-muted-foreground">tx/s</span>
            {trend === "up" && <TrendingUp className="w-4 h-4 text-green-500" />}
            {trend === "down" && <TrendingDown className="w-4 h-4 text-red-500" />}
          </div>
          <div className="text-right text-xs">
            <p className="text-muted-foreground">Peak: <span className="text-foreground font-medium">{peakTPS.toLocaleString()}</span></p>
          </div>
        </div>

        {/* Sparkline Chart */}
        <div className="h-16 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="tpsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [`${value} tx/s`, 'TPS']}
                labelFormatter={() => ''}
              />
              <Area
                type="monotone"
                dataKey="tps"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#tpsGradient)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Stats Row */}
        <div className="flex justify-between mt-2 pt-2 border-t border-border/30 text-xs">
          <div>
            <span className="text-muted-foreground">Avg:</span>
            <span className="text-foreground font-medium ml-1">{avgTPS}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Max (session):</span>
            <span className="text-foreground font-medium ml-1">{Math.round(maxTPS)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
