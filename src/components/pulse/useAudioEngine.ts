import { useEffect, useRef, useState, useCallback } from "react";
import type { Transaction } from "@/hooks/useRealtimeTransactions";
import { AudioEngine, type Voice } from "./AudioEngine";

const LS_MUTED = "pulse:audio:muted";
const LS_VOLUME = "pulse:audio:volume";
const LS_VOICE = "pulse:audio:voice";

interface Options {
  transactions: Transaction[];
  tps: number;
}

export function useAudioEngine({ transactions, tps }: Options) {
  const engineRef = useRef<AudioEngine | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const initSeededRef = useRef(false);

  const [muted, setMutedState] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem(LS_MUTED);
    return v === null ? true : v === "1";
  });
  const [volume, setVolumeState] = useState<number>(() => {
    if (typeof window === "undefined") return 0.6;
    const v = localStorage.getItem(LS_VOLUME);
    return v ? Math.max(0, Math.min(1, parseFloat(v))) : 0.6;
  });
  const [voice, setVoiceState] = useState<Voice>(() => {
    if (typeof window === "undefined") return "bloom";
    const v = localStorage.getItem(LS_VOICE) as Voice | null;
    return v && ["bloom", "crystal", "pulse"].includes(v) ? v : "bloom";
  });
  const [ready, setReady] = useState(false);

  // Lazy create engine
  const ensureEngine = useCallback(async () => {
    if (!engineRef.current) {
      engineRef.current = new AudioEngine();
    }
    await engineRef.current.init();
    engineRef.current.setVolume(volume);
    engineRef.current.setVoice(voice);
    engineRef.current.setMuted(muted);
    setReady(true);
  }, [muted, volume, voice]);

  const setMuted = useCallback(
    async (m: boolean) => {
      setMutedState(m);
      localStorage.setItem(LS_MUTED, m ? "1" : "0");
      if (!m) {
        await ensureEngine();
        // On first unmute, mark all currently-known transactions as already-seen
        // so we don't blast a chord of historical txns.
        if (!initSeededRef.current) {
          for (const tx of transactions) seenRef.current.add(tx.hash);
          initSeededRef.current = true;
        }
      }
      engineRef.current?.setMuted(m);
    },
    [ensureEngine, transactions],
  );

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    localStorage.setItem(LS_VOLUME, String(v));
    engineRef.current?.setVolume(v);
  }, []);

  const setVoice = useCallback((v: Voice) => {
    setVoiceState(v);
    localStorage.setItem(LS_VOICE, v);
    engineRef.current?.setVoice(v);
  }, []);

  // Watch transactions
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng || muted) {
      // even when muted, mark seen so we don't backfill on unmute later
      for (const tx of transactions) seenRef.current.add(tx.hash);
      return;
    }
    const fresh: Transaction[] = [];
    for (const tx of transactions) {
      if (!seenRef.current.has(tx.hash)) {
        seenRef.current.add(tx.hash);
        fresh.push(tx);
      }
    }
    // newest first → reverse to play in chronological order
    fresh.reverse().forEach((tx) => eng.playTransaction(tx));
  }, [transactions, muted]);

  // Watch tps for ambient pad
  useEffect(() => {
    engineRef.current?.setAmbientLevel(tps);
  }, [tps]);

  // Cleanup
  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  return { muted, setMuted, volume, setVolume, voice, setVoice, ready };
}