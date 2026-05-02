import { useEffect, useRef, useState, useCallback } from "react";
import type { Transaction } from "@/hooks/useRealtimeTransactions";
import {
  type FlowState,
  type Anchor,
  AnchorRegistry,
  anchorPosition,
  createFlow,
  flowAlive,
  drawFlow,
  drawAnchor,
  drawBackground,
  cssVarHsl,
  hash32,
} from "./flows";
import type { Mode } from "./modes";

interface Options {
  transactions: Transaction[];
  mode: Mode;
  maxFlows: number;
  paused: boolean;
  tps: number;
  speed: number; // 0.5..2 multiplier (higher = faster)
  // Optional pulse marker: set to a new timestamp whenever a fresh batch
  // of unique mainnet txs arrives. The engine paints a one-shot sweep.
  burstAt?: number;
}

export interface FlowEngineHandle {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  hoveredId: string | null;
  hoverInfo: HoverInfo | null;
  snapshot: () => void;
  getAnchorAt: (x: number, y: number) => Anchor | null;
}

export interface HoverInfo {
  tx: Transaction;
  // Screen position (CSS pixels relative to the canvas) where the
  // hovered element currently is. Used to anchor a tooltip.
  x: number;
  y: number;
  // Distance the cursor was from the matched element, for debug.
  source: "flow" | "anchor";
}

function destKeyFor(tx: Transaction): string {
  // Use the called function or contract module as the destination key.
  // Fall back to a hashed variant of the sender so it still produces a path.
  if (tx.function && tx.function.length > 0) {
    // strip arg suffix, keep module::fn or module address
    const m = tx.function.split("::").slice(0, 2).join("::");
    return m || tx.function;
  }
  return "dst:" + tx.sender;
}

export function useFlowEngine({
  transactions,
  mode,
  maxFlows,
  paused,
  tps,
  speed,
  burstAt,
}: Options): FlowEngineHandle {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flowsRef = useRef<FlowState[]>([]);
  const anchorsRef = useRef(new AnchorRegistry());
  const seenRef = useRef<Set<string>>(new Set());
  const sizeRef = useRef({ w: 0, h: 0 });
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef(performance.now());
  const modeRef = useRef(mode);
  const maxRef = useRef(maxFlows);
  const pausedRef = useRef(paused);
  const tpsRef = useRef(tps);
  const speedRef = useRef(speed);
  const timeRef = useRef(0);
  const burstTimeRef = useRef<number>(0); // canvas-time when burst fired
  const lastBurstAtRef = useRef<number>(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);
  const hoveredIdRef = useRef<string | null>(null);
  const hoverInfoRef = useRef<HoverInfo | null>(null);
  // Throttle React state updates from the high-frequency render loop.
  const lastHoverPushRef = useRef<number>(0);

  modeRef.current = mode;
  maxRef.current = maxFlows;
  pausedRef.current = paused;
  tpsRef.current = tps;
  speedRef.current = speed;

  // Trigger a sweep marker exactly when a new burst lands.
  useEffect(() => {
    if (!burstAt) return;
    if (burstAt === lastBurstAtRef.current) return;
    lastBurstAtRef.current = burstAt;
    burstTimeRef.current = timeRef.current;
  }, [burstAt]);

  // Reset anchors when mode changes (positions are mode-dependent)
  useEffect(() => {
    anchorsRef.current.clear();
    flowsRef.current = [];
  }, [mode]);

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
      // Reposition existing anchors to new dims
      anchorsRef.current.clear();
      flowsRef.current = [];
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

  // Ingest
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
    fresh.reverse();

    // Edge-batch dedupe within this tick: if same (sender→dest) appears
    // multiple times, keep the latest only (with weight boost).
    const edgeMap = new Map<string, Transaction>();
    for (const tx of fresh) {
      const dk = destKeyFor(tx);
      const ek = `${tx.sender}|${dk}`;
      edgeMap.set(ek, tx);
    }

    const cap = maxRef.current;
    const baseDur = mode === "rain" ? 3.2 : mode === "pulse" ? 2.2 : 2.6;
    const dur = baseDur / Math.max(0.25, speedRef.current);

    for (const tx of edgeMap.values()) {
      const oKey = "src:" + tx.sender;
      const dKey = destKeyFor(tx);
      const op = anchorPosition(oKey, modeRef.current, w, h);
      const dp = anchorPosition(dKey, modeRef.current, w, h);
      const origin = anchorsRef.current.get(oKey, op.x, op.y);
      const dest = anchorsRef.current.get(dKey, dp.x, dp.y);
      anchorsRef.current.hit(origin);
      anchorsRef.current.hit(dest);
      flowsRef.current.push(createFlow(tx, origin, dest, dur));
      if (flowsRef.current.length > cap) {
        flowsRef.current.splice(0, flowsRef.current.length - cap);
      }
    }
  }, [transactions, mode]);

  const getAnchorAt = useCallback((x: number, y: number): Anchor | null => {
    const reg = anchorsRef.current;
    let best: Anchor | null = null;
    let bestD2 = 18 * 18;
    for (const a of reg.values()) {
      const dx = x - a.x;
      const dy = y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = a;
      }
    }
    return best;
  }, []);

  // Render loop
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;
      timeRef.current += dt;
      const { w, h } = sizeRef.current;
      const m = modeRef.current;

      drawBackground(ctx, w, h, tpsRef.current, timeRef.current);

      // One-shot horizontal sweep when a new poll burst arrives.
      const sinceBurst = timeRef.current - burstTimeRef.current;
      if (burstTimeRef.current > 0 && sinceBurst < 0.9) {
        const t = sinceBurst / 0.9;
        const sweepX = t * w;
        const a = (1 - t) * 0.35;
        const grad = ctx.createLinearGradient(sweepX - 80, 0, sweepX + 80, 0);
        grad.addColorStop(0, cssVarHsl("--primary", 0));
        grad.addColorStop(0.5, cssVarHsl("--primary", a));
        grad.addColorStop(1, cssVarHsl("--primary", 0));
        ctx.fillStyle = grad;
        ctx.fillRect(sweepX - 80, 0, 160, h);
      }

      if (!pausedRef.current) {
        anchorsRef.current.tick(dt);
        anchorsRef.current.prune(60);
      }

      // Draw anchors (under flows)
      if (m !== "rain") {
        for (const a of anchorsRef.current.values()) {
          drawAnchor(a, ctx, m);
        }
      }

      // Constellation: faint persistent links between hot anchor pairs
      if (m === "constellation") {
        const hot = anchorsRef.current.topByHeat(14);
        ctx.strokeStyle = cssVarHsl("--foreground", 0.05);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < hot.length; i++) {
          for (let j = i + 1; j < Math.min(hot.length, i + 3); j++) {
            ctx.moveTo(hot[i].x, hot[i].y);
            ctx.lineTo(hot[j].x, hot[j].y);
          }
        }
        ctx.stroke();
      }

      // Tick + draw flows
      const live: FlowState[] = [];
      for (const f of flowsRef.current) {
        if (!pausedRef.current) f.age += dt;
        if (flowAlive(f) > 0) {
          drawFlow(f, { ctx, mode: m, width: w, height: h, time: timeRef.current });
          live.push(f);
        }
      }
      flowsRef.current = live;

      // Hover
      let next: string | null = null;
      let nextInfo: HoverInfo | null = null;
      if (mousePosRef.current) {
        const mx = mousePosRef.current.x;
        const my = mousePosRef.current.y;
        // 1) Try to hit a live flow head/streak first — closest within radius.
        let bestF: FlowState | null = null;
        let bestFx = 0;
        let bestFy = 0;
        let bestD2 = 22 * 22;
        for (let i = flowsRef.current.length - 1; i >= 0; i--) {
          const f = flowsRef.current[i];
          const p = currentFlowPoint(f, m, h);
          const dx = mx - p.x;
          const dy = my - p.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < bestD2) {
            bestD2 = d2;
            bestF = f;
            bestFx = p.x;
            bestFy = p.y;
          }
        }
        if (bestF) {
          next = bestF.id;
          nextInfo = { tx: bestF.tx, x: bestFx, y: bestFy, source: "flow" };
        } else {
          // 2) Fall back to nearest anchor → most recent flow touching it.
          const a = getAnchorAt(mx, my);
          if (a) {
            let recent: FlowState | null = null;
            for (let i = flowsRef.current.length - 1; i >= 0; i--) {
              const f = flowsRef.current[i];
              if (f.origin === a || f.dest === a) {
                recent = f;
                break;
              }
            }
            if (recent) {
              next = recent.id;
              nextInfo = { tx: recent.tx, x: a.x, y: a.y, source: "anchor" };
            } else {
              next = "anchor:" + a.key;
            }
          }
        }
      }
      // Hover state lives in refs; we publish to React at most every ~50ms
      // and only when the underlying tx hash changes or position drifts.
      hoveredIdRef.current = next;
      hoverInfoRef.current = nextInfo;
      const nowMs = performance.now();
      if (nowMs - lastHoverPushRef.current > 50) {
        lastHoverPushRef.current = nowMs;
        setHoveredId(next);
        setHoverInfo((prev) => {
          if (!nextInfo && !prev) return prev;
          if (!nextInfo) return null;
          if (
            prev &&
            prev.tx.hash === nextInfo.tx.hash &&
            Math.abs(prev.x - nextInfo.x) < 2 &&
            Math.abs(prev.y - nextInfo.y) < 2
          ) {
            return prev;
          }
          return nextInfo;
        });
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [getAnchorAt]);

  const snapshot = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const url = c.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `aptos-pulse-${Date.now()}.png`;
    a.click();
  }, []);

  // suppress unused
  void hash32;

  return { canvasRef, hoveredId, hoverInfo, snapshot, getAnchorAt };
}

// Re-derive a flow's current screen point from its parameters.
// Mirrors the math in flows.ts so the hover layer stays in sync without
// requiring the renderer to publish per-frame positions.
function currentFlowPoint(
  f: FlowState,
  mode: Mode,
  height: number,
): { x: number; y: number } {
  const travelT = Math.min(1, f.age / f.duration);
  if (mode === "rain") {
    const y = -20 + travelT * (height + 40);
    return { x: f.origin.x, y };
  }
  if (mode === "pulse") {
    // Ripple expands radially; pick a point on the ring toward the dest.
    const dx = f.dest.x - f.origin.x;
    const dy = f.dest.y - f.origin.y;
    const dist = Math.hypot(dx, dy) || 1;
    const r = travelT * dist;
    return { x: f.origin.x + (dx / dist) * r, y: f.origin.y + (dy / dist) * r };
  }
  // Bezier (constellation / garden / orbit)
  const u = travelT < 0.5 ? 4 * travelT * travelT * travelT : 1 - Math.pow(-2 * travelT + 2, 3) / 2;
  const o = f.origin;
  const d = f.dest;
  const mx = (o.x + d.x) / 2;
  const my = (o.y + d.y) / 2;
  const ddx = d.x - o.x;
  const ddy = d.y - o.y;
  const px = -ddy * 0.35 * f.curveK;
  const py = ddx * 0.35 * f.curveK;
  const cx = mx + px;
  const cy = my + py;
  const it = 1 - u;
  return {
    x: it * it * o.x + 2 * it * u * cx + u * u * d.x,
    y: it * it * o.y + 2 * it * u * cy + u * u * d.y,
  };
}