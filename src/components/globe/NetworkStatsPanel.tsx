import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Coins, 
  TrendingUp
} from "lucide-react";
import type { NetworkStats } from "@/hooks/useValidatorNodes";

interface NetworkStatsPanelProps {
  stats: NetworkStats;
}

function formatNumber(num: number): string {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toLocaleString();
}

export function NetworkStatsPanel({ stats }: NetworkStatsPanelProps) {
  return (
    <div className="space-y-3 p-4">
      {/* Staking Stats */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Total Staked</span>
            <Badge variant="outline" className="text-[10px] ml-auto">Static</Badge>
          </div>
          <p className="text-xl font-bold text-foreground mb-1">
            {formatNumber(stats.totalStaked)} <span className="text-sm font-normal text-muted-foreground">APT</span>
          </p>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3 h-3 text-green-500" />
            <span className="text-xs text-green-500">{stats.aprReward}% APR Reward</span>
          </div>
        </CardContent>
      </Card>

      {/* Total Supply */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Coins className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Total Supply</span>
            <Badge variant="outline" className="text-[10px] ml-auto">Static</Badge>
          </div>
          <p className="text-lg font-bold text-foreground">
            {formatNumber(stats.totalSupply)} <span className="text-sm font-normal text-muted-foreground">APT</span>
          </p>
        </CardContent>
      </Card>
      
      {/* Static data indicator */}
      <p className="text-[10px] text-muted-foreground text-center">
        Staking data from Aptos Explorer • Dec 2024
      </p>
    </div>
  );
}
