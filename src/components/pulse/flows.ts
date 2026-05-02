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
  success: boolean; // tx.success — failed txs render distinctly
  whale: boolean; // unusually large amount → bigger / haloed
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
    colorVar: tx.success === false ? "--destructive" : colorVarFor(arch),
    origin,
    dest,
    age: 0,
    duration,
    fade: 0.7,
    curveK: (hash32(tx.hash, 31) - 0.5) * 1.6,
    weight: w,
    success: tx.success !== false,
    whale: !!tx.whale || tx.amount >= 1000,
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
  ctx.lineWidth = 1 + f.weight * 1.4 + (f.whale ? 1.4 : 0);
  // Failed transactions render with a short dashed stroke instead of solid.
  if (!f.success) ctx.setLineDash([4, 3]);
  else ctx.setLineDash([]);
  // Tapered trail with gradient by sampling
  for (let i = 0; i < segments; i++) {
    const t0 = uStart + (i / segments) * (u - uStart);
    const t1 = uStart + ((i + 1) / segments) * (u - uStart);
    if (t1 <= t0) continue;
    const p0 = bezierPoint(f, t0);
    const p1 = bezierPoint(f, t1);
    const segAlpha = alpha * (i / segments) * (f.success ? 0.85 : 0.5);
    ctx.strokeStyle = cssVarHsl(f.colorVar, segAlpha);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Comet head
  const head = bezierPoint(f, u);
  const headR = 2.2 + f.weight * 3 + (f.whale ? 2 : 0);
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
  // Whale halo ring at the head — unmistakable for big movements.
  if (f.whale) {
    ctx.strokeStyle = cssVarHsl(f.colorVar, 0.6 * alpha);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(head.x, head.y, headR * 2.6, 0, Math.PI * 2);
    ctx.stroke();
  }

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
  ctx.lineWidth = 1 + f.weight * 1.5 + (f.whale ? 1 : 0);
  if (!f.success) ctx.setLineDash([5, 4]);
  // Per-archetype ring shape — each tx type has a distinct silhouette.
  drawShapedRing(ctx, f.origin.x, f.origin.y, radius, f.arch);
  ctx.setLineDash([]);
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

// Draw a closed polygon ring centered on (cx, cy) with the given "radius"
// (vertex distance). Each archetype gets a distinct silhouette so a viewer
// can read transaction type at a glance, even from a still frame.
function drawShapedRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  arch: Archetype,
) {
  let sides: number;
  let rotation = 0;
  switch (arch) {
    case "transfer": sides = 0; break; // circle
    case "swap":     sides = 4; rotation = Math.PI / 4; break; // diamond
    case "stake":    sides = 6; break; // hexagon
    case "nft":      sides = 8; break; // octagon
    case "contract": sides = 3; rotation = -Math.PI / 2; break; // triangle
    default:         sides = 0; break;
  }
  if (sides === 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  ctx.beginPath();
  for (let i = 0; i <= sides; i++) {
    const a = rotation + (i / sides) * Math.PI * 2;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
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
  time: number,
) {
  // Trail wash — slightly stronger so old strokes clear
  ctx.fillStyle = cssVarHsl("--background", 0.32);
  ctx.fillRect(0, 0, w, h);

  // Faint dot grid
  const spacing = 48;
  // Very low-frequency idle shimmer on the grid so the canvas reads
  // "alive, listening" before the first burst lands. This is purely a
  // background hint — capped well below visual noise threshold.
  const shimmer = 0.03 + 0.012 * (0.5 + 0.5 * Math.sin(time * 0.4));
  ctx.fillStyle = cssVarHsl("--foreground", shimmer);
  for (let x = spacing / 2; x < w; x += spacing) {
    for (let y = spacing / 2; y < h; y += spacing) {
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

// ============== Phantom particles ==============
// Light, hash-less micro-dots derived from the gap between mainnet's
// versionDelta and the txs we actually rendered. Their *count* is real;
// we just don't have hashes for them, so they render as quiet motes that
// make canvas density honestly reflect network throughput.

export interface PhantomParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
}

export class PhantomField {
  private parts: PhantomParticle[] = [];
  private cap = 220;

  spawn(count: number, w: number, h: number) {
    if (count <= 0) return;
    // Cap so a huge backlog doesn't crush the field; keep things calm.
    const n = Math.min(count, 80);
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 8 + Math.random() * 22;
      this.parts.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        life: 0.9 + Math.random() * 1.4,
      });
    }
    if (this.parts.length > this.cap) {
      this.parts.splice(0, this.parts.length - this.cap);
    }
  }

  tick(dt: number) {
    const live: PhantomParticle[] = [];
    for (const p of this.parts) {
      p.age += dt;
      if (p.age >= p.life) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      live.push(p);
    }
    this.parts = live;
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.parts) {
      const t = p.age / p.life;
      const a = Math.max(0, 0.32 * (1 - t));
      ctx.fillStyle = cssVarHsl("--foreground", a);
      ctx.fillRect(p.x, p.y, 1.2, 1.2);
    }
  }

  clear() {
    this.parts = [];
  }
}

// ============== Garden bed (persistent flowers) ==============

export interface PlantedFlower {
  x: number;
  y: number;
  arch: Archetype;
  colorVar: string;
  height: number; // stem max height in px
  weight: number;
  bornAt: number; // canvas time
  whale: boolean;
}

export class GardenBed {
  private flowers: PlantedFlower[] = [];
  private cap = 140;

  plant(f: PlantedFlower) {
    this.flowers.push(f);
    if (this.flowers.length > this.cap) this.flowers.shift();
  }

  draw(ctx: CanvasRenderingContext2D, time: number) {
    for (const fl of this.flowers) {
      const age = time - fl.bornAt;
      // Sway in a gentle breeze; older flowers fade slightly.
      const sway = Math.sin(age * 1.2 + fl.x * 0.05) * 2.5;
      const fade = Math.max(0.35, 1 - age / 90); // visible ~90s
      const baseY = fl.y;
      const stemH = fl.height;
      ctx.strokeStyle = cssVarHsl(fl.colorVar, 0.28 * fade);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(fl.x, baseY);
      ctx.quadraticCurveTo(fl.x + sway * 0.5, baseY - stemH / 2, fl.x + sway, baseY - stemH);
      ctx.stroke();
      const petals =
        fl.arch === "swap" ? 6
        : fl.arch === "nft" ? 4
        : fl.arch === "stake" ? 8
        : fl.arch === "contract" ? 3
        : 5;
      const r = (3 + fl.weight * 5) * (fl.whale ? 1.6 : 1);
      const tipX = fl.x + sway;
      const tipY = baseY - stemH;
      ctx.save();
      ctx.translate(tipX, tipY);
      ctx.fillStyle = cssVarHsl(fl.colorVar, 0.55 * fade);
      for (let i = 0; i < petals; i++) {
        const a = (i / petals) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, r * 0.55, r * 0.22, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = cssVarHsl(fl.colorVar, 0.85 * fade);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  clear() {
    this.flowers = [];
  }
}

// ============== Rain puddles ==============

export interface Puddle {
  x: number;
  age: number;
  colorVar: string;
  weight: number;
}

export class PuddleField {
  private puddles: Puddle[] = [];
  private cap = 60;

  splash(x: number, colorVar: string, weight: number) {
    this.puddles.push({ x, age: 0, colorVar, weight });
    if (this.puddles.length > this.cap) this.puddles.shift();
  }

  tick(dt: number) {
    const live: Puddle[] = [];
    for (const p of this.puddles) {
      p.age += dt;
      if (p.age < 1.6) live.push(p);
    }
    this.puddles = live;
  }

  draw(ctx: CanvasRenderingContext2D, h: number) {
    for (const p of this.puddles) {
      const t = p.age / 1.6;
      const r = 6 + t * 36 + p.weight * 10;
      const a = (1 - t) * 0.45;
      ctx.strokeStyle = cssVarHsl(p.colorVar, a);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(p.x, h - 10, r, r * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  clear() {
    this.puddles = [];
  }
}

// ============== Constellation persistent edges ==============

export interface PersistEdge {
  ax: number; ay: number;
  bx: number; by: number;
  bornAt: number;
  colorVar: string;
}

export class EdgeMemory {
  private edges: PersistEdge[] = [];
  private cap = 80;
  private lifetime = 45; // seconds

  add(ax: number, ay: number, bx: number, by: number, colorVar: string, time: number) {
    this.edges.push({ ax, ay, bx, by, bornAt: time, colorVar });
    if (this.edges.length > this.cap) this.edges.shift();
  }

  draw(ctx: CanvasRenderingContext2D, time: number) {
    const live: PersistEdge[] = [];
    for (const e of this.edges) {
      const age = time - e.bornAt;
      if (age >= this.lifetime) continue;
      const a = (1 - age / this.lifetime) * 0.22;
      ctx.strokeStyle = cssVarHsl(e.colorVar, a);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(e.ax, e.ay);
      ctx.lineTo(e.bx, e.by);
      ctx.stroke();
      live.push(e);
    }
    this.edges = live;
  }

  clear() {
    this.edges = [];
  }
}

// ============== Pulse mode heartbeat line ==============
// A faint horizontal sweep that ticks every time a new block lands.

export function drawHeartbeat(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sinceBlock: number,
) {
  if (sinceBlock < 0 || sinceBlock > 1.4) return;
  const t = sinceBlock / 1.4;
  const y = h * 0.5;
  const x = t * w;
  ctx.strokeStyle = cssVarHsl("--primary", 0.18 * (1 - t));
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(x - 30, y);
  ctx.lineTo(x - 18, y - 12);
  ctx.lineTo(x - 6, y + 16);
  ctx.lineTo(x, y);
  ctx.lineTo(w, y);
  ctx.stroke();
}

// ============== Epoch progress ring ==============

export function drawEpochRing(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  progress: number, // 0..1
) {
  if (!isFinite(progress) || progress < 0) return;
  const cx = w - 28;
  const cy = 28;
  const r = 14;
  ctx.strokeStyle = cssVarHsl("--foreground", 0.12);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = cssVarHsl("--primary", 0.85);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
  ctx.stroke();
}

// ============== Block-tick flash (full-screen subtle vignette) ==============

export function drawBlockFlash(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sinceBlock: number,
) {
  if (sinceBlock < 0 || sinceBlock > 0.6) return;
  const t = sinceBlock / 0.6;
  const a = (1 - t) * 0.08;
  const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
  grad.addColorStop(0, cssVarHsl("--primary", 0));
  grad.addColorStop(1, cssVarHsl("--primary", a));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

// ============== Whale moment (rare, dramatic full-canvas pulse) ==============

export function drawWhaleVignette(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sinceWhale: number,
) {
  if (sinceWhale < 0 || sinceWhale > 2.2) return;
  const t = sinceWhale / 2.2;
  // Two overlapping radial pulses for richness.
  const a1 = Math.sin(t * Math.PI) * 0.22;
  const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.85);
  grad.addColorStop(0, cssVarHsl("--primary", a1 * 0.6));
  grad.addColorStop(0.4, cssVarHsl("--primary", a1 * 0.3));
  grad.addColorStop(1, cssVarHsl("--primary", 0));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // Border glow
  ctx.strokeStyle = cssVarHsl("--primary", a1 * 0.9);
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, w - 4, h - 4);
}

// ============== Known address dictionary (for Orbit "named planets") ==============

const KNOWN_MODULES: Record<string, string> = {
  "0x1::aptos_account": "Core",
  "0x1::coin": "Coin",
  "0x1::stake": "Stake",
  "0x1::delegation_pool": "Delegation",
  "0x3::token": "Tokens v1",
  "0x4::token": "Tokens v2",
};

export function labelForKey(key: string): string | null {
  // key is `module::fn` for destinations — match prefix.
  for (const k in KNOWN_MODULES) {
    if (key.startsWith(k)) return KNOWN_MODULES[k];
  }
  // Fall back to module name only if it's recognizable
  const parts = key.split("::");
  if (parts.length >= 2 && parts[1] && parts[1].length < 18) {
    return parts[1];
  }
  return null;
}

export function drawPlanetLabel(
  ctx: CanvasRenderingContext2D,
  a: Anchor,
  label: string,
) {
  ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = cssVarHsl("--foreground", 0.65);
  ctx.textAlign = "center";
  ctx.fillText(label, a.x, a.y + 28);
}

// Render a "planet" — a halo ring + bright nucleus around a hot anchor.
// Used in Orbit mode to make top-K addresses look like gravitational
// centers around which their txs visibly orbit.
export function drawPlanetCenter(
  a: Anchor,
  ctx: CanvasRenderingContext2D,
  rank: number, // 0 = hottest
  time: number,
) {
  const intensity = Math.max(0.25, 1 - rank * 0.12);
  const baseR = 4 + intensity * 5;
  const breathe = 0.85 + 0.15 * Math.sin(time * 1.2 + rank);
  const r = baseR * breathe;
  // Outer halo
  const haloR = r * 5;
  const grad = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, haloR);
  grad.addColorStop(0, cssVarHsl("--primary", 0.22 * intensity));
  grad.addColorStop(0.5, cssVarHsl("--primary", 0.06 * intensity));
  grad.addColorStop(1, cssVarHsl("--primary", 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(a.x, a.y, haloR, 0, Math.PI * 2);
  ctx.fill();
  // Faint outer ring
  ctx.strokeStyle = cssVarHsl("--primary", 0.18 * intensity);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(a.x, a.y, r * 2.4, 0, Math.PI * 2);
  ctx.stroke();
  // Nucleus
  ctx.fillStyle = cssVarHsl("--foreground", 0.7 * intensity);
  ctx.beginPath();
  ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
  ctx.fill();
}