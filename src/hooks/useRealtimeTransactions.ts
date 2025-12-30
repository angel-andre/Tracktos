import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Transaction {
  hash: string;
  type: string;
  from: string;
  to: string;
  amount: number;
  timestamp: number;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  fromCity: string;
  toCity: string;
}

interface TransactionStats {
  tps: number;
  totalToday: number;
  topTypes: string[];
}

// Major cities with coordinates for realistic distribution
const CITIES = [
  { name: "New York", lat: 40.7128, lng: -74.006 },
  { name: "London", lat: 51.5074, lng: -0.1278 },
  { name: "Tokyo", lat: 35.6762, lng: 139.6503 },
  { name: "Singapore", lat: 1.3521, lng: 103.8198 },
  { name: "Hong Kong", lat: 22.3193, lng: 114.1694 },
  { name: "Sydney", lat: -33.8688, lng: 151.2093 },
  { name: "Dubai", lat: 25.2048, lng: 55.2708 },
  { name: "Frankfurt", lat: 50.1109, lng: 8.6821 },
  { name: "San Francisco", lat: 37.7749, lng: -122.4194 },
  { name: "Seoul", lat: 37.5665, lng: 126.978 },
  { name: "Mumbai", lat: 19.076, lng: 72.8777 },
  { name: "São Paulo", lat: -23.5505, lng: -46.6333 },
  { name: "Toronto", lat: 43.6532, lng: -79.3832 },
  { name: "Zurich", lat: 47.3769, lng: 8.5417 },
  { name: "Amsterdam", lat: 52.3676, lng: 4.9041 },
  { name: "Paris", lat: 48.8566, lng: 2.3522 },
  { name: "Berlin", lat: 52.52, lng: 13.405 },
  { name: "Shanghai", lat: 31.2304, lng: 121.4737 },
  { name: "Los Angeles", lat: 34.0522, lng: -118.2437 },
  { name: "Chicago", lat: 41.8781, lng: -87.6298 },
];

const TX_TYPES = ["Transfer", "Swap", "Stake", "NFT", "Contract"];

function getRandomCity() {
  return CITIES[Math.floor(Math.random() * CITIES.length)];
}

function generateMockTransaction(): Transaction {
  const fromCity = getRandomCity();
  let toCity = getRandomCity();
  // Ensure different cities
  while (toCity.name === fromCity.name) {
    toCity = getRandomCity();
  }
  
  const type = TX_TYPES[Math.floor(Math.random() * TX_TYPES.length)];
  const amount = type === "Transfer" 
    ? Math.random() * 100 
    : type === "Swap" 
      ? Math.random() * 500 
      : Math.random() * 50;

  return {
    hash: `0x${Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join("")}`,
    type,
    from: `0x${Array.from({ length: 40 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join("")}`,
    to: `0x${Array.from({ length: 40 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join("")}`,
    amount: parseFloat(amount.toFixed(4)),
    timestamp: Date.now(),
    fromLat: fromCity.lat,
    fromLng: fromCity.lng,
    toLat: toCity.lat,
    toLng: toCity.lng,
    fromCity: fromCity.name,
    toCity: toCity.name,
  };
}

export function useRealtimeTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<TransactionStats>({
    tps: 0,
    totalToday: 0,
    topTypes: ["Transfer", "Swap", "Stake"],
  });
  const [isConnected, setIsConnected] = useState(false);
  const txCountRef = useRef(0);
  const tpsWindowRef = useRef<number[]>([]);

  // Calculate TPS from recent transactions
  const updateTPS = useCallback(() => {
    const now = Date.now();
    // Keep only transactions from the last 5 seconds
    tpsWindowRef.current = tpsWindowRef.current.filter(t => now - t < 5000);
    const tps = tpsWindowRef.current.length / 5;
    setStats(prev => ({ ...prev, tps }));
  }, []);

  // Add a new transaction
  const addTransaction = useCallback((tx: Transaction) => {
    setTransactions(prev => {
      const updated = [tx, ...prev.slice(0, 99)]; // Keep last 100
      return updated;
    });
    tpsWindowRef.current.push(tx.timestamp);
    txCountRef.current++;
    setStats(prev => ({
      ...prev,
      totalToday: prev.totalToday + 1,
    }));
  }, []);

  useEffect(() => {
    setIsConnected(true);
    
    // Generate initial transactions
    const initial = Array.from({ length: 10 }, generateMockTransaction);
    initial.forEach((tx, i) => {
      tx.timestamp = Date.now() - (10 - i) * 2000;
    });
    setTransactions(initial);
    setStats({
      tps: 2.5,
      totalToday: 847293,
      topTypes: ["Transfer", "Swap", "Stake"],
    });

    // Simulate real-time transactions
    const interval = setInterval(() => {
      // Random interval between 200ms and 800ms for realistic variation
      if (Math.random() > 0.3) {
        addTransaction(generateMockTransaction());
      }
    }, 400);

    // Update TPS every second
    const tpsInterval = setInterval(updateTPS, 1000);

    // Try to fetch real transactions periodically
    const fetchRealTransactions = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('aptos-transactions', {
          body: { limit: 5 },
        });
        
        if (!error && data?.transactions) {
          data.transactions.forEach((tx: any) => {
            const fromCity = getRandomCity();
            let toCity = getRandomCity();
            while (toCity.name === fromCity.name) {
              toCity = getRandomCity();
            }
            
            addTransaction({
              hash: tx.hash || generateMockTransaction().hash,
              type: tx.type || "Transfer",
              from: tx.sender || generateMockTransaction().from,
              to: tx.receiver || generateMockTransaction().to,
              amount: tx.amount || Math.random() * 100,
              timestamp: Date.now(),
              fromLat: fromCity.lat,
              fromLng: fromCity.lng,
              toLat: toCity.lat,
              toLng: toCity.lng,
              fromCity: fromCity.name,
              toCity: toCity.name,
            });
          });
        }
      } catch (err) {
        // Silently fail and continue with mock data
        console.log("Using simulated transaction data");
      }
    };

    // Fetch real data occasionally
    const realDataInterval = setInterval(fetchRealTransactions, 10000);
    fetchRealTransactions();

    return () => {
      clearInterval(interval);
      clearInterval(tpsInterval);
      clearInterval(realDataInterval);
      setIsConnected(false);
    };
  }, [addTransaction, updateTPS]);

  return { transactions, stats, isConnected };
}
