import type { Transaction } from "@/hooks/useRealtimeTransactions";

export type Mode = "garden" | "stream" | "constellation";

// Fast 32-bit hash → two normalized floats in [0,1)
function hash32(str: string, seed = 0): number {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function hashToXY(
  hash: string,
  width: number,
  height: number,
  padding = 80,
): { x: number; y: number } {
  const fx = hash32(hash, 1);
  const fy = hash32(hash, 2);
  return {
    x: padding + fx * (width - padding * 2),
    y: padding + fy * (height - padding * 2),
  };
}

export function streamPosition(
  width: number,
  height: number,
  hash: string,
): { x: number; y: number; vx: number; vy: number } {
  const fy = hash32(hash, 7);
  return {
    x: -40,
    y: padded(fy, height, 60),
    vx: 30 + hash32(hash, 8) * 20, // px/sec
    vy: (hash32(hash, 9) - 0.5) * 6,
  };
}

function padded(t: number, total: number, pad: number) {
  return pad + t * (total - pad * 2);
}

export function constellationPosition(
  tx: Transaction,
  width: number,
  height: number,
): { x: number; y: number } {
  // Place by proposer if available, else by sender hash
  const key = tx.proposer || tx.sender;
  const fx = hash32(key, 11);
  const fy = hash32(key, 13);
  // Cluster onto a soft ring
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.36;
  const angle = fx * Math.PI * 2;
  const radial = r + (fy - 0.5) * 60;
  return { x: cx + Math.cos(angle) * radial, y: cy + Math.sin(angle) * radial };
}

export function pickPosition(
  tx: Transaction,
  mode: Mode,
  width: number,
  height: number,
): { x: number; y: number; vx?: number; vy?: number } {
  if (mode === "stream") return streamPosition(width, height, tx.hash);
  if (mode === "constellation") return constellationPosition(tx, width, height);
  return hashToXY(tx.sender, width, height);
}