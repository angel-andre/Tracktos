import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Activity } from "lucide-react";
import type { Transaction } from "@/hooks/useRealtimeTransactions";

interface TransactionTypeChartProps {
  transactions: Transaction[];
}

const TYPE_COLORS: Record<string, string> = {
  Transfer: "#00ff88",
  Swap: "#ff6b00",
  Stake: "#bf00ff",
  NFT: "#ffcc00",
  Contract: "#00aaff",
  Transaction: "#00d9ff",
};

export function TransactionTypeChart({ transactions }: TransactionTypeChartProps) {
  const typeData = useMemo(() => {
    const counts: Record<string, number> = {};
    
    transactions.forEach(tx => {
      counts[tx.type] = (counts[tx.type] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([type, count]) => ({
        name: type,
        value: count,
        percentage: Math.round((count / transactions.length) * 100),
        color: TYPE_COLORS[type] || TYPE_COLORS.Transaction,
      }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  const successRate = useMemo(() => {
    if (transactions.length === 0) return 100;
    const successful = transactions.filter(tx => tx.success).length;
    return Math.round((successful / transactions.length) * 100);
  }, [transactions]);

  const totalGas = useMemo(() => {
    return transactions.reduce((sum, tx) => sum + tx.gasCost, 0);
  }, [transactions]);

  if (transactions.length === 0) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Transaction Types</span>
          </div>
          <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
            Loading data...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Transaction Types</span>
          </div>
          <span className="text-xs text-muted-foreground">{transactions.length} txs</span>
        </div>

        {/* Pie Chart */}
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={typeData}
                cx="50%"
                cy="50%"
                innerRadius={25}
                outerRadius={45}
                paddingAngle={2}
                dataKey="value"
              >
                {typeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number, name: string) => [`${value} (${Math.round((value / transactions.length) * 100)}%)`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-1 mt-2">
          {typeData.slice(0, 4).map(item => (
            <div key={item.name} className="flex items-center gap-1.5 text-[10px]">
              <span 
                className="w-2 h-2 rounded-full flex-shrink-0" 
                style={{ backgroundColor: item.color }}
              />
              <span className="text-muted-foreground truncate">{item.name}</span>
              <span className="text-foreground font-medium ml-auto">{item.percentage}%</span>
            </div>
          ))}
        </div>

        {/* Stats Row */}
        <div className="flex justify-between mt-3 pt-2 border-t border-border/30 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Success:</span>
            <span className={`font-medium ${successRate > 90 ? 'text-green-500' : successRate > 70 ? 'text-yellow-500' : 'text-red-500'}`}>
              {successRate}%
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Total Gas:</span>
            <span className="text-foreground font-medium">{totalGas.toFixed(4)} APT</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
