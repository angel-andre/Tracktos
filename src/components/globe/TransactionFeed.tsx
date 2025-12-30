import { useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRight, ExternalLink } from "lucide-react";
import type { Transaction } from "@/hooks/useRealtimeTransactions";

interface TransactionFeedProps {
  transactions: Transaction[];
  selectedTransaction: Transaction | null;
  onSelect: (tx: Transaction | null) => void;
}

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
    default:
      return "bg-primary/20 text-primary border-primary/30";
  }
}

function formatTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function truncateHash(hash: string): string {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
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
            <p className="text-sm">Waiting for transactions...</p>
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
              
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className={`text-[10px] ${getTypeColor(tx.type)}`}>
                      {tx.type}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {formatTime(tx.timestamp)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="font-mono truncate max-w-[80px]">
                      {truncateHash(tx.from)}
                    </span>
                    <ArrowRight className="w-3 h-3 text-primary flex-shrink-0" />
                    <span className="font-mono truncate max-w-[80px]">
                      {truncateHash(tx.to)}
                    </span>
                  </div>
                </div>
                
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-medium text-foreground">
                    {tx.amount.toFixed(2)} APT
                  </p>
                  <a
                    href={`https://explorer.aptoslabs.com/txn/${tx.hash}?network=mainnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[10px] text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                  >
                    View <ExternalLink className="w-2 h-2" />
                  </a>
                </div>
              </div>
              
              {/* Location info */}
              <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{tx.fromCity}</span>
                <ArrowRight className="w-2 h-2" />
                <span>{tx.toCity}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
}
