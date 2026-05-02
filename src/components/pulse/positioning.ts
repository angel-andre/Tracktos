import type { Transaction } from "@/hooks/useRealtimeTransactions";

export type Mode = "flow" | "ledger" | "swarm";

// Fast 32-bit hash → normalized float in [0,1)
export function hash32(str: string, seed = 0): number {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < (str?.length ?? 0); i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

// Place a sender wallet inside the inner area, deterministic from address
export function walletAnchorPosition(
  sender: string,
  width: number,
  height: number,
): { x: number; y: number } {
  const fx = hash32(sender, 17);
  const fy = hash32(sender, 19);
  const cx = width / 2;
  const cy = height / 2;
  const innerR = Math.min(width, height) * 0.28;
  // sample disk
  const a = fx * Math.PI * 2;
  const r = Math.sqrt(fy) * innerR;
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
}

// Place a validator on the outer ring, slot index → angle
export function validatorRingPosition(
  slotIndex: number,
  totalSlots: number,
  width: number,
  height: number,
): { x: number; y: number; angle: number } {
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.42;
  const angle = (slotIndex / Math.max(1, totalSlots)) * Math.PI * 2 - Math.PI / 2;
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, angle };
}

// Vertical lane for ledger mode, deterministic per proposer
export function blockLaneY(proposer: string, height: number, lanes = 5): number {
  const lane = Math.floor(hash32(proposer || "0", 23) * lanes);
  const laneH = height / (lanes + 1);
  return laneH * (lane + 1);
}
