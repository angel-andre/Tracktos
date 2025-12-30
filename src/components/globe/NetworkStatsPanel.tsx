import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Globe, 
  Server, 
  Coins, 
  TrendingUp, 
  Zap, 
  Clock,
  MapPin,
  Building2
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
    <div className="space-y-4 p-4">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Server className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Validators</span>
            </div>
            <p className="text-xl font-bold text-foreground">{stats.totalValidators}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Fullnodes</span>
            </div>
            <p className="text-xl font-bold text-foreground">{stats.totalFullnodes}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Countries</span>
            </div>
            <p className="text-xl font-bold text-foreground">{stats.countries}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Cities</span>
            </div>
            <p className="text-xl font-bold text-foreground">{stats.cities}</p>
          </CardContent>
        </Card>
      </div>

      {/* TPS Stats */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">TPS</span>
            </div>
            <Badge variant="outline" className="text-xs">Real-time</Badge>
          </div>
          <div className="flex items-baseline gap-4">
            <div>
              <p className="text-2xl font-bold text-foreground">{Math.round(stats.tps)}</p>
              <p className="text-xs text-muted-foreground">Current</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-muted-foreground">{formatNumber(stats.peakTps)}</p>
              <p className="text-xs text-muted-foreground">Peak (30d)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Staking Stats */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Total Staked</span>
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

      {/* Epoch Progress */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Epoch {stats.epoch}</span>
            </div>
            <span className="text-xs text-muted-foreground">{stats.epochProgress.toFixed(0)}%</span>
          </div>
          <Progress value={stats.epochProgress} className="h-2" />
        </CardContent>
      </Card>

      {/* Total Supply */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Coins className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Total Supply</span>
          </div>
          <p className="text-lg font-bold text-foreground">
            {formatNumber(stats.totalSupply)} <span className="text-sm font-normal text-muted-foreground">APT</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
