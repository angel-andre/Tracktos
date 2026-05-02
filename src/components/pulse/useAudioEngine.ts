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
  mode: Mode;
  lastBurst: { txs: Transaction[]; at: number } | null;
}

export function useAudioEngine({ transactions, mode, lastBurst }: Options) {
  const engineRef = useRef<AudioEngine | null>(null);
  const initSeededRef = useRef(false);
  const lastBurstAtRef = useRef<number>(0);

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
    engineRef.current.setQuantize(null);
    engineRef.current.setChordSize(1);
    engineRef.current.setPerTypeVoice(voicePref === "auto");
    engineRef.current.setMuted(muted);
    setReady(true);
  }, [muted, volume, effectiveVoice, def.scale, voicePref]);

  const setMuted = useCallback(
    async (m: boolean) => {
      setMutedState(m);
      localStorage.setItem(LS_MUTED, m ? "1" : "0");
      if (!m) {
        await ensureEngine();
        if (!initSeededRef.current) {
          // Mark currently-buffered txs as already-played so we don't
          // dump the whole backlog as soon as audio turns on.
          engineRef.current?.seenWithoutPlaying(transactions.map((t) => t.hash));
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
    eng.setQuantize(null);
    eng.setChordSize(1);
    eng.setPerTypeVoice(voicePref === "auto");
  }, [mode, effectiveVoice, def.scale, voicePref]);

  // React to *bursts* (fresh poll batches), not the full transactions array.
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng || muted || !lastBurst) return;
    if (lastBurst.at === lastBurstAtRef.current) return;
    lastBurstAtRef.current = lastBurst.at;
    eng.playBurst(lastBurst.txs);
  }, [lastBurst, muted]);

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
