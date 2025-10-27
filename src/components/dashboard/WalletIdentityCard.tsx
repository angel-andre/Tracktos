import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  Trophy, Star, Shield, Zap, Activity, TrendingUp, Image, 
  GalleryHorizontal, Layers, Crown, Gem, Wallet as WalletIcon, 
  Compass, Coins, Heart, Fuel, Flame, Calendar, Flame as Gas
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

export function WalletIdentityCard({ data, loading, walletAge, transactionCount }: WalletIdentityCardProps) {
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
