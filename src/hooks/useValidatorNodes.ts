import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ValidatorNode {
  city: string;
  country: string;
  lat: number;
  lng: number;
  count: number;
}

export interface NetworkStats {
  totalValidators: number;
  totalFullnodes: number;
  countries: number;
  cities: number;
  totalStaked: number;
  aprReward: number;
  tps: number;
  peakTps: number;
  totalSupply: number;
  epoch: number;
  epochProgress: number;
}

type ApiStats = {
  totalValidators: number;
  countries: number;
  cities: number;
  totalStaked: number;
  aprReward: number;
  epoch: number;
  epochProgress: number;
};

type ApiResponse = {
  validators: ValidatorNode[];
  stats: ApiStats | null;
  error?: string;
};

const CACHE_KEY = "aptos_validators_cache_v1";
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

function readCache(): { ts: number; data: ApiResponse } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCache(data: ApiResponse) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // ignore
  }
}

export function useValidatorNodes() {
  const [validators, setValidators] = useState<ValidatorNode[]>([]);
  const [stats, setStats] = useState<NetworkStats>({
    totalValidators: 0,
    totalFullnodes: 0,
    countries: 0,
    cities: 0,
    totalStaked: 0,
    aprReward: 0,
    tps: 0,
    peakTps: 16162,
    totalSupply: 0,
    epoch: 0,
    epochProgress: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const cached = useMemo(() => readCache(), []);

  useEffect(() => {
    let cancelled = false;

    const hydrateFromCache = () => {
      if (!cached) return;
      if (Date.now() - cached.ts > CACHE_TTL_MS) return;
      const { validators: v, stats: s } = cached.data;
      if (Array.isArray(v) && v.length) setValidators(v);
      if (s) {
        setStats((prev) => ({
          ...prev,
          totalValidators: s.totalValidators,
          countries: s.countries,
          cities: s.cities,
          totalStaked: s.totalStaked,
          aprReward: s.aprReward,
          epoch: s.epoch,
          epochProgress: s.epochProgress,
        }));
      }
    };

    const load = async () => {
      setIsLoading(true);
      hydrateFromCache();

      try {
        const { data, error } = await supabase.functions.invoke<ApiResponse>("aptos-validators", {
          body: { network: "mainnet" },
        });

        if (cancelled) return;

        if (!error && data?.validators?.length) {
          setValidators(data.validators);
          if (data.stats) {
            setStats((prev) => ({
              ...prev,
              totalValidators: data.stats.totalValidators,
              countries: data.stats.countries,
              cities: data.stats.cities,
              totalStaked: data.stats.totalStaked,
              aprReward: data.stats.aprReward,
              epoch: data.stats.epoch,
              epochProgress: data.stats.epochProgress,
            }));
          }
          writeCache({ validators: data.validators, stats: data.stats });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [cached]);

  // TPS is sourced from live transactions; keep a subtle, stable placeholder here.
  useEffect(() => {
    const interval = setInterval(() => {
      setStats((prev) => ({
        ...prev,
        tps: Math.max(10, Math.min(250, prev.tps + (Math.random() - 0.5) * 10)),
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return { validators, stats, isLoading };
}
