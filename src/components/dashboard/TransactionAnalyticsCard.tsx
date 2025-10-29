import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Activity, TrendingUp, Zap, Code } from "lucide-react";

interface TransactionAnalytics {
  activityHeatmap: { date: string; count: number }[];
  typeBreakdown: { type: string; count: number; percentage: number }[];
  gasOverTime: { date: string; gas: string }[];
  topContracts: { address: string; name: string; count: number; type: string }[];
}

interface TransactionAnalyticsCardProps {
  analytics: TransactionAnalytics;
}

const COLORS = [
  'hsl(142 76% 36%)',    // Primary green
  'hsl(173 58% 39%)',    // Teal
  'hsl(43 74% 66%)',     // Yellow
  'hsl(27 87% 67%)',     // Orange
  'hsl(197 37% 24%)',    // Deep blue
  'hsl(280 60% 50%)',    // Purple
  'hsl(340 75% 55%)',    // Pink
  'hsl(160 50% 45%)',    // Mint
];

export const TransactionAnalyticsCard = ({ analytics }: TransactionAnalyticsCardProps) => {
  // Get last 90 days for heatmap
  const recentHeatmap = analytics.activityHeatmap.slice(-90);
  
  // Get last year for gas chart
  const recentGas = analytics.gasOverTime.slice(-365).map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    gas: parseFloat(item.gas)
  }));

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Transaction Analytics
        </CardTitle>
        <CardDescription>Comprehensive analysis of wallet activity and patterns</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        
        {/* Activity Heatmap */}
        <div>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity Heatmap (Last 90 Days)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={recentHeatmap}>
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                interval={Math.floor(recentHeatmap.length / 8)}
              />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                formatter={(value: number) => [`${value} txs`, 'Transactions']}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Transaction Type Breakdown */}
          <div>
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Transaction Type Breakdown
            </h3>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={analytics.typeBreakdown}
                    dataKey="count"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                  >
                    {analytics.typeBreakdown.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number, name: string) => [`${value} txs`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 w-full sm:w-auto">
                {analytics.typeBreakdown.map((item, idx) => (
                  <div key={item.type} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="flex-1">{item.type}</span>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Gas Spending Over Time */}
          <div>
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Gas Spending (Last Year)
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={recentGas}>
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10 }}
                  interval={Math.floor(recentGas.length / 6)}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value: number) => [`${value.toFixed(4)} APT`, 'Gas']} />
                <Line 
                  type="monotone" 
                  dataKey="gas" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Interacted Contracts */}
        <div>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Code className="h-4 w-4" />
            Top Interacted Contracts
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {analytics.topContracts.map((contract, idx) => (
              <div key={contract.address} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                    #{idx + 1}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{contract.name}</p>
                    <p className="text-xs text-muted-foreground">{contract.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{contract.count}</p>
                  <p className="text-xs text-muted-foreground">interactions</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </CardContent>
    </Card>
  );
};
