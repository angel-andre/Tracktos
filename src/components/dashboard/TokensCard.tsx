import { Coins, Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/formatters";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { exportTokensToCSV } from "@/lib/csvExport";

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

  const chartData = (tokens ?? []).map((token) => ({
    name: token.symbol,
    value: token.usdValue,
  }));

  // Pagination: 20 tokens per page, show all tokens across pages
  const ITEMS_PER_PAGE = 20;
  const totalPages = Math.max(1, Math.ceil((tokens?.length ?? 0) / ITEMS_PER_PAGE));
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    // Reset to first page when new token set arrives
    setCurrentPage(1);
  }, [tokens?.length]);

  const paginatedTokens = useMemo(() => {
    if (!tokens) return [] as Token[];
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return tokens.slice(start, start + ITEMS_PER_PAGE);
  }, [tokens, currentPage]);

  return (
    <Card className="backdrop-blur-xl bg-card/50 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <div className="p-2 rounded-lg bg-primary/10">
              <Coins className="w-5 h-5 text-primary" />
            </div>
            Token Holdings
          </CardTitle>
          {tokens && tokens.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportTokensToCSV(tokens)}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          )}
        </div>
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
              {paginatedTokens.map((token, idx) => (
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

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
                  <p className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>First</Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>Prev</Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>Next</Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>Last</Button>
                  </div>
                </div>
              )}
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
