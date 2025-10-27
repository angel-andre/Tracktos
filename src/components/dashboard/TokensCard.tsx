import { Coins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Token {
  name: string;
  symbol: string;
  balance: string;
}

interface TokensCardProps {
  tokens: Token[] | null;
  loading: boolean;
}

export function TokensCard({ tokens, loading }: TokensCardProps) {
  return (
    <Card className="backdrop-blur-xl bg-card/50 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <div className="p-2 rounded-lg bg-primary/10">
            <Coins className="w-5 h-5 text-primary" />
          </div>
          Token Holdings
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : tokens && tokens.length > 0 ? (
          <div className="space-y-2">
            {tokens.map((token, idx) => (
              <div 
                key={idx} 
                className="flex justify-between items-center p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-all duration-200 border border-border/30"
              >
                <div>
                  <p className="font-semibold text-foreground">{token.symbol}</p>
                  <p className="text-xs text-muted-foreground">{token.name}</p>
                </div>
                <p className="font-mono text-sm text-foreground font-medium">{token.balance}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            {tokens === null ? "Enter an address to view tokens" : "No tokens found"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
