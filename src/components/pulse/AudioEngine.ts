import type { Transaction } from "@/hooks/useRealtimeTransactions";

export type Voice = "bloom" | "crystal" | "pulse" | "warm" | "deep";

export interface ScaleDef {
  root: number;
  intervals: number[];
  octaves: number;
}

function buildScale(s: ScaleDef): number[] {
  const out: number[] = [];
  for (let oct = 0; oct < s.octaves; oct++) {
    for (const i of s.intervals) out.push(s.root + oct * 12 + i);
  }
  return out;
}

const DEFAULT_SCALE: ScaleDef = { root: 50, intervals: [0, 3, 5, 7, 10], octaves: 3 };

function midiToFreq(m: number) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

interface ActiveVoice {
  nodes: AudioNode[];
  endsAt: number;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private dry: GainNode | null = null;
  private wet: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;

  private voice: Voice = "bloom";
  private muted = true;
  private volume = 0.6;
  private active: ActiveVoice[] = [];
  private lastFrameTime = 0;
  private framePlayed = 0;
  private scaleNotes: number[] = buildScale(DEFAULT_SCALE);
  private quantize: number | null = null; // grid duration in seconds, null = off
  private chordSize = 1;
  private recentNotes: { key: string; t: number }[] = [];
  private perTypeVoice = true;
  // Hard rule: a tx hash can only ever produce one chime, period.
  private playedHashes: Set<string> = new Set();
  private playedOrder: string[] = [];
  private static MAX_PLAYED = 5000;

  isReady() {
    return !!this.ctx;
  }

  async init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") await this.ctx.resume();
      return;
    }
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    this.ctx = new Ctx();

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 6;
    this.compressor.attack.value = 0.005;
    this.compressor.release.value = 0.18;

    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(2.6, 2.4);

    this.dry = this.ctx.createGain();
    this.dry.gain.value = 0.7;
    this.wet = this.ctx.createGain();
    this.wet.gain.value = 0.45;

    // routing: voices -> dry+wet -> compressor -> master -> destination
    this.dry.connect(this.compressor);
    this.wet.connect(this.reverb).connect(this.compressor);
    this.compressor.connect(this.master).connect(this.ctx.destination);

    document.addEventListener("visibilitychange", this.onVisibility);
  }

  private onVisibility = () => {
    if (!this.ctx) return;
    if (document.visibilityState === "hidden") this.ctx.suspend();
    else if (!this.muted) this.ctx.resume();
  };

  private makeImpulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.linearRampToValueAtTime(m ? 0 : this.volume, t + 0.05);
      if (m) this.ctx.suspend();
      else this.ctx.resume();
    }
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx && !this.muted) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.linearRampToValueAtTime(this.volume, t + 0.05);
    }
  }

  setVoice(v: Voice) {
    this.voice = v;
  }

  setScale(s: ScaleDef) {
    this.scaleNotes = buildScale(s);
  }

  setQuantize(seconds: number | null) {
    this.quantize = seconds;
  }

  setChordSize(n: number) {
    this.chordSize = Math.max(1, Math.min(4, n));
  }

  setPerTypeVoice(on: boolean) {
    this.perTypeVoice = on;
  }

  // Mark a hash as already-played so the engine refuses to re-trigger it.
  // Used at unmute time to avoid replaying the buffered backlog.
  seenWithoutPlaying(hashes: string[]) {
    for (const h of hashes) this.markPlayed(h);
  }

  private markPlayed(hash: string) {
    if (this.playedHashes.has(hash)) return;
    this.playedHashes.add(hash);
    this.playedOrder.push(hash);
    if (this.playedOrder.length > AudioEngine.MAX_PLAYED) {
      const drop = this.playedOrder.shift();
      if (drop) this.playedHashes.delete(drop);
    }
  }

  // Play a *burst* of fresh transactions arriving in the same poll.
  // Caps audible voices to 6 (highest amount), the rest are silently
  // marked as played so they never re-trigger later.
  playBurst(txs: Transaction[]) {
    if (!this.ctx || this.muted || txs.length === 0) return;
    const fresh = txs.filter((t) => !this.playedHashes.has(t.hash));
    if (fresh.length === 0) return;
    const sorted = [...fresh].sort((a, b) => b.amount - a.amount);
    const audible = sorted.slice(0, 6);
    const skipped = sorted.slice(6);
    skipped.forEach((t) => this.markPlayed(t.hash));
    // Stagger lightly so we don't pile 6 attacks on a single sample.
    const start = this.ctx.currentTime;
    audible.forEach((tx, i) => this.playTransaction(tx, start + i * 0.045));
  }

  playTransaction(tx: Transaction, scheduledAt?: number) {
    if (!this.ctx || this.muted) return;
    // 1:1 contract — never re-play a hash.
    if (this.playedHashes.has(tx.hash)) return;
    this.markPlayed(tx.hash);
    const ctx = this.ctx;
    const rawNow = scheduledAt ?? ctx.currentTime;
    let now = rawNow;
    if (this.quantize) {
      const grid = this.quantize;
      now = Math.ceil(rawNow / grid) * grid;
    }

    // Throttle: cap notes per ~16ms frame
    if (rawNow - this.lastFrameTime < 0.016) {
      this.framePlayed++;
      if (this.framePlayed > 3) return;
    } else {
      this.lastFrameTime = rawNow;
      this.framePlayed = 1;
    }

    // Trim active voices > 12
    this.active = this.active.filter((v) => v.endsAt > now);
    if (this.active.length > 12) {
      const drop = this.active.shift();
      drop?.nodes.forEach((n) => {
        try {
          (n as OscillatorNode).stop?.();
        } catch {
          /* noop */
        }
      });
    }

    // Pitch from sender hash
    const h = hashString(tx.sender || tx.hash);
    const baseIdx = h % this.scaleNotes.length;
    const note = this.scaleNotes[baseIdx];
    const freq = midiToFreq(note);

    // Velocity from amount (log scaled)
    const amt = Math.max(0, tx.amount);
    const velocity = Math.min(1, 0.25 + Math.log10(1 + amt) * 0.25);

    // Duration / reverb send from gas
    const gas = Math.max(0, tx.gasCost);
    const duration = 0.6 + Math.min(2.4, Math.log10(1 + gas * 1e6) * 0.4);
    const wetSend = Math.min(0.8, 0.25 + gas * 5);

    // Per-type instrument when enabled (Auto), else honor the user's voice pick
    const typeVoice: Voice =
      tx.type === "Transfer"
        ? "bloom"
        : tx.type === "Swap"
          ? "warm"
          : tx.type === "Stake"
            ? "deep"
            : tx.type === "NFT"
              ? "crystal"
              : tx.type === "Contract"
                ? "pulse"
                : "bloom";
    const useVoice: Voice = this.perTypeVoice ? typeVoice : this.voice;

    // Dedupe identical pitch+type within 80ms
    const dedupeKey = `${useVoice}:${note}`;
    this.recentNotes = this.recentNotes.filter((n) => now - n.t < 0.08);
    if (this.recentNotes.some((n) => n.key === dedupeKey)) return;
    this.recentNotes.push({ key: dedupeKey, t: now });

    // Polyphony cap → 6
    if (this.active.length > 6) {
      const drop = this.active.shift();
      drop?.nodes.forEach((n) => {
        try { (n as OscillatorNode).stop?.(); } catch { /* noop */ }
      });
    }

    // Fixed soft duck so big bursts don't overwhelm; compressor handles peaks.
    const duck = 0.85;

    // Stereo pan from sender hash
    const pan = ((h % 1000) / 1000) * 2 - 1;

    const chord = this.chordSize;
    for (let c = 0; c < chord; c++) {
      const offsetIdx = (baseIdx + c * 2) % this.scaleNotes.length;
      const f = c === 0 ? freq : midiToFreq(this.scaleNotes[offsetIdx]);
      const v = (c === 0 ? velocity : velocity * 0.6) * duck;
      const nodes = this.synth(useVoice, f, v, duration, wetSend, now, pan);
      this.active.push({ nodes, endsAt: now + duration + 0.5 });
    }
  }

  private synth(
    voice: Voice,
    freq: number,
    velocity: number,
    duration: number,
    wetSend: number,
    when: number,
    pan: number = 0,
  ): AudioNode[] {
    const ctx = this.ctx!;
    const dryOut = ctx.createGain();
    const wetOut = ctx.createGain();
    dryOut.gain.value = 1 - wetSend * 0.4;
    wetOut.gain.value = wetSend;
    // Stereo panner if available
    let panner: StereoPannerNode | null = null;
    if ("createStereoPanner" in ctx) {
      panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      dryOut.connect(panner).connect(this.dry!);
    } else {
      dryOut.connect(this.dry!);
    }
    wetOut.connect(this.wet!);

    const env = ctx.createGain();
    env.gain.value = 0;
    env.connect(dryOut);
    env.connect(wetOut);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.connect(env);

    const oscs: OscillatorNode[] = [];
    let attack = 0.02;
    let release = duration * 0.7;
    let peak = velocity * 0.35;

    if (voice === "bloom") {
      filter.frequency.value = 2400;
      filter.Q.value = 0.6;
      const o1 = ctx.createOscillator();
      o1.type = "sine";
      o1.frequency.value = freq;
      const o2 = ctx.createOscillator();
      o2.type = "triangle";
      o2.frequency.value = freq * 2.003;
      const o2g = ctx.createGain();
      o2g.gain.value = 0.25;
      o1.connect(filter);
      o2.connect(o2g).connect(filter);
      o1.start(when);
      o2.start(when);
      oscs.push(o1, o2);
      attack = 0.04;
    } else if (voice === "crystal") {
      filter.frequency.value = 4000;
      filter.Q.value = 1;
      // simple FM: modulator -> carrier.frequency
      const carrier = ctx.createOscillator();
      carrier.type = "sine";
      carrier.frequency.value = freq;
      const mod = ctx.createOscillator();
      mod.type = "sine";
      mod.frequency.value = freq * 3.01;
      const modGain = ctx.createGain();
      modGain.gain.value = freq * 1.2;
      mod.connect(modGain).connect(carrier.frequency);
      carrier.connect(filter);
      mod.start(when);
      carrier.start(when);
      oscs.push(carrier, mod);
      attack = 0.005;
      release = Math.min(1.2, duration * 0.7);
      peak = velocity * 0.28;
    } else if (voice === "warm") {
      filter.frequency.value = 1800;
      filter.Q.value = 0.5;
      const o1 = ctx.createOscillator();
      o1.type = "triangle";
      o1.frequency.value = freq;
      const o2 = ctx.createOscillator();
      o2.type = "sawtooth";
      o2.frequency.value = freq * 1.005; // slight detune
      const o2g = ctx.createGain();
      o2g.gain.value = 0.18;
      o1.connect(filter);
      o2.connect(o2g).connect(filter);
      o1.start(when);
      o2.start(when);
      oscs.push(o1, o2);
      attack = 0.06;
      release = Math.min(1.8, duration * 0.85);
      peak = velocity * 0.3;
    } else if (voice === "deep") {
      filter.frequency.value = 900;
      filter.Q.value = 0.6;
      const o1 = ctx.createOscillator();
      o1.type = "sine";
      o1.frequency.value = freq * 0.5; // sub octave
      const o2 = ctx.createOscillator();
      o2.type = "sine";
      o2.frequency.value = freq;
      const o2g = ctx.createGain();
      o2g.gain.value = 0.4;
      o1.connect(filter);
      o2.connect(o2g).connect(filter);
      o1.start(when);
      o2.start(when);
      oscs.push(o1, o2);
      attack = 0.05;
      release = Math.min(2.2, duration * 1);
      peak = velocity * 0.32;
    } else {
      // pulse: short percussive blip
      filter.frequency.value = 1800;
      filter.Q.value = 4;
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.value = freq;
      o.connect(filter);
      o.start(when);
      oscs.push(o);
      attack = 0.002;
      release = Math.min(0.35, duration * 0.4);
      peak = velocity * 0.18;
    }

    const t0 = when;
    const t1 = t0 + attack;
    const t2 = t1 + release;
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(peak, t1);
    env.gain.exponentialRampToValueAtTime(0.0001, t2);

    const stopAt = t2 + 0.05;
    oscs.forEach((o) => o.stop(stopAt));

    return [...oscs, env, filter, dryOut, wetOut];
  }

  dispose() {
    document.removeEventListener("visibilitychange", this.onVisibility);
    if (this.ctx) {
      this.ctx.close().catch(() => {
        /* noop */
      });
    }
    this.ctx = null;
  }
}