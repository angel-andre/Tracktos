import { Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTokenAmount, formatCount } from "@/lib/formatters";

interface AccountData {
  address: string;
  aptBalance: string;
  stakedApt: string;
  firstTransactionTimestamp?: string;
  lastTransactionTimestamp?: string;
}

interface AccountCardProps {
  data: AccountData | null;
  loading: boolean;
  transactionCount?: number;
  nftCount?: number;
  tokenCount?: number;
}

const calculateSentiment = (
  transactionCount: number,
  nftCount: number,
  tokenCount: number,
  stakedApt: number
): number => {
  // Calculate sentiment score (0-100)
  let score = 50; // neutral baseline
  
  // More transactions = more active = more bullish
  if (transactionCount > 10) score += 15;
  else if (transactionCount > 5) score += 10;
  else if (transactionCount > 2) score += 5;
  
  // NFT holdings indicate engagement
  if (nftCount > 8) score += 10;
  else if (nftCount > 4) score += 5;
  
  // Token diversity indicates active trading
  if (tokenCount > 15) score += 10;
  else if (tokenCount > 8) score += 5;
  
  // Staking indicates long-term holder (bullish)
  if (stakedApt > 50) score += 15;
  else if (stakedApt > 10) score += 10;
  else if (stakedApt > 0) score += 5;
  
  return Math.min(100, Math.max(0, score));
};

export function AccountCard({ data, loading, transactionCount = 0, nftCount = 0, tokenCount = 0 }: AccountCardProps) {
  const sentiment = data 
    ? calculateSentiment(transactionCount, nftCount, tokenCount, parseFloat(data.stakedApt))
    : 50;
  
  const getSentimentLabel = (score: number) => {
    if (score >= 75) return { text: "Very Bullish", color: "text-green-500" };
    if (score >= 60) return { text: "Bullish", color: "text-green-400" };
    if (score >= 40) return { text: "Neutral", color: "text-yellow-500" };
    if (score >= 25) return { text: "Bearish", color: "text-orange-500" };
    return { text: "Very Bearish", color: "text-red-500" };
  };
  
  const sentimentLabel = getSentimentLabel(sentiment);

  if (loading) {
    return (
      <Card className="backdrop-blur-xl bg-card/50 border-border/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <div className="p-2 rounded-lg bg-primary/10">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            Account Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="backdrop-blur-xl bg-card/50 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <div className="p-2 rounded-lg bg-primary/10">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          Account Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data ? (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-secondary/50 backdrop-blur">
              <p className="text-sm text-muted-foreground mb-1">Address</p>
              <p className="font-mono text-xs break-all text-foreground">{data.address}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                <p className="text-sm text-muted-foreground mb-1">Liquid Balance</p>
                <p className="text-2xl font-bold text-primary">{formatTokenAmount(data.aptBalance, 'APT')}</p>
              </div>
              {data.stakedApt !== '0' && (
                <div className="p-4 rounded-lg bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20">
                  <p className="text-sm text-muted-foreground mb-1">Staked</p>
                  <p className="text-2xl font-bold text-accent">{formatTokenAmount(data.stakedApt, 'APT')}</p>
                </div>
              )}
            </div>
            
            {/* Wallet Activity Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-secondary/20 border border-border/30">
                <p className="text-sm text-muted-foreground mb-1">Transactions</p>
                <p className="text-xl font-bold text-foreground">{formatCount(transactionCount)}</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/20 border border-border/30">
                <p className="text-sm text-muted-foreground mb-1">NFTs</p>
                <p className="text-xl font-bold text-foreground">{formatCount(nftCount)}</p>
              </div>
            </div>

            {/* Wallet Timeline Stats */}
            {(data.firstTransactionTimestamp || data.lastTransactionTimestamp) && (
              <div className="grid grid-cols-2 gap-4">
                {data.firstTransactionTimestamp && (() => {
                  // Parse timestamp - handle both microseconds and ISO format
                  const timestamp = typeof data.firstTransactionTimestamp === 'string' && data.firstTransactionTimestamp.includes('T')
                    ? data.firstTransactionTimestamp
                    : parseInt(data.firstTransactionTimestamp) / 1000; // Convert microseconds to milliseconds
                  const date = new Date(timestamp);
                  const isValid = !isNaN(date.getTime());
                  
                  return (
                    <div className="p-4 rounded-lg bg-secondary/20 border border-border/30">
                      <p className="text-sm text-muted-foreground mb-1">Wallet Start Date</p>
                      <p className="text-sm font-semibold text-foreground">
                        {isValid ? date.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        }) : 'N/A'}
                      </p>
                    </div>
                  );
                })()}
                {data.lastTransactionTimestamp && (() => {
                  // Parse timestamp - handle both microseconds and ISO format
                  const timestamp = typeof data.lastTransactionTimestamp === 'string' && data.lastTransactionTimestamp.includes('T')
                    ? data.lastTransactionTimestamp
                    : parseInt(data.lastTransactionTimestamp) / 1000; // Convert microseconds to milliseconds
                  const date = new Date(timestamp);
                  const isValid = !isNaN(date.getTime());
                  
                  return (
                    <div className="p-4 rounded-lg bg-secondary/20 border border-border/30">
                      <p className="text-sm text-muted-foreground mb-1">Last Transaction</p>
                      <p className="text-sm font-semibold text-foreground">
                        {isValid ? date.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        }) : 'N/A'}
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Sentiment Indicator */}
            <div className="p-4 rounded-lg bg-gradient-to-br from-primary/5 to-accent/5 border border-border/30">
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm text-muted-foreground">Wallet Sentiment</p>
                <p className={`text-sm font-bold ${sentimentLabel.color}`}>{sentimentLabel.text}</p>
              </div>
              <div className="space-y-2">
                <Slider
                  value={[sentiment]}
                  max={100}
                  step={1}
                  disabled
                  className="cursor-default"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Bearish</span>
                  <span>Bullish</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">Enter an address to view account details</p>
        )}
      </CardContent>
    </Card>
  );
}
