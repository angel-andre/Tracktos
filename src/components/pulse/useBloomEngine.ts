import { useEffect, useRef, useState, useCallback } from "react";
import type { Transaction } from "@/hooks/useRealtimeTransactions";
import {
  type BloomState,
  type Scar,
  createBloom,
  tickBloom,
  aliveFrac,
  drawBloom,
  drawScar,
  cssVarHsl,
} from "./blooms";
import { type Mode, pickPosition } from "./positioning";

interface Options {
  transactions: Transaction[];
  mode: Mode;
  density: number;
  paused: boolean;
  tps: number;
}

export interface BloomEngineHandle {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  hoveredId: string | null;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  snapshot: () => void;
  getBloomAt: (x: number, y: number) => BloomState | null;
}

export function useBloomEngine({
  transactions,
  mode,
  density,
  paused,
  tps,
}: Options): BloomEngineHandle {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bloomsRef = useRef<BloomState[]>([]);
  const scarsRef = useRef<Scar[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const sizeRef = useRef({ w: 0, h: 0 });
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef(performance.now());
  const modeRef = useRef(mode);
  const densityRef = useRef(density);
  const pausedRef = useRef(paused);
  const tpsRef = useRef(tps);
  const ambientTimeRef = useRef(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);

  modeRef.current = mode;
  densityRef.current = density;
  pausedRef.current = paused;
  tpsRef.current = tps;

  // Resize handling
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const onResize = () => {
      const rect = c.getBoundingClientRect();
      c.width = Math.floor(rect.width * dpr);
      c.height = Math.floor(rect.height * dpr);
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      sizeRef.current = { w: rect.width, h: rect.height };
    };
    onResize();
    const ro = new ResizeObserver(onResize);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  // Mouse tracking
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
    // newest first → push in chronological so animation feels right
    fresh.reverse().forEach((tx) => {
      const p = pickPosition(tx, modeRef.current, w, h);
      bloomsRef.current.push(createBloom(tx, p.x, p.y, p.vx ?? 0, p.vy ?? 0));
    });
    // cap density
    const cap = densityRef.current;
    if (bloomsRef.current.length > cap) {
      bloomsRef.current.splice(0, bloomsRef.current.length - cap);
    }
  }, [transactions]);

  const getBloomAt = useCallback((x: number, y: number): BloomState | null => {
    // newest (top-most) first
    for (let i = bloomsRef.current.length - 1; i >= 0; i--) {
      const b = bloomsRef.current[i];
      const dx = x - b.x;
      const dy = y - b.y;
      if (dx * dx + dy * dy <= b.radius * b.radius) return b;
    }
    return null;
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
      ambientTimeRef.current += dt;

      const { w, h } = sizeRef.current;

      // Background wash with very low alpha → creates motion blur trails
      ctx.fillStyle = cssVarHsl("--background", 0.18);
      ctx.fillRect(0, 0, w, h);

      // Subtle TPS-driven brightness wash
      const breathe =
        0.04 + 0.04 * Math.sin(ambientTimeRef.current * Math.max(0.3, tpsRef.current / 30));
      ctx.fillStyle = cssVarHsl("--primary", breathe * 0.05);
      ctx.fillRect(0, 0, w, h);

      // Tick + draw scars first (background)
      const liveScars: Scar[] = [];
      for (const s of scarsRef.current) {
        if (!pausedRef.current) s.age += dt;
        if (s.age < s.life) {
          drawScar(s, ctx);
          liveScars.push(s);
        }
      }
      scarsRef.current = liveScars;

      // Hover detection
      let nextHovered: string | null = null;
      if (mousePosRef.current) {
        const found = getBloomAt(mousePosRef.current.x, mousePosRef.current.y);
        nextHovered = found?.id ?? null;
      }
      if (nextHovered !== hoveredId) setHoveredId(nextHovered);

      // Find hovered sender for cluster highlight
      const hoveredSender = nextHovered
        ? bloomsRef.current.find((b) => b.id === nextHovered)?.tx.sender
        : null;

      // Tick + draw blooms
      const liveBlooms: BloomState[] = [];
      for (const b of bloomsRef.current) {
        if (!pausedRef.current) tickBloom(b, dt);
        const alive = aliveFrac(b);
        const offscreen =
          b.x < -200 || b.x > w + 200 || b.y < -200 || b.y > h + 200;
        if (alive > 0 && !offscreen) {
          const isHover =
            b.id === nextHovered ||
            (hoveredSender !== null && b.tx.sender === hoveredSender);
          drawBloom(b, { ctx, hovered: isHover });
          liveBlooms.push(b);
        } else if (alive <= 0 && !offscreen) {
          // leave a scar
          scarsRef.current.push({
            x: b.x,
            y: b.y,
            radius: b.radius * 0.6,
            colorVar: b.colorVar,
            age: 0,
            life: 60,
          });
        }
      }
      bloomsRef.current = liveBlooms;

      // Edge ring (epoch progress placeholder — drawn by parent if desired)

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