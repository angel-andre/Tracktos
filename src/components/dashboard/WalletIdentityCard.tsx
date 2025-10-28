import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Trophy, Star, Shield, Zap, Activity, TrendingUp, Image, 
  GalleryHorizontal, Layers, Crown, Gem, Wallet as WalletIcon, 
  Compass, Coins, Heart, Fuel, Flame, Calendar, Flame as Gas, HelpCircle
} from "lucide-react";

interface WalletIdentityData {
  activeDays: number;
  totalGasSpent: string;
  badges: Array<{
    name: string;
    description: string;
    icon: string;
  }>;
}

interface WalletIdentityCardProps {
  data: WalletIdentityData | null;
  loading: boolean;
  walletAge?: string;
  transactionCount: number;
  portfolioValue?: number;
  tokenCount?: number;
}

const iconMap: Record<string, any> = {
  trophy: Trophy,
  star: Star,
  shield: Shield,
  zap: Zap,
  activity: Activity,
  'trending-up': TrendingUp,
  image: Image,
  'gallery-horizontal': GalleryHorizontal,
  layers: Layers,
  crown: Crown,
  gem: Gem,
  wallet: WalletIcon,
  compass: Compass,
  coins: Coins,
  heart: Heart,
  fuel: Fuel,
  flame: Flame,
};

const getWalletAge = (firstTxTimestamp?: string): string => {
  if (!firstTxTimestamp) return 'Unknown';
  
  const firstTx = new Date(firstTxTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - firstTx.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 30) {
    return `${diffDays} days`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months > 1 ? 's' : ''}`;
  } else {
    const years = Math.floor(diffDays / 365);
    const remainingMonths = Math.floor((diffDays % 365) / 30);
    if (remainingMonths > 0) {
      return `${years} year${years > 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
    }
    return `${years} year${years > 1 ? 's' : ''}`;
  }
};

const calculatePercentile = (value: number, thresholds: number[]): number => {
  for (let i = 0; i < thresholds.length; i++) {
    if (value >= thresholds[i]) {
      return i + 1;
    }
  }
  return thresholds.length + 1;
};

const getPercentileLabel = (percentile: number): { text: string; color: string } => {
  if (percentile === 1) return { text: 'Top 1%', color: 'text-amber-400' };
  if (percentile === 2) return { text: 'Top 5%', color: 'text-amber-500' };
  if (percentile === 3) return { text: 'Top 10%', color: 'text-orange-500' };
  if (percentile === 4) return { text: 'Top 25%', color: 'text-blue-500' };
  if (percentile === 5) return { text: 'Top 50%', color: 'text-green-500' };
  return { text: 'Active', color: 'text-muted-foreground' };
};

export function WalletIdentityCard({ 
  data, 
  loading, 
  walletAge, 
  transactionCount,
  portfolioValue = 0,
  tokenCount = 0
}: WalletIdentityCardProps) {
  if (loading) {
    return (
      <Card className="backdrop-blur-xl bg-card/50 border-border/50">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const gasSpent = parseFloat(data.totalGasSpent || '0');
  const displayWalletAge = getWalletAge(walletAge);

  // Calculate percentile rankings based on thresholds
  // Portfolio Value: Top 1% = $100k+, Top 5% = $50k+, Top 10% = $10k+, Top 25% = $1k+, Top 50% = $100+
  const portfolioPercentile = calculatePercentile(portfolioValue, [100000, 50000, 10000, 1000, 100]);
  
  // Transaction Count: Top 1% = 10k+, Top 5% = 5k+, Top 10% = 1k+, Top 25% = 500+, Top 50% = 100+
  const txPercentile = calculatePercentile(transactionCount, [10000, 5000, 1000, 500, 100]);
  
  // Active Days: Top 1% = 365+, Top 5% = 180+, Top 10% = 90+, Top 25% = 30+, Top 50% = 7+
  const activityPercentile = calculatePercentile(data.activeDays, [365, 180, 90, 30, 7]);
  
  // Gas Spent: Top 1% = 100+, Top 5% = 50+, Top 10% = 20+, Top 25% = 10+, Top 50% = 1+
  const gasPercentile = calculatePercentile(gasSpent, [100, 50, 20, 10, 1]);
  
  // Token Diversity: Top 1% = 50+, Top 5% = 25+, Top 10% = 15+, Top 25% = 10+, Top 50% = 5+
  const diversityPercentile = calculatePercentile(tokenCount, [50, 25, 15, 10, 5]);

  const portfolioLabel = getPercentileLabel(portfolioPercentile);
  const txLabel = getPercentileLabel(txPercentile);
  const activityLabel = getPercentileLabel(activityPercentile);
  const gasLabel = getPercentileLabel(gasPercentile);
  const diversityLabel = getPercentileLabel(diversityPercentile);

  return (
    <Card className="backdrop-blur-xl bg-card/50 border-border/50 shadow-xl overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          <CardTitle>Wallet Milestones</CardTitle>
        </div>
        <CardDescription>Your journey through the Aptos ecosystem</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-background/50 rounded-lg p-4 border border-border/30">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Calendar className="w-4 h-4" />
              <span>Wallet Age</span>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {displayWalletAge}
            </div>
          </div>

          <div className="bg-background/50 rounded-lg p-4 border border-border/30">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Activity className="w-4 h-4" />
              <span>Active Days</span>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {data.activeDays}
            </div>
          </div>

          <div className="bg-background/50 rounded-lg p-4 border border-border/30">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <TrendingUp className="w-4 h-4" />
              <span>Transactions</span>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {transactionCount.toLocaleString()}
            </div>
          </div>

          <div className="bg-background/50 rounded-lg p-4 border border-border/30">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Gas className="w-4 h-4" />
              <span>Gas Spent</span>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {gasSpent.toFixed(2)} APT
            </div>
          </div>
        </div>

        {/* Comparative Rankings */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" />
            Comparative Rankings
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="space-y-2 text-xs">
                    <p className="font-semibold">How Rankings are Calculated:</p>
                    <div className="space-y-1">
                      <p><strong>Portfolio:</strong> Top 1% = $100k+, Top 5% = $50k+, Top 10% = $10k+</p>
                      <p><strong>Transactions:</strong> Top 1% = 10k+, Top 5% = 5k+, Top 10% = 1k+</p>
                      <p><strong>Activity:</strong> Top 1% = 365+ days, Top 5% = 180+ days, Top 10% = 90+ days</p>
                      <p><strong>Gas:</strong> Top 1% = 100+ APT, Top 5% = 50+ APT, Top 10% = 20+ APT</p>
                      <p><strong>Tokens:</strong> Top 1% = 50+ tokens, Top 5% = 25+ tokens, Top 10% = 15+ tokens</p>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {portfolioValue > 0 && (
              <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Portfolio Value</span>
                  <span className={`text-sm font-bold ${portfolioLabel.color}`}>
                    {portfolioLabel.text}
                  </span>
                </div>
              </div>
            )}
            
            {transactionCount > 0 && (
              <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Transaction Volume</span>
                  <span className={`text-sm font-bold ${txLabel.color}`}>
                    {txLabel.text}
                  </span>
                </div>
              </div>
            )}
            
            {data.activeDays > 0 && (
              <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Activity Level</span>
                  <span className={`text-sm font-bold ${activityLabel.color}`}>
                    {activityLabel.text}
                  </span>
                </div>
              </div>
            )}
            
            {gasSpent > 0 && (
              <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Gas Contribution</span>
                  <span className={`text-sm font-bold ${gasLabel.color}`}>
                    {gasLabel.text}
                  </span>
                </div>
              </div>
            )}
            
            {tokenCount > 0 && (
              <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Token Diversity</span>
                  <span className={`text-sm font-bold ${diversityLabel.color}`}>
                    {diversityLabel.text}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Badges */}
        {data.badges.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Star className="w-4 h-4 text-primary" />
              Achievement Badges
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.badges.map((badge, index) => {
                const Icon = iconMap[badge.icon] || Star;
                return (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="px-3 py-2 text-sm flex items-center gap-2 bg-primary/10 border-primary/30 hover:bg-primary/20 transition-colors"
                  >
                    <Icon className="w-4 h-4" />
                    <div className="flex flex-col items-start">
                      <span className="font-semibold">{badge.name}</span>
                      <span className="text-xs text-muted-foreground">{badge.description}</span>
                    </div>
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {data.badges.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Star className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Keep using Aptos to unlock achievement badges!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
