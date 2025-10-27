import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Transaction {
  hash: string;
  type: string;
  success: boolean;
  timestamp: string;
}

interface ActivityCardProps {
  activity: Transaction[] | null;
  loading: boolean;
}

export function ActivityCard({ activity, loading }: ActivityCardProps) {
  return (
    <Card className="backdrop-blur-xl bg-card/50 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <div className="p-2 rounded-lg bg-primary/10">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : activity && activity.length > 0 ? (
          <div className="space-y-2">
            {activity.map((tx, idx) => (
              <div 
                key={idx} 
                className="p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-all duration-200 border border-border/30"
              >
                <div className="flex justify-between items-start mb-2">
                  <p className="font-mono text-xs text-muted-foreground flex-1 mr-2">
                    {tx.hash.slice(0, 10)}...{tx.hash.slice(-8)}
                  </p>
                  <span
                    className={`px-2 py-1 text-xs rounded-full font-medium ${
                      tx.success
                        ? "bg-primary/20 text-primary"
                        : "bg-destructive/20 text-destructive"
                    }`}
                  >
                    {tx.success ? "Success" : "Failed"}
                  </span>
                </div>
                <p className="text-sm text-foreground font-medium">{tx.type}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(tx.timestamp).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            {activity === null ? "Enter an address to view activity" : "No recent transactions"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
