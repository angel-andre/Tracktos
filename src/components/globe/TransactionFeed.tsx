import { useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink, Check, X, Zap, ArrowRightLeft, Coins, Image, FileCode } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Transaction } from "@/hooks/useRealtimeTransactions";

interface TransactionFeedProps {
  transactions: Transaction[];
  selectedTransaction: Transaction | null;
  onSelect: (tx: Transaction | null) => void;
}

const typeIcons: Record<string, React.ReactNode> = {
  Transfer: <ArrowRightLeft className="w-3 h-3" />,
  Swap: <Zap className="w-3 h-3" />,
  Stake: <Coins className="w-3 h-3" />,
  NFT: <Image className="w-3 h-3" />,
  Contract: <FileCode className="w-3 h-3" />,
  Transaction: <FileCode className="w-3 h-3" />,
};

function getTypeColor(type: string): string {
  switch (type) {
    case "Transfer":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    case "Swap":
      return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    case "Stake":
      return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "NFT":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "Contract":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    default:
      return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
  }
}

function truncateHash(hash: string): string {
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function TransactionFeed({ transactions, selectedTransaction, onSelect }: TransactionFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top on new transactions
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [transactions[0]?.hash]);

  return (
    <ScrollArea className="flex-1">
      <div ref={scrollRef} className="space-y-2 p-4">
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Loading live transactions...</p>
          </div>
        ) : (
          transactions.map((tx, index) => (
            <div
              key={tx.hash}
              onClick={() => onSelect(selectedTransaction?.hash === tx.hash ? null : tx)}
              className={`
                group relative p-3 rounded-lg border transition-all cursor-pointer
                ${selectedTransaction?.hash === tx.hash
                  ? "bg-primary/10 border-primary/50"
                  : "bg-card/50 border-border/50 hover:bg-card hover:border-border"
                }
                ${index === 0 ? "animate-fade-in" : ""}
              `}
            >
              {/* New indicator */}
              {index === 0 && (
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full animate-pulse" />
              )}
              
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${getTypeColor(tx.type)}`}>
                    {typeIcons[tx.type] || typeIcons.Transaction}
                    <span className="ml-1">{tx.type}</span>
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  {tx.success ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <X className="w-3 h-3 text-red-500" />
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    v{tx.version}
                  </span>
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <a
                    href={`https://explorer.aptoslabs.com/txn/${tx.hash}?network=mainnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs font-mono text-foreground hover:text-primary flex items-center gap-1"
                  >
                    {truncateHash(tx.hash)}
                    <ExternalLink className="w-2 h-2" />
                  </a>
                  {tx.amount > 0 && (
                    <span className="text-xs font-medium text-primary">
                      {tx.amount.toFixed(4)} APT
                    </span>
                  )}
                </div>
                
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="truncate max-w-[150px]">
                    From: {truncateAddress(tx.sender)}
                  </span>
                  <span>
                    {formatDistanceToNow(new Date(tx.timestamp), { addSuffix: true })}
                  </span>
                </div>

                {tx.gasCost > 0 && (
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
                    <span>Gas: {tx.gasCost.toFixed(6)} APT</span>
                    <span className="truncate max-w-[100px]">
                      {tx.function !== 'unknown' ? tx.function.split('::').slice(-1)[0] : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
}
