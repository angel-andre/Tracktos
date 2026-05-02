import type { Transaction } from "@/hooks/useRealtimeTransactions";
import type { Mode } from "./modes";

export type { Mode };

// Fast 32-bit hash → normalized float in [0,1)
function hash32(str: string, seed = 0): number {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function padded(t: number, total: number, pad: number) {
  return pad + t * (total - pad * 2);
}

export type Motion =
  | { kind: "linear" }
  | { kind: "stream" }
  | { kind: "orbit"; cx: number; cy: number; r: number; omega: number; theta: number }
  | { kind: "spiral"; cx: number; cy: number; omega: number; growth: number; theta: number; r: number }
  | { kind: "fall"; speed: number }
  | { kind: "boid"; tx: number; ty: number }
  | { kind: "burst"; gx: number; gy: number; explodeAt: number; vx: number; vy: number; phase: "rise" | "explode" }
  | { kind: "scroll"; speed: number };

export interface Spawn {
  x: number;
  y: number;
  vx: number;
  vy: number;
  motion: Motion;
}

export function pickSpawn(
  tx: Transaction,
  mode: Mode,
  width: number,
  height: number,
): Spawn {
  const cx = width / 2;
  const cy = height / 2;
  switch (mode) {
    case "stream": {
      const fy = hash32(tx.hash, 7);
      return {
        x: -40,
        y: padded(fy, height, 60),
        vx: 30 + hash32(tx.hash, 8) * 20,
        vy: (hash32(tx.hash, 9) - 0.5) * 6,
        motion: { kind: "stream" },
      };
    }
    case "constellation": {
      const key = tx.proposer || tx.sender;
      const fx = hash32(key, 11);
      const fy = hash32(key, 13);
      const r = Math.min(width, height) * 0.36;
      const angle = fx * Math.PI * 2;
      const radial = r + (fy - 0.5) * 60;
      return {
        x: cx + Math.cos(angle) * radial,
        y: cy + Math.sin(angle) * radial,
        vx: 0,
        vy: 0,
        motion: { kind: "linear" },
      };
    }
    case "spiral": {
      const theta = hash32(tx.sender, 21) * Math.PI * 2;
      const omega = 0.6 + hash32(tx.sender, 22) * 0.6;
      const growth = 18 + hash32(tx.hash, 23) * 22;
      return {
        x: cx,
        y: cy,
        vx: 0,
        vy: 0,
        motion: { kind: "spiral", cx, cy, omega, growth, theta, r: 4 },
      };
    }
    case "rain": {
      const col = hash32(tx.sender, 31);
      const speed = 70 + hash32(tx.hash, 32) * 120;
      return {
        x: padded(col, width, 30),
        y: -30,
        vx: 0,
        vy: speed,
        motion: { kind: "fall", speed },
      };
    }
    case "orbit": {
      const amtNorm = Math.min(1, Math.log10(1 + tx.amount) / 4);
      const baseR = Math.min(width, height) * 0.12;
      const maxR = Math.min(width, height) * 0.42;
      const r = baseR + amtNorm * (maxR - baseR);
      const theta = hash32(tx.hash, 41) * Math.PI * 2;
      const omega = (0.15 + hash32(tx.hash, 42) * 0.25) * (hash32(tx.hash, 43) > 0.5 ? 1 : -1);
      return {
        x: cx + Math.cos(theta) * r,
        y: cy + Math.sin(theta) * r,
        vx: 0,
        vy: 0,
        motion: { kind: "orbit", cx, cy, r, omega, theta },
      };
    }
    case "grid": {
      const cols = Math.max(8, Math.floor(width / 80));
      const rows = Math.max(6, Math.floor(height / 80));
      const ix = Math.floor(hash32(tx.sender, 51) * cols);
      const iy = Math.floor(hash32(tx.sender, 52) * rows);
      const cw = width / cols;
      const ch = height / rows;
      return {
        x: ix * cw + cw / 2,
        y: iy * ch + ch / 2,
        vx: 0,
        vy: 0,
        motion: { kind: "linear" },
      };
    }
    case "waveform": {
      const amtNorm = Math.min(1, Math.log10(1 + tx.amount) / 4);
      const y = cy + (amtNorm - 0.5) * height * 0.7;
      return {
        x: width + 20,
        y,
        vx: -80,
        vy: 0,
        motion: { kind: "scroll", speed: 80 },
      };
    }
    case "fireworks": {
      const gx = padded(hash32(tx.hash, 61), width, 80);
      const gy = height - 20;
      const vy = -(260 + hash32(tx.hash, 62) * 120);
      const vx = (hash32(tx.hash, 63) - 0.5) * 80;
      const explodeAt = 0.7 + hash32(tx.hash, 64) * 0.4;
      return {
        x: gx,
        y: gy,
        vx,
        vy,
        motion: { kind: "burst", gx, gy, explodeAt, vx, vy, phase: "rise" },
      };
    }
    case "swarm": {
      const tx0 = padded(hash32(tx.sender, 71), width, 100);
      const ty0 = padded(hash32(tx.sender, 72), height, 100);
      const sx = padded(hash32(tx.hash, 73), width, 40);
      const sy = padded(hash32(tx.hash, 74), height, 40);
      return {
        x: sx,
        y: sy,
        vx: 0,
        vy: 0,
        motion: { kind: "boid", tx: tx0, ty: ty0 },
      };
    }
    case "mandala": {
      // Place blooms in a quadrant; engine mirrors them N times
      const r = Math.min(width, height) * 0.1 +
        hash32(tx.hash, 81) * Math.min(width, height) * 0.3;
      const theta = hash32(tx.hash, 82) * (Math.PI / 3); // narrow wedge, mirrored
      return {
        x: cx + Math.cos(theta) * r,
        y: cy + Math.sin(theta) * r,
        vx: 0,
        vy: 0,
        motion: { kind: "linear" },
      };
    }
    case "garden":
    default: {
      const fx = hash32(tx.sender, 1);
      const fy = hash32(tx.sender, 2);
      const padding = 80;
      return {
        x: padding + fx * (width - padding * 2),
        y: padding + fy * (height - padding * 2),
        vx: 0,
        vy: 0,
        motion: { kind: "linear" },
      };
    }
  }
}
