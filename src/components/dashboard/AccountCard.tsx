import { Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AccountData {
  address: string;
  aptBalance: string;
  stakedApt: string;
}

interface AccountCardProps {
  data: AccountData | null;
  loading: boolean;
}

export function AccountCard({ data, loading }: AccountCardProps) {
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
        {loading ? (
          <div className="space-y-3">
            <div className="h-4 bg-muted animate-pulse rounded" />
            <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
          </div>
        ) : data ? (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-secondary/50 backdrop-blur">
              <p className="text-sm text-muted-foreground mb-1">Address</p>
              <p className="font-mono text-xs break-all text-foreground">{data.address}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                <p className="text-sm text-muted-foreground mb-1">Liquid Balance</p>
                <p className="text-2xl font-bold text-primary">{data.aptBalance} APT</p>
              </div>
              {data.stakedApt !== '0' && (
                <div className="p-4 rounded-lg bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20">
                  <p className="text-sm text-muted-foreground mb-1">Staked</p>
                  <p className="text-2xl font-bold text-accent">{data.stakedApt} APT</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">Enter an address to view account details</p>
        )}
      </CardContent>
    </Card>
  );
}
