import { Activity, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { exportTransactionsToCSV } from "@/lib/csvExport";

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
  if (loading) {
    return (
      <Card className="backdrop-blur-xl bg-card/50 border-border/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <div className="p-2 rounded-lg bg-primary/10">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="backdrop-blur-xl bg-card/50 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <div className="p-2 rounded-lg bg-primary/10">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            Recent Activity
          </CardTitle>
          {activity && activity.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportTransactionsToCSV(activity)}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {activity && activity.length > 0 ? (
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
