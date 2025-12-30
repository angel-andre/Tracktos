import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Transaction {
  hash: string;
  version: string;
  type: string;
  sender: string;
  success: boolean;
  timestamp: number;
  gasUsed: number;
  gasCost: number;
  amount: number;
  function: string;
  sequenceNumber: string;
}

export interface LedgerInfo {
  ledgerVersion: string;
  blockHeight: string;
  chainId: number;
  epoch: string;
  ledgerTimestamp: string;
}

interface TransactionStats {
  tps: number;
  totalTransactions: number;
  latestVersion: string;
  blockHeight: string;
  epoch: string;
  topTypes: { type: string; count: number }[];
}

export function useRealtimeTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<TransactionStats>({
    tps: 0,
    totalTransactions: 0,
    latestVersion: "0",
    blockHeight: "0",
    epoch: "0",
    topTypes: [],
  });
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tpsWindowRef = useRef<number[]>([]);
  const lastVersionRef = useRef<string>("0");

  // Calculate TPS from recent fetch times
  const updateTPS = useCallback((newTxCount: number) => {
    const now = Date.now();
    tpsWindowRef.current.push(...Array(newTxCount).fill(now));
    // Keep only last 10 seconds
    tpsWindowRef.current = tpsWindowRef.current.filter(t => now - t < 10000);
    const tps = tpsWindowRef.current.length / 10;
    setStats(prev => ({ ...prev, tps: Math.round(tps * 10) / 10 }));
  }, []);

  // Fetch real transactions from Aptos
  const fetchTransactions = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase.functions.invoke('aptos-transactions', {
        body: { limit: 25 },
      });

      if (fetchError) {
        console.error('Error fetching transactions:', fetchError);
        setError(fetchError.message);
        return;
      }

      if (data?.error) {
        console.error('API error:', data.error);
        setError(data.error);
        return;
      }

      setError(null);
      setIsConnected(true);

      if (data?.transactions && data.transactions.length > 0) {
        // Filter out transactions we've already seen
        const newTransactions = data.transactions.filter(
          (tx: Transaction) => tx.version > lastVersionRef.current
        );

        if (newTransactions.length > 0) {
          lastVersionRef.current = newTransactions[0].version;
          
          setTransactions(prev => {
            const combined = [...newTransactions, ...prev];
            // Keep unique by version, max 100
            const unique = Array.from(
              new Map(combined.map(tx => [tx.version, tx])).values()
            ).slice(0, 100);
            return unique;
          });

          updateTPS(newTransactions.length);
        }

        // Calculate type distribution
        const typeCounts: Record<string, number> = {};
        data.transactions.forEach((tx: Transaction) => {
          typeCounts[tx.type] = (typeCounts[tx.type] || 0) + 1;
        });
        const topTypes = Object.entries(typeCounts)
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Update stats from ledger info
        if (data.ledgerInfo) {
          setStats(prev => ({
            ...prev,
            latestVersion: data.ledgerInfo.ledgerVersion,
            blockHeight: data.ledgerInfo.blockHeight,
            epoch: data.ledgerInfo.epoch,
            totalTransactions: parseInt(data.ledgerInfo.ledgerVersion),
            topTypes,
          }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [updateTPS]);

  useEffect(() => {
    // Initial fetch
    fetchTransactions();

    // Poll for new transactions every 3 seconds
    const interval = setInterval(fetchTransactions, 3000);

    return () => {
      clearInterval(interval);
      setIsConnected(false);
    };
  }, [fetchTransactions]);

  return { transactions, stats, isConnected, error };
}
