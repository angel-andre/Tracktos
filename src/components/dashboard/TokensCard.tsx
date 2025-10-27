import { Coins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/formatters";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface Token {
  name: string;
  symbol: string;
  balance: string;
  usdPrice: number;
  usdValue: number;
  logoUrl: string;
}

interface TokensCardProps {
  tokens: Token[] | null;
  totalUsdValue: number;
  loading: boolean;
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function TokensCard({ tokens, totalUsdValue, loading }: TokensCardProps) {
  if (loading) {
    return (
      <Card className="backdrop-blur-xl bg-card/50 border-border/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <div className="p-2 rounded-lg bg-primary/10">
              <Coins className="w-5 h-5 text-primary" />
            </div>
            Token Holdings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = tokens?.map((token) => ({
    name: token.symbol,
    value: token.usdValue,
  })) || [];

  return (
    <Card className="backdrop-blur-xl bg-card/50 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <div className="p-2 rounded-lg bg-primary/10">
            <Coins className="w-5 h-5 text-primary" />
          </div>
          Token Holdings
        </CardTitle>
        <div className="pt-2">
          <p className="text-3xl font-bold text-foreground">
            ${formatNumber(totalUsdValue, 2)}
          </p>
          <p className="text-xs text-muted-foreground">Total Portfolio Value</p>
        </div>
      </CardHeader>
      <CardContent>
        {tokens && tokens.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-[40%_60%] gap-6">
            {/* Donut Chart - Left Side */}
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((_, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={CHART_COLORS[index % CHART_COLORS.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => `$${formatNumber(value, 2)}`}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Token List - Right Side */}
            <div className="space-y-2">
              {tokens.map((token, idx) => (
                <div 
                  key={idx} 
                  className="flex justify-between items-start p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-all duration-200 border border-border/30"
                >
                  <div className="flex items-center gap-2">
                    {token.logoUrl && (
                      <img 
                        src={token.logoUrl} 
                        alt={token.symbol} 
                        className="w-6 h-6 rounded-full"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <div>
                      <p className="font-semibold text-foreground">{token.symbol}</p>
                      <p className="text-xs text-muted-foreground">{token.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm text-foreground font-medium">
                      {formatNumber(token.balance, 4)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ${formatNumber(token.usdValue, 2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
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
