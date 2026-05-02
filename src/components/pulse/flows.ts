import type { Transaction } from "@/hooks/useRealtimeTransactions";
import type { Mode } from "./modes";

// Resolve an HSL CSS variable to "hsl(H S% L% / a)" with caching.
// `getComputedStyle` is expensive when called hundreds of times per frame;
// the raw HSL triple rarely changes, so we cache it and invalidate on
// theme switches (callers can call cssVarBust()).
const _hslCache: Map<string, string> = new Map();
export function cssVarBust() {
  _hslCache.clear();
}
function rawHsl(varName: string): string {
  const cached = _hslCache.get(varName);
  if (cached !== undefined) return cached;
  if (typeof window === "undefined") {
    _hslCache.set(varName, "0 0% 50%");
    return "0 0% 50%";
  }
  const raw =
    getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim() || "0 0% 50%";
  _hslCache.set(varName, raw);
  return raw;
}
export function cssVarHsl(varName: string, alpha = 1): string {
  return `hsl(${rawHsl(varName)} / ${alpha})`;
}

export type Archetype =
  | "transfer"
  | "swap"
  | "stake"
  | "nft"
  | "contract"
  | "default";

export function archetypeFor(tx: Transaction): Archetype {
  switch (tx.type) {
    case "Transfer": return "transfer";
    case "Swap": return "swap";
    case "Stake": return "stake";
    case "NFT": return "nft";
    case "Contract": return "contract";
    default: return "default";
  }
}

export function colorVarFor(arch: Archetype): string {
  switch (arch) {
    case "transfer": return "--chart-1";
    case "swap": return "--chart-5";
    case "stake": return "--chart-3";
    case "nft": return "--chart-4";
    case "contract": return "--chart-2";
    default: return "--primary";
  }
}

// Stable 32-bit hash → [0,1)
export function hash32(str: string, seed = 0): number {
  let h = (216636261 ^ seed) >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

// ============== Anchors ==============

export interface Anchor {
  key: string;
  x: number;
  y: number;
  heat: number; // recent activity
  lastHit: number; // seconds since last hit
  pulse: number; // 0..1 visual pulse
}

export class AnchorRegistry {
  private map = new Map<string, Anchor>();

  get(key: string, x: number, y: number): Anchor {
    let a = this.map.get(key);
    if (!a) {
      a = { key, x, y, heat: 0, lastHit: 999, pulse: 0 };
      this.map.set(key, a);
    } else {
      // Re-place if dimensions changed significantly (caller passes fresh coords)
      a.x = x;
      a.y = y;
    }
    return a;
  }

  hit(a: Anchor) {
    a.heat = Math.min(1, a.heat + 0.25);
    a.lastHit = 0;
    a.pulse = 1;
  }

  tick(dt: number) {
    for (const a of this.map.values()) {
      a.lastHit += dt;
      a.heat = Math.max(0, a.heat - dt * 0.15);
      a.pulse = Math.max(0, a.pulse - dt * 1.6);
    }
  }

  values(): IterableIterator<Anchor> {
    return this.map.values();
  }

  topByHeat(n: number): Anchor[] {
    return [...this.map.values()].sort((a, b) => b.heat - a.heat).slice(0, n);
  }

  prune(maxAge: number) {
    for (const [k, a] of this.map) {
      if (a.lastHit > maxAge && a.heat < 0.02) this.map.delete(k);
    }
  }

  clear() {
    this.map.clear();
  }

  size() {
    return this.map.size;
  }
}

// Compute a stable anchor coordinate for a key, given mode & dims.
export function anchorPosition(
  key: string,
  mode: Mode,
  width: number,
  height: number,
): { x: number; y: number } {
  const cx = width / 2;
  const cy = height / 2;
  const fx = hash32(key, 1);
  const fy = hash32(key, 2);
  switch (mode) {
    case "constellation": {
      const r = Math.min(width, height) * (0.22 + fy * 0.18);
      const a = fx * Math.PI * 2;
      return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
    }
    case "orbit": {
      // Anchor placed within annulus; the engine repositions top-N to centers.
      const r = Math.min(width, height) * (0.15 + fy * 0.3);
      const a = fx * Math.PI * 2;
      return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
    }
    case "rain": {
      // x is column, y will be assigned by flow itself (top→bottom)
      const pad = 40;
      return { x: pad + fx * (width - pad * 2), y: cy };
    }
    case "pulse": {
      const pad = 80;
      return { x: pad + fx * (width - pad * 2), y: pad + fy * (height - pad * 2) };
    }
    case "garden":
    default: {
      const pad = 80;
      return { x: pad + fx * (width - pad * 2), y: pad + fy * (height - pad * 2) };
    }
  }
}

// ============== Flows ==============

export interface FlowState {
  id: string;
  tx: Transaction;
  arch: Archetype;
  colorVar: string;
  origin: Anchor;
  dest: Anchor;
  age: number;
  duration: number; // travel time
  fade: number; // tail fade time after arrival
  curveK: number; // bezier curvature factor (-1..1)
  weight: number; // 0..1 visual weight (amount-based)
}

export function createFlow(
  tx: Transaction,
  origin: Anchor,
  dest: Anchor,
  duration: number,
): FlowState {
  const arch = archetypeFor(tx);
  const w = Math.min(1, Math.log10(1 + tx.amount) / 4);
  return {
    id: tx.hash,
    tx,
    arch,
    colorVar: colorVarFor(arch),
    origin,
    dest,
    age: 0,
    duration,
    fade: 0.7,
    curveK: (hash32(tx.hash, 31) - 0.5) * 1.6,
    weight: w,
  };
}

export function flowAlive(f: FlowState): number {
  const total = f.duration + f.fade;
  return Math.max(0, 1 - f.age / total);
}

// Position along bezier path for travel param u ∈ [0,1]
function bezierPoint(f: FlowState, u: number) {
  const { origin: o, dest: d, curveK } = f;
  const mx = (o.x + d.x) / 2;
  const my = (o.y + d.y) / 2;
  const dx = d.x - o.x;
  const dy = d.y - o.y;
  // Perpendicular offset for control point
  const px = -dy * 0.35 * curveK;
  const py = dx * 0.35 * curveK;
  const cx = mx + px;
  const cy = my + py;
  const it = 1 - u;
  const x = it * it * o.x + 2 * it * u * cx + u * u * d.x;
  const y = it * it * o.y + 2 * it * u * cy + u * u * d.y;
  return { x, y, cx, cy };
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export interface DrawCtx {
  ctx: CanvasRenderingContext2D;
  mode: Mode;
  width: number;
  height: number;
  time: number;
}

export function drawFlow(f: FlowState, dctx: DrawCtx) {
  const ctx = dctx.ctx;
  const travelT = Math.min(1, f.age / f.duration);
  const u = easeInOutCubic(travelT);
  const arrived = travelT >= 1;
  const fadeT = arrived ? Math.max(0, 1 - (f.age - f.duration) / f.fade) : 1;
  const aliveAlpha = fadeT;

  switch (dctx.mode) {
    case "constellation":
      drawArc(f, dctx, u, aliveAlpha, arrived);
      break;
    case "garden":
      drawSprout(f, dctx, travelT, aliveAlpha);
      break;
    case "orbit":
      drawOrbitSatellite(f, dctx, travelT, aliveAlpha);
      break;
    case "pulse":
      drawRipple(f, dctx, travelT, aliveAlpha);
      break;
    case "rain":
      drawRainStreak(f, dctx, travelT, aliveAlpha);
      break;
  }
}

function drawArc(
  f: FlowState,
  dctx: DrawCtx,
  u: number,
  alpha: number,
  arrived: boolean,
) {
  const ctx = dctx.ctx;
  const segments = 18;
  const trail = 0.28; // fraction of path visible behind head
  const uStart = Math.max(0, u - trail);
  ctx.lineCap = "round";
  ctx.lineWidth = 1 + f.weight * 1.4;
  // Tapered trail with gradient by sampling
  for (let i = 0; i < segments; i++) {
    const t0 = uStart + (i / segments) * (u - uStart);
    const t1 = uStart + ((i + 1) / segments) * (u - uStart);
    if (t1 <= t0) continue;
    const p0 = bezierPoint(f, t0);
    const p1 = bezierPoint(f, t1);
    const segAlpha = alpha * (i / segments) * 0.85;
    ctx.strokeStyle = cssVarHsl(f.colorVar, segAlpha);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
  // Comet head
  const head = bezierPoint(f, u);
  const headR = 2.2 + f.weight * 3;
  const grad = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, headR * 4);
  grad.addColorStop(0, cssVarHsl(f.colorVar, 0.9 * alpha));
  grad.addColorStop(0.4, cssVarHsl(f.colorVar, 0.25 * alpha));
  grad.addColorStop(1, cssVarHsl(f.colorVar, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(head.x, head.y, headR * 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cssVarHsl(f.colorVar, alpha);
  ctx.beginPath();
  ctx.arc(head.x, head.y, headR, 0, Math.PI * 2);
  ctx.fill();

  // Garden: sprout a tiny bloom at destination on arrival
  if (arrived && dctx.mode === "garden") {
    drawTinyBloom(ctx, f.dest.x, f.dest.y, f.colorVar, alpha, f.arch);
  }
}

function drawTinyBloom(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colorVar: string,
  alpha: number,
  arch: Archetype,
) {
  const petals = arch === "swap" ? 6 : arch === "nft" ? 4 : arch === "stake" ? 8 : 5;
  const r = 14;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = cssVarHsl(colorVar, 0.55 * alpha);
  ctx.lineWidth = 1;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(
      Math.cos(a) * r * 0.45,
      Math.sin(a) * r * 0.45,
      r * 0.45,
      r * 0.16,
      a,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }
  ctx.restore();
}

// Garden mode: each tx is a sprout that grows upward at the destination
// anchor. Stem height encodes gas; petal count encodes archetype.
function drawSprout(
  f: FlowState,
  dctx: DrawCtx,
  travelT: number,
  alpha: number,
) {
  const ctx = dctx.ctx;
  const x = f.dest.x;
  const baseY = f.dest.y;
  const gas = Math.max(0, f.tx.gasCost);
  const maxH = 28 + Math.min(60, Math.log10(1 + gas * 1e6) * 18);
  const grow = easeInOutCubic(Math.min(1, travelT * 1.4));
  const stemH = maxH * grow;
  // Stem
  ctx.strokeStyle = cssVarHsl(f.colorVar, 0.55 * alpha);
  ctx.lineWidth = 1 + f.weight * 1.2;
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.lineTo(x, baseY - stemH);
  ctx.stroke();
  // Bud / bloom at top once mostly grown
  if (grow > 0.5) {
    const bloomA = (grow - 0.5) * 2 * alpha;
    const petals =
      f.arch === "swap" ? 6
      : f.arch === "nft" ? 4
      : f.arch === "stake" ? 8
      : f.arch === "contract" ? 3
      : 5;
    const r = 4 + f.weight * 6;
    const tipY = baseY - stemH;
    ctx.save();
    ctx.translate(x, tipY);
    ctx.fillStyle = cssVarHsl(f.colorVar, 0.7 * bloomA);
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, r * 0.55, r * 0.22, a, 0, Math.PI * 2);
      ctx.fill();
    }
    // Center
    ctx.fillStyle = cssVarHsl(f.colorVar, 0.95 * bloomA);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Orbit mode: satellite revolves around its destination anchor once.
function drawOrbitSatellite(
  f: FlowState,
  dctx: DrawCtx,
  travelT: number,
  alpha: number,
) {
  const ctx = dctx.ctx;
  const cx = f.dest.x;
  const cy = f.dest.y;
  const radius = 12 + Math.min(60, Math.log10(1 + f.tx.amount) * 14) + f.weight * 8;
  // One full revolution over the duration; phase deterministic from hash.
  const phase = hash32(f.tx.hash, 7) * Math.PI * 2;
  const angle = phase + travelT * Math.PI * 2;
  const x = cx + Math.cos(angle) * radius;
  const y = cy + Math.sin(angle) * radius;
  // Faint orbit ring
  ctx.strokeStyle = cssVarHsl(f.colorVar, 0.12 * alpha);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  // Trailing arc behind satellite
  const trail = 0.35;
  const start = angle - trail * Math.PI * 2;
  ctx.strokeStyle = cssVarHsl(f.colorVar, 0.55 * alpha);
  ctx.lineWidth = 1.5 + f.weight * 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, start, angle);
  ctx.stroke();
  // Satellite head
  const headR = 2 + f.weight * 3;
  const grad = ctx.createRadialGradient(x, y, 0, x, y, headR * 4);
  grad.addColorStop(0, cssVarHsl(f.colorVar, 0.9 * alpha));
  grad.addColorStop(1, cssVarHsl(f.colorVar, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, headR * 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cssVarHsl(f.colorVar, alpha);
  ctx.beginPath();
  ctx.arc(x, y, headR, 0, Math.PI * 2);
  ctx.fill();
}

function drawRipple(
  f: FlowState,
  dctx: DrawCtx,
  travelT: number,
  alpha: number,
) {
  const ctx = dctx.ctx;
  const dist = Math.hypot(f.dest.x - f.origin.x, f.dest.y - f.origin.y);
  const radius = travelT * dist;
  const ringAlpha = alpha * (1 - travelT) * 0.7;
  if (ringAlpha <= 0.01) return;
  ctx.strokeStyle = cssVarHsl(f.colorVar, ringAlpha);
  ctx.lineWidth = 1 + f.weight * 1.5;
  ctx.beginPath();
  ctx.arc(f.origin.x, f.origin.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  // Origin glow
  if (travelT < 0.35) {
    const g = ctx.createRadialGradient(f.origin.x, f.origin.y, 0, f.origin.x, f.origin.y, 24);
    g.addColorStop(0, cssVarHsl(f.colorVar, 0.6 * (1 - travelT * 3)));
    g.addColorStop(1, cssVarHsl(f.colorVar, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(f.origin.x, f.origin.y, 24, 0, Math.PI * 2);
    ctx.fill();
  }
  // Destination flash on arrival
  if (travelT >= 0.95) {
    const flash = (travelT - 0.95) / 0.05;
    const g = ctx.createRadialGradient(f.dest.x, f.dest.y, 0, f.dest.x, f.dest.y, 30);
    g.addColorStop(0, cssVarHsl(f.colorVar, 0.7 * flash * alpha));
    g.addColorStop(1, cssVarHsl(f.colorVar, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(f.dest.x, f.dest.y, 30, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRainStreak(
  f: FlowState,
  dctx: DrawCtx,
  travelT: number,
  alpha: number,
) {
  const ctx = dctx.ctx;
  const x = f.origin.x;
  const y = -20 + travelT * (dctx.height + 40);
  const len = 30 + f.weight * 80;
  const grad = ctx.createLinearGradient(x, y - len, x, y);
  grad.addColorStop(0, cssVarHsl(f.colorVar, 0));
  grad.addColorStop(1, cssVarHsl(f.colorVar, 0.7 * alpha));
  ctx.fillStyle = grad;
  const w = 1.5 + f.weight * 1.5;
  ctx.fillRect(x - w / 2, y - len, w, len);
  // head dot
  ctx.fillStyle = cssVarHsl(f.colorVar, 0.9 * alpha);
  ctx.beginPath();
  ctx.arc(x, y, w * 0.8, 0, Math.PI * 2);
  ctx.fill();
}

// ============== Anchor rendering (nodes) ==============

export function drawAnchor(a: Anchor, ctx: CanvasRenderingContext2D, mode: Mode) {
  if (mode === "rain") return; // rain has no node concept
  const baseAlpha = 0.18 + a.heat * 0.5;
  const r = 1.5 + a.heat * 4 + a.pulse * 3;
  const glowR = 6 + a.heat * 18 + a.pulse * 14;
  const grad = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, glowR);
  grad.addColorStop(0, cssVarHsl("--primary", 0.18 * baseAlpha + a.pulse * 0.3));
  grad.addColorStop(1, cssVarHsl("--primary", 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(a.x, a.y, glowR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cssVarHsl("--foreground", baseAlpha);
  ctx.beginPath();
  ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
  ctx.fill();
}

// ============== Background ==============

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  _tps: number,
  _time: number,
) {
  // Trail wash — slightly stronger so old strokes clear
  ctx.fillStyle = cssVarHsl("--background", 0.32);
  ctx.fillRect(0, 0, w, h);

  // Faint dot grid
  const spacing = 48;
  ctx.fillStyle = cssVarHsl("--foreground", 0.04);
  for (let x = spacing / 2; x < w; x += spacing) {
    for (let y = spacing / 2; y < h; y += spacing) {
      ctx.fillRect(x, y, 1, 1);
    }
  }
}