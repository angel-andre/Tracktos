import { Calendar, Hash, Image } from "lucide-react";
import { Card } from "@/components/ui/card";

interface JourneyCardProps {
  address: string;
  totalTransactions: number;
  firstTransactionDate: string;
  nftCount: number;
}

const JourneyCard = ({ address, totalTransactions, firstTransactionDate, nftCount }: JourneyCardProps) => {
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <Card className="w-full max-w-2xl p-8 bg-card/80 backdrop-blur-xl border-2 border-primary/20 shadow-glow-lg animate-in fade-in-50 slide-in-from-bottom-4 duration-700">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Aptos Journey Card
          </h2>
          <p className="text-muted-foreground font-mono text-sm">
            {formatAddress(address)}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          {/* Total Transactions */}
          <div className="flex flex-col items-center space-y-3 p-6 rounded-lg bg-muted/50 border border-primary/10 hover:border-primary/30 transition-all duration-300 hover:shadow-glow">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Hash className="w-6 h-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-foreground">{totalTransactions.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground mt-1">Total Transactions</p>
            </div>
          </div>

          {/* First Transaction */}
          <div className="flex flex-col items-center space-y-3 p-6 rounded-lg bg-muted/50 border border-secondary/10 hover:border-secondary/30 transition-all duration-300 hover:shadow-glow">
            <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-secondary" />
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-foreground">{firstTransactionDate}</p>
              <p className="text-sm text-muted-foreground mt-1">First Transaction</p>
            </div>
          </div>

          {/* NFTs Owned */}
          <div className="flex flex-col items-center space-y-3 p-6 rounded-lg bg-muted/50 border border-primary/10 hover:border-primary/30 transition-all duration-300 hover:shadow-glow">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Image className="w-6 h-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-foreground">{nftCount.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground mt-1">NFTs Owned</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default JourneyCard;
