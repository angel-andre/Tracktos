import { useEffect, useRef, useState, useCallback } from "react";
import type { Transaction } from "@/hooks/useRealtimeTransactions";
import { archetypeFor, colorVarFor, cssVarHsl } from "./blooms";
import {
  type Mode,
  hash32,
  walletAnchorPosition,
  validatorRingPosition,
  blockLaneY,
} from "./positioning";

interface Options {
  transactions: Transaction[];
  mode: Mode;
  density: number;
  paused: boolean;
  tps: number;
}

// ---- Internal entity types ----
interface FlowEdge {
  id: string;
  tx: Transaction;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  age: number;
  life: number; // seconds
  colorVar: string;
}

interface ValidatorSlot {
  proposer: string;
  slotIndex: number;
  count: number;
  pulse: number; // 0..1 decays
  lastSeen: number;
}

interface BlockBand {
  proposer: string;
  x: number;
  y: number;
  txs: Transaction[];
  birth: number;
  width: number;
}

interface WalletNode {
  sender: string;
  x: number;
  y: number;
  count: number;
  pulse: number;
  lastSeen: number;
  typeCounts: Record<string, number>;
  recent: Transaction[];
}

export interface BloomEngineHandle {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  hoveredId: string | null;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  snapshot: () => void;
  getBloomAt: (x: number, y: number) => { tx: Transaction } | null;
}

export function useBloomEngine({
  transactions,
  mode,
  density,
  paused,
  tps,
}: Options): BloomEngineHandle {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef(performance.now());
  const ambientRef = useRef(0);
  const seenRef = useRef<Set<string>>(new Set());
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // mode state buckets
  const flowEdgesRef = useRef<FlowEdge[]>([]);
  const validatorsRef = useRef<Map<string, ValidatorSlot>>(new Map());
  const blocksRef = useRef<BlockBand[]>([]);
  const walletsRef = useRef<Map<string, WalletNode>>(new Map());

  const modeRef = useRef(mode);
  const densityRef = useRef(density);
  const pausedRef = useRef(paused);
  const tpsRef = useRef(tps);
  modeRef.current = mode;
  densityRef.current = density;
  pausedRef.current = paused;
  tpsRef.current = tps;

  // Resize
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const onResize = () => {
      const rect = c.getBoundingClientRect();
      c.width = Math.floor(rect.width * dpr);
      c.height = Math.floor(rect.height * dpr);
      const ctx = c.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w: rect.width, h: rect.height };
    };
    onResize();
    const ro = new ResizeObserver(onResize);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  // Mouse
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const onMove = (e: MouseEvent) => {
      const rect = c.getBoundingClientRect();
      mousePosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onLeave = () => {
      mousePosRef.current = null;
      setHoveredId(null);
    };
    c.addEventListener("mousemove", onMove);
    c.addEventListener("mouseleave", onLeave);
    return () => {
      c.removeEventListener("mousemove", onMove);
      c.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  // Reset transient state when mode changes (keeps wallets persistent though)
  useEffect(() => {
    flowEdgesRef.current = [];
    blocksRef.current = [];
  }, [mode]);

  // Ingest new transactions
  useEffect(() => {
    const { w, h } = sizeRef.current;
    if (w === 0 || h === 0) return;
    const fresh: Transaction[] = [];
    for (const tx of transactions) {
      if (!seenRef.current.has(tx.hash)) {
        seenRef.current.add(tx.hash);
        fresh.push(tx);
      }
    }
    if (fresh.length === 0) return;
    fresh.reverse(); // chronological

    const now = performance.now() / 1000;

    for (const tx of fresh) {
      const arch = archetypeFor(tx);
      const colorVar = colorVarFor(arch);
      const proposer = tx.proposer || "unknown";

      // --- Validators (used by flow & ledger header) ---
      let v = validatorsRef.current.get(proposer);
      if (!v) {
        v = {
          proposer,
          slotIndex: validatorsRef.current.size,
          count: 0,
          pulse: 0,
          lastSeen: now,
        };
        validatorsRef.current.set(proposer, v);
      }
      v.count += 1;
      v.pulse = 1;
      v.lastSeen = now;

      // --- Wallets (swarm) ---
      let wn = walletsRef.current.get(tx.sender);
      if (!wn) {
        const p = walletAnchorPosition(tx.sender, w, h);
        wn = {
          sender: tx.sender,
          x: p.x,
          y: p.y,
          count: 0,
          pulse: 0,
          lastSeen: now,
          typeCounts: {},
          recent: [],
        };
        walletsRef.current.set(tx.sender, wn);
      }
      wn.count += 1;
      wn.pulse = 1;
      wn.lastSeen = now;
      wn.typeCounts[tx.type] = (wn.typeCounts[tx.type] || 0) + 1;
      wn.recent.unshift(tx);
      if (wn.recent.length > 6) wn.recent.length = 6;

      // --- Flow edge ---
      const totalSlots = Math.max(8, validatorsRef.current.size);
      const ring = validatorRingPosition(v.slotIndex, totalSlots, w, h);
      const from = walletAnchorPosition(tx.sender, w, h);
      flowEdgesRef.current.push({
        id: tx.hash,
        tx,
        fromX: from.x,
        fromY: from.y,
        toX: ring.x,
        toY: ring.y,
        age: 0,
        life: 3.2,
        colorVar,
      });

      // --- Ledger block band (group txs sharing proposer within 1.5s into latest band) ---
      const latest = blocksRef.current[blocksRef.current.length - 1];
      if (latest && latest.proposer === proposer && now - latest.birth < 1.5) {
        latest.txs.push(tx);
        latest.width = Math.min(280, 40 + latest.txs.length * 14);
      } else {
        blocksRef.current.push({
          proposer,
          x: w + 40,
          y: blockLaneY(proposer, h),
          txs: [tx],
          birth: now,
          width: 50,
        });
      }
    }

    // Caps
    const maxEdges = Math.min(160, Math.max(40, densityRef.current));
    if (flowEdgesRef.current.length > maxEdges) {
      flowEdgesRef.current.splice(0, flowEdgesRef.current.length - maxEdges);
    }
    if (blocksRef.current.length > 30) {
      blocksRef.current.splice(0, blocksRef.current.length - 30);
    }
    // Drop stale wallets above cap
    if (walletsRef.current.size > 200) {
      const arr = [...walletsRef.current.values()].sort((a, b) => a.lastSeen - b.lastSeen);
      const toRemove = arr.slice(0, walletsRef.current.size - 200);
      for (const w of toRemove) walletsRef.current.delete(w.sender);
    }
  }, [transactions]);

  // ---- Hit testing ----
  const getBloomAt = useCallback(
    (x: number, y: number): { tx: Transaction } | null => {
      const m = modeRef.current;
      if (m === "swarm") {
        for (const wn of walletsRef.current.values()) {
          const r = nodeRadius(wn);
          const dx = x - wn.x;
          const dy = y - wn.y;
          if (dx * dx + dy * dy <= r * r) {
            return wn.recent[0] ? { tx: wn.recent[0] } : null;
          }
        }
      }
      if (m === "flow") {
        // hit recent edges (test endpoint)
        for (let i = flowEdgesRef.current.length - 1; i >= 0; i--) {
          const e = flowEdgesRef.current[i];
          const dx = x - e.fromX;
          const dy = y - e.fromY;
          if (dx * dx + dy * dy <= 64) return { tx: e.tx };
        }
      }
      if (m === "ledger") {
        for (let i = blocksRef.current.length - 1; i >= 0; i--) {
          const b = blocksRef.current[i];
          if (
            x >= b.x - b.width / 2 &&
            x <= b.x + b.width / 2 &&
            y >= b.y - 18 &&
            y <= b.y + 18
          ) {
            return b.txs[0] ? { tx: b.txs[0] } : null;
          }
        }
      }
      return null;
    },
    [],
  );

  // ---- Render loop ----
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;
      ambientRef.current += dt;
      const { w, h } = sizeRef.current;

      // Background trail wash
      ctx.fillStyle = cssVarHsl("--background", 0.22);
      ctx.fillRect(0, 0, w, h);

      const breathe =
        0.04 + 0.04 * Math.sin(ambientRef.current * Math.max(0.3, tpsRef.current / 30));
      ctx.fillStyle = cssVarHsl("--primary", breathe * 0.04);
      ctx.fillRect(0, 0, w, h);

      const m = modeRef.current;

      // Decay validator pulses
      for (const v of validatorsRef.current.values()) {
        if (!pausedRef.current) v.pulse = Math.max(0, v.pulse - dt * 0.6);
      }
      // Decay wallet pulses
      for (const wn of walletsRef.current.values()) {
        if (!pausedRef.current) wn.pulse = Math.max(0, wn.pulse - dt * 0.8);
      }

      if (m === "flow") drawFlow(ctx, w, h, flowEdgesRef.current, validatorsRef.current, dt, pausedRef.current);
      else if (m === "ledger")
        drawLedger(ctx, w, h, blocksRef.current, dt, pausedRef.current, tpsRef.current);
      else drawSwarm(ctx, w, h, walletsRef.current, dt, pausedRef.current);

      // hover
      let nextHovered: string | null = null;
      if (mousePosRef.current) {
        const found = getBloomAt(mousePosRef.current.x, mousePosRef.current.y);
        nextHovered = found?.tx?.hash ?? null;
      }
      if (nextHovered !== hoveredId) setHoveredId(nextHovered);

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getBloomAt, hoveredId]);

  const snapshot = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const url = c.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `aptos-pulse-${Date.now()}.png`;
    a.click();
  }, []);

  return { canvasRef, hoveredId, selectedId, setSelectedId, snapshot, getBloomAt };
}

// =============== Draw functions ===============

function nodeRadius(wn: WalletNode): number {
  return 4 + Math.min(22, Math.log10(wn.count + 1) * 10) + wn.pulse * 4;
}

function drawFlow(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  edges: FlowEdge[],
  validators: Map<string, ValidatorSlot>,
  dt: number,
  paused: boolean,
) {
  const cx = w / 2;
  const cy = h / 2;
  const ringR = Math.min(w, h) * 0.42;

  // Outer ring guide
  ctx.strokeStyle = cssVarHsl("--border", 0.4);
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 6]);
  ctx.beginPath();
  ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Validator nodes
  const totalSlots = Math.max(8, validators.size);
  const vArr = [...validators.values()];
  for (const v of vArr) {
    const pos = validatorRingPosition(v.slotIndex, totalSlots, w, h);
    const r = 5 + Math.min(14, Math.log10(v.count + 1) * 6) + v.pulse * 5;
    // glow
    const g = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r * 3);
    g.addColorStop(0, cssVarHsl("--primary", 0.25 + v.pulse * 0.4));
    g.addColorStop(1, cssVarHsl("--primary", 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r * 3, 0, Math.PI * 2);
    ctx.fill();
    // core
    ctx.fillStyle = cssVarHsl("--primary", 0.85);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Edges + traveling particle
  const live: FlowEdge[] = [];
  for (const e of edges) {
    if (!paused) e.age += dt;
    const t = e.age / e.life;
    if (t >= 1) continue;
    const alpha = 0.18 + 0.6 * (1 - t);
    // curved arc via control point pulled toward center for elegance
    const mx = (e.fromX + e.toX) / 2;
    const my = (e.fromY + e.toY) / 2;
    const ctrlX = mx + (cx - mx) * 0.35;
    const ctrlY = my + (cy - my) * 0.35;

    ctx.strokeStyle = e.tx.success
      ? cssVarHsl(e.colorVar, alpha)
      : cssVarHsl("--destructive", alpha * 0.8);
    ctx.lineWidth = 1 + Math.min(2.5, Math.log10(e.tx.amount + 1));
    if (!e.tx.success) ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(e.fromX, e.fromY);
    ctx.quadraticCurveTo(ctrlX, ctrlY, e.toX, e.toY);
    ctx.stroke();
    ctx.setLineDash([]);

    // particle along the curve
    const u = Math.min(1, t * 1.4);
    const px = (1 - u) * (1 - u) * e.fromX + 2 * (1 - u) * u * ctrlX + u * u * e.toX;
    const py = (1 - u) * (1 - u) * e.fromY + 2 * (1 - u) * u * ctrlY + u * u * e.toY;
    ctx.fillStyle = cssVarHsl(e.colorVar, alpha);
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();

    // sender dot
    ctx.fillStyle = cssVarHsl(e.colorVar, alpha * 0.6);
    ctx.beginPath();
    ctx.arc(e.fromX, e.fromY, 2, 0, Math.PI * 2);
    ctx.fill();

    live.push(e);
  }
  edges.length = 0;
  edges.push(...live);
}

function drawLedger(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  blocks: BlockBand[],
  dt: number,
  paused: boolean,
  tps: number,
) {
  const speed = 60 + Math.min(140, tps * 1.5);

  // Lane guides
  for (let i = 1; i <= 5; i++) {
    const y = (h / 6) * i;
    ctx.strokeStyle = cssVarHsl("--border", 0.18);
    ctx.lineWidth = 1;
    ctx.setLineDash([1, 8]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const live: BlockBand[] = [];
  for (const b of blocks) {
    if (!paused) b.x -= speed * dt;
    if (b.x + b.width / 2 < -20) continue;

    // band background
    const left = b.x - b.width / 2;
    const grad = ctx.createLinearGradient(left, 0, left + b.width, 0);
    grad.addColorStop(0, cssVarHsl("--primary", 0));
    grad.addColorStop(0.5, cssVarHsl("--primary", 0.12));
    grad.addColorStop(1, cssVarHsl("--primary", 0));
    ctx.fillStyle = grad;
    ctx.fillRect(left, b.y - 16, b.width, 32);

    // tx markers stacked horizontally inside the band
    const slot = b.width / b.txs.length;
    b.txs.forEach((tx, i) => {
      const cx = left + slot * (i + 0.5);
      const arch = archetypeFor(tx);
      const color = colorVarFor(arch);
      const r = 3 + Math.min(8, Math.log10(tx.gasCost * 1e8 + 10) * 1.5);
      ctx.fillStyle = tx.success ? cssVarHsl(color, 0.85) : cssVarHsl("--destructive", 0.7);
      ctx.beginPath();
      ctx.arc(cx, b.y, r, 0, Math.PI * 2);
      ctx.fill();
    });

    // small proposer label
    ctx.fillStyle = cssVarHsl("--muted-foreground", 0.55);
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${b.txs.length} tx`, b.x, b.y - 22);

    live.push(b);
  }
  blocks.length = 0;
  blocks.push(...live);

  // Right-edge "incoming" hint
  ctx.fillStyle = cssVarHsl("--primary", 0.05);
  ctx.fillRect(w - 30, 0, 30, h);
}

function drawSwarm(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  wallets: Map<string, WalletNode>,
  dt: number,
  paused: boolean,
) {
  // Decay & cull idle wallets
  const now = performance.now() / 1000;
  for (const [k, wn] of wallets) {
    if (now - wn.lastSeen > 60) wallets.delete(k);
  }

  // Draw nodes
  for (const wn of wallets.values()) {
    const r = nodeRadius(wn);
    const idleness = Math.min(1, (now - wn.lastSeen) / 30);
    const alpha = 0.3 + (1 - idleness) * 0.6;

    // halo when pulsing
    if (wn.pulse > 0.05) {
      const g = ctx.createRadialGradient(wn.x, wn.y, 0, wn.x, wn.y, r * 3);
      g.addColorStop(0, cssVarHsl("--primary", 0.35 * wn.pulse));
      g.addColorStop(1, cssVarHsl("--primary", 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(wn.x, wn.y, r * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // satellites: one petal per type, length by count
    const types = Object.entries(wn.typeCounts);
    const petalCount = types.length;
    types.forEach(([type, count], i) => {
      const a = (i / petalCount) * Math.PI * 2;
      const len = r + 6 + Math.min(28, Math.log10(count + 1) * 14);
      const ex = wn.x + Math.cos(a) * len;
      const ey = wn.y + Math.sin(a) * len;
      const arch = archetypeFor({ type } as Transaction);
      const color = colorVarFor(arch);
      ctx.strokeStyle = cssVarHsl(color, alpha * 0.7);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(wn.x + Math.cos(a) * r, wn.y + Math.sin(a) * r);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.fillStyle = cssVarHsl(color, alpha);
      ctx.beginPath();
      ctx.arc(ex, ey, 2.4, 0, Math.PI * 2);
      ctx.fill();
    });

    // core node
    ctx.fillStyle = cssVarHsl("--primary", alpha);
    ctx.beginPath();
    ctx.arc(wn.x, wn.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = cssVarHsl("--foreground", alpha * 0.4);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
