import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Hash, Image } from "lucide-react";

interface JourneyCardProps {
  address: string;
  totalTransactions: number;
  firstTransactionDate: string;
  nftCount: number;
}

const JourneyCard = ({
  address,
  totalTransactions,
  firstTransactionDate,
  nftCount,
}: JourneyCardProps) => {
  return (
    <Card className="w-full animate-in fade-in-50 slide-in-from-bottom-4 duration-700">
      <CardHeader>
        <CardTitle className="text-2xl">Your Aptos Journey</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Wallet Address</p>
          <p className="text-sm font-mono break-all">{address}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
            <Hash className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">Total Transactions</p>
              <p className="text-2xl font-bold">{totalTransactions.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
            <Calendar className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">First Transaction</p>
              <p className="text-2xl font-bold">{firstTransactionDate}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
            <Image className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">NFTs Owned</p>
              <p className="text-2xl font-bold">{nftCount.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default JourneyCard;
