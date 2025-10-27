import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface PortfolioChartCardProps {
  address: string;
  currentTotalUsdValue?: number;
}

interface HistoricalDataPoint {
  date: string;
  value: number;
}

type Timeframe = '7D' | '30D' | '90D';

export function PortfolioChartCard({ address, currentTotalUsdValue }: PortfolioChartCardProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>('30D');
  const [data, setData] = useState<HistoricalDataPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPortfolioHistory = async () => {
      if (!address) return;
      
      setLoading(true);
      try {
        console.log(`Fetching portfolio history for ${timeframe}...`);
        
        const { data: historyData, error } = await supabase.functions.invoke('portfolio-history', {
          body: { address, timeframe }
        });

        if (error) {
          console.error('Error fetching portfolio history:', error);
          setData([]);
        } else {
          console.log('Portfolio history data:', historyData);
          // Use the API data as-is without overriding
          setData((historyData as HistoricalDataPoint[]) || []);
        }
      } catch (error) {
        console.error('Error:', error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolioHistory();
  }, [address, timeframe]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    // Parse YYYY-MM-DD as a local date to avoid timezone shifting to the previous day
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, (m || 1) - 1, d || 1);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold">Portfolio History</CardTitle>
        <ToggleGroup 
          type="single" 
          value={timeframe}
          onValueChange={(value) => {
            if (value) setTimeframe(value as Timeframe);
          }}
          className="bg-muted/50 rounded-lg p-1"
        >
          <ToggleGroupItem value="7D" className="text-xs px-3 py-1">
            7D
          </ToggleGroupItem>
          <ToggleGroupItem value="30D" className="text-xs px-3 py-1">
            30D
          </ToggleGroupItem>
          <ToggleGroupItem value="90D" className="text-xs px-3 py-1">
            90D
          </ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[300px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : data.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No portfolio history available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
              />
              <YAxis 
                tickFormatter={formatCurrency}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                        <p className="text-sm font-medium">{formatDate(payload[0].payload.date)}</p>
                        <p className="text-lg font-bold text-primary">
                          {formatCurrency(payload[0].value as number)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#portfolioGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
