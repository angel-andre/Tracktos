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
  proposer: string | null; // The validator address that proposed the block
}

export interface LedgerInfo {
  ledgerVersion: string;
  blockHeight: string;
  chainId: number;
  epoch: string;
  ledgerTimestamp: string;
}

export interface ValidatorInfo {
  addr: string;
  voting_power: string;
  config?: {
    consensus_pubkey: string;
    validator_index: string;
    network_addresses?: string;
  };
}

interface TransactionStats {
  tps: number;
  totalTransactions: number;
  latestVersion: string;
  blockHeight: string;
  epoch: string;
  ledgerTimestamp: string; // Add ledger timestamp for epoch progress calculation
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
    ledgerTimestamp: "0",
    topTypes: [],
  });
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastVersionRef = useRef<string>("0");
  
  // Track ledger versions over time to calculate accurate TPS
  const tpsHistoryRef = useRef<{ version: number; time: number }[]>([]);

  // Calculate REAL TPS from ledger version changes
  const updateTPS = useCallback((currentVersion: string) => {
    const now = Date.now();
    const version = parseInt(currentVersion);
    
    if (isNaN(version)) return;
    
    tpsHistoryRef.current.push({ version, time: now });
    
    // Keep only last 15 seconds of data
    tpsHistoryRef.current = tpsHistoryRef.current.filter(
      entry => now - entry.time < 15000
    );
    
    // Calculate TPS from version delta over time
    if (tpsHistoryRef.current.length >= 2) {
      const oldest = tpsHistoryRef.current[0];
      const newest = tpsHistoryRef.current[tpsHistoryRef.current.length - 1];
      const versionDelta = newest.version - oldest.version;
      const timeDelta = (newest.time - oldest.time) / 1000; // seconds
      
      if (timeDelta > 0) {
        const realTPS = versionDelta / timeDelta;
        setStats(prev => ({ ...prev, tps: Math.round(realTPS * 10) / 10 }));
      }
    }
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

        // Update stats from ledger info and calculate REAL TPS
        if (data.ledgerInfo) {
          // Calculate TPS from ledger version changes (the real network throughput)
          updateTPS(data.ledgerInfo.ledgerVersion);
          
          setStats(prev => ({
            ...prev,
            latestVersion: data.ledgerInfo.ledgerVersion,
            blockHeight: data.ledgerInfo.blockHeight,
            epoch: data.ledgerInfo.epoch,
            ledgerTimestamp: data.ledgerInfo.ledgerTimestamp,
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
