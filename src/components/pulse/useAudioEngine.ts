import { useEffect, useRef, useState, useCallback } from "react";
import type { Transaction } from "@/hooks/useRealtimeTransactions";
import { AudioEngine, type Voice } from "./AudioEngine";
import { MODE_BY_ID, type Mode } from "./modes";

const LS_MUTED = "pulse:audio:muted";
const LS_VOLUME = "pulse:audio:volume";
const LS_VOICE = "pulse:audio:voice";

export type VoicePref = Voice | "auto";

interface Options {
  transactions: Transaction[];
  tps: number;
  mode: Mode;
}

export function useAudioEngine({ transactions, tps, mode }: Options) {
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
  const [voicePref, setVoicePrefState] = useState<VoicePref>(() => {
    if (typeof window === "undefined") return "auto";
    const v = localStorage.getItem(LS_VOICE) as VoicePref | null;
    return v && ["auto", "bloom", "crystal", "pulse"].includes(v) ? v : "auto";
  });
  const [ready, setReady] = useState(false);

  const def = MODE_BY_ID[mode];
  const effectiveVoice: Voice = voicePref === "auto" ? def.defaultVoice : voicePref;

  const ensureEngine = useCallback(async () => {
    if (!engineRef.current) {
      engineRef.current = new AudioEngine();
    }
    await engineRef.current.init();
    engineRef.current.setVolume(volume);
    engineRef.current.setVoice(effectiveVoice);
    engineRef.current.setScale(def.scale);
    engineRef.current.setQuantize(mode === "grid" ? 60 / 110 / 4 : null); // 16th @ 110bpm
    engineRef.current.setChordSize(mode === "mandala" ? 3 : 1);
    engineRef.current.setMuted(muted);
    setReady(true);
  }, [muted, volume, effectiveVoice, def.scale, mode]);

  const setMuted = useCallback(
    async (m: boolean) => {
      setMutedState(m);
      localStorage.setItem(LS_MUTED, m ? "1" : "0");
      if (!m) {
        await ensureEngine();
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

  const setVoice = useCallback((v: VoicePref) => {
    setVoicePrefState(v);
    localStorage.setItem(LS_VOICE, v);
  }, []);

  // Apply mode/voice changes to engine
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.setVoice(effectiveVoice);
    eng.setScale(def.scale);
    eng.setQuantize(mode === "grid" ? 60 / 110 / 4 : null);
    eng.setChordSize(mode === "mandala" ? 3 : 1);
  }, [mode, effectiveVoice, def.scale]);

  // Watch transactions
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng || muted) {
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
    fresh.reverse().forEach((tx) => eng.playTransaction(tx));
  }, [transactions, muted]);

  useEffect(() => {
    engineRef.current?.setAmbientLevel(tps);
  }, [tps]);

  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  return {
    muted,
    setMuted,
    volume,
    setVolume,
    voice: voicePref,
    setVoice,
    ready,
    effectiveVoice,
  };
}
