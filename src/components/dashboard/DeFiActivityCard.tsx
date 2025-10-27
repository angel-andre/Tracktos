import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRightLeft, TrendingUp, Coins, Building2 } from "lucide-react";
import { formatNumber } from "@/lib/formatters";

interface DeFiActivity {
  swapHistory: { timestamp: string; protocol: string; fromToken: string; toToken: string; fromAmount: string; toAmount: string; volumeUsd: number }[];
  protocolVolumes: { protocol: string; type: string; volumeUsd: number; txCount: number }[];
  stakingActivities: { protocol: string; action: string; amount: string; timestamp: string }[];
  totalDefiVolumeUsd: number;
  uniqueProtocols: number;
}

interface DeFiActivityCardProps {
  defiActivity: DeFiActivity | null;
}

const getProtocolTypeColor = (type: string) => {
  switch (type.toLowerCase()) {
    case 'dex':
      return 'bg-blue-500/10 text-blue-500 border-blue-500/30';
    case 'lending':
      return 'bg-purple-500/10 text-purple-500 border-purple-500/30';
    case 'staking':
      return 'bg-green-500/10 text-green-500 border-green-500/30';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

export const DeFiActivityCard = ({ defiActivity }: DeFiActivityCardProps) => {
  if (!defiActivity) return null;

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          DeFi Activity Tracker
        </CardTitle>
        <CardDescription>Protocol interactions, swaps, and staking history</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        
        {/* DeFi Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-background/50 rounded-lg p-4 border border-border/30">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Coins className="w-4 h-4" />
              <span>Total DeFi Volume</span>
            </div>
            <div className="text-2xl font-bold text-foreground">
              ${formatNumber(defiActivity.totalDefiVolumeUsd, 2)}
            </div>
          </div>

          <div className="bg-background/50 rounded-lg p-4 border border-border/30">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Building2 className="w-4 h-4" />
              <span>Protocols Used</span>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {defiActivity.uniqueProtocols}
            </div>
          </div>

          <div className="bg-background/50 rounded-lg p-4 border border-border/30">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <ArrowRightLeft className="w-4 h-4" />
              <span>Total Swaps</span>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {defiActivity.swapHistory.length}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Protocol Volumes */}
          <div>
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Top Protocols by Volume
            </h3>
            {defiActivity.protocolVolumes.length > 0 ? (
              <div className="space-y-3">
                {defiActivity.protocolVolumes.slice(0, 5).map((protocol, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                        #{idx + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{protocol.protocol}</p>
                        <Badge className={`mt-1 ${getProtocolTypeColor(protocol.type)}`}>
                          {protocol.type}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${formatNumber(protocol.volumeUsd, 2)}</p>
                      <p className="text-xs text-muted-foreground">{protocol.txCount} txs</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">No protocol interactions found</p>
            )}
          </div>

          {/* Recent Swaps */}
          <div>
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Recent Swap History
            </h3>
            {defiActivity.swapHistory.length > 0 ? (
              <div className="space-y-3">
                {defiActivity.swapHistory.slice(0, 5).map((swap, idx) => (
                  <div key={idx} className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary" className="text-xs">
                        {swap.protocol}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(swap.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{formatNumber(swap.fromAmount, 4)} {swap.fromToken}</span>
                      <ArrowRightLeft className="w-3 h-3 text-muted-foreground" />
                      <span className="font-medium">{formatNumber(swap.toAmount, 4)} {swap.toToken}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Volume: ${formatNumber(swap.volumeUsd, 2)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">No swap history found</p>
            )}
          </div>
        </div>

        {/* Staking Activities */}
        {defiActivity.stakingActivities.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Recent Staking Activities
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {defiActivity.stakingActivities.slice(0, 6).map((activity, idx) => (
                <div key={idx} className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant={activity.action === 'Stake' ? 'default' : 'secondary'} className="text-xs">
                      {activity.action}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(activity.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{activity.protocol}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatNumber(activity.amount, 4)} APT
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
};