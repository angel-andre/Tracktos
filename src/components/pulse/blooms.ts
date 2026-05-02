import type { Transaction } from "@/hooks/useRealtimeTransactions";
import type { Motion } from "./positioning";

// Resolve an HSL CSS variable (e.g. "--chart-1") to a usable color string.
// Returns "hsl(H S% L% / a)" using the live computed value so light/dark themes Just Work.
function cssVarHsl(varName: string, alpha = 1): string {
  if (typeof window === "undefined") return `hsl(0 0% 50% / ${alpha})`;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  if (!raw) return `hsl(0 0% 50% / ${alpha})`;
  return `hsl(${raw} / ${alpha})`;
}

export interface BloomState {
  id: string; // tx.hash
  tx: Transaction;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number; // seconds since born
  life: number; // total life in seconds
  radius: number;
  archetype: Archetype;
  colorVar: string;
  rotation: number;
  motion: Motion;
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
    case "Transfer":
      return "transfer";
    case "Swap":
      return "swap";
    case "Stake":
      return "stake";
    case "NFT":
      return "nft";
    case "Contract":
      return "contract";
    default:
      return "default";
  }
}

export function colorVarFor(arch: Archetype): string {
  // Map to existing chart tokens so themes adapt
  switch (arch) {
    case "transfer":
      return "--chart-1"; // Aptos green
    case "swap":
      return "--chart-5"; // warm orange
    case "stake":
      return "--chart-3"; // deep teal-ish (acts as purple stand-in in this palette)
    case "nft":
      return "--chart-4"; // yellow
    case "contract":
      return "--chart-2"; // teal
    default:
      return "--primary";
  }
}

export function radiusFor(tx: Transaction): number {
  // log-scaled gas, clamped 24..160
  const g = Math.max(0.0000001, tx.gasCost);
  const r = 28 + Math.log10(g * 1e8 + 10) * 18;
  return Math.max(24, Math.min(160, r));
}

export function lifeFor(): number {
  return 12; // seconds visible
}

export function createBloom(
  tx: Transaction,
  x: number,
  y: number,
  vx = 0,
  vy = 0,
  motion: Motion = { kind: "linear" },
): BloomState {
  const arch = archetypeFor(tx);
  return {
    id: tx.hash,
    tx,
    x,
    y,
    vx,
    vy,
    age: 0,
    life: lifeFor(),
    radius: radiusFor(tx),
    archetype: arch,
    colorVar: colorVarFor(arch),
    rotation: (parseInt(tx.version.slice(-4) || "0", 10) % 360) * (Math.PI / 180),
    motion,
  };
}

export function tickBloom(b: BloomState, dt: number) {
  b.age += dt;
  b.rotation += dt * 0.4;
  const m = b.motion;
  switch (m.kind) {
    case "linear":
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      break;
    case "stream":
    case "scroll":
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      break;
    case "fall":
      b.y += m.speed * dt;
      break;
    case "orbit": {
      m.theta += m.omega * dt;
      b.x = m.cx + Math.cos(m.theta) * m.r;
      b.y = m.cy + Math.sin(m.theta) * m.r;
      break;
    }
    case "spiral": {
      m.theta += m.omega * dt;
      m.r += m.growth * dt;
      b.x = m.cx + Math.cos(m.theta) * m.r;
      b.y = m.cy + Math.sin(m.theta) * m.r;
      break;
    }
    case "boid": {
      // Steer toward attractor with damping
      const dx = m.tx - b.x;
      const dy = m.ty - b.y;
      b.vx += dx * dt * 0.6;
      b.vy += dy * dt * 0.6;
      b.vx *= 0.92;
      b.vy *= 0.92;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      break;
    }
    case "burst": {
      if (m.phase === "rise") {
        b.vy += 380 * dt; // gravity
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.age >= m.explodeAt) {
          m.phase = "explode";
        }
      } else {
        // expand outward, fade fast
        b.x += b.vx * dt * 0.3;
        b.y += b.vy * dt * 0.3;
      }
      break;
    }
  }
}

// Returns 0..1 alive fraction (1 = just born, 0 = gone)
export function aliveFrac(b: BloomState): number {
  return Math.max(0, 1 - b.age / b.life);
}

export interface DrawCtx {
  ctx: CanvasRenderingContext2D;
  hovered?: boolean;
}

export function drawBloom(b: BloomState, dctx: DrawCtx) {
  const t = aliveFrac(b);
  if (t <= 0) return;
  const grow = 1 - Math.pow(1 - Math.min(1, b.age / 0.6), 3); // ease-out bloom growth in first 0.6s
  const r = b.radius * (0.4 + 0.6 * grow);
  const baseAlpha = 0.18 + 0.7 * t;
  const stroke = cssVarHsl(b.colorVar, baseAlpha);
  const glow = cssVarHsl(b.colorVar, 0.08 * t);
  const ctx = dctx.ctx;

  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.rotation);

  // Inner soft glow halo
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.4);
  halo.addColorStop(0, glow);
  halo.addColorStop(1, cssVarHsl(b.colorVar, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.4, 0, Math.PI * 2);
  ctx.fill();

  // Failed → dashed destructive stroke override
  if (!b.tx.success) {
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = cssVarHsl("--destructive", 0.7 * t);
  } else {
    ctx.setLineDash([]);
    ctx.strokeStyle = stroke;
  }
  const amtBoost = Math.min(1, Math.log10(b.tx.amount + 1) / 3);
  ctx.lineWidth = 1 + amtBoost * 2.5;

  switch (b.archetype) {
    case "transfer":
      drawTransferShape(ctx, r, t);
      break;
    case "swap":
      drawSwapShape(ctx, r);
      break;
    case "stake":
      drawStakeShape(ctx, r, t);
      break;
    case "nft":
      drawNftShape(ctx, r);
      break;
    case "contract":
      drawContractShape(ctx, r);
      break;
    default:
      drawDefaultShape(ctx, r);
  }

  if (dctx.hovered) {
    ctx.setLineDash([]);
    ctx.strokeStyle = cssVarHsl("--foreground", 0.6);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.55, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawTransferShape(ctx: CanvasRenderingContext2D, r: number, t: number) {
  // Two nodes joined by a line, with a particle traveling along it
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-r, 0, 3, 0, Math.PI * 2);
  ctx.arc(r, 0, 3, 0, Math.PI * 2);
  ctx.fillStyle = ctx.strokeStyle as string;
  ctx.fill();
  // traveling dot
  const px = -r + (1 - t) * (r * 2);
  ctx.beginPath();
  ctx.arc(px, 0, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawSwapShape(ctx: CanvasRenderingContext2D, r: number) {
  // Hexagonal petal burst
  const petals = 6;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(
      Math.cos(a) * r * 0.55,
      Math.sin(a) * r * 0.55,
      r * 0.45,
      r * 0.18,
      a,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }
}

function drawStakeShape(ctx: CanvasRenderingContext2D, r: number, t: number) {
  // Concentric expanding rings
  for (let i = 0; i < 4; i++) {
    const rr = r * (0.3 + i * 0.22);
    ctx.globalAlpha = 0.15 + 0.25 * t * (1 - i / 4);
    ctx.beginPath();
    ctx.arc(0, 0, rr, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawNftShape(ctx: CanvasRenderingContext2D, r: number) {
  // Square kaleidoscope: 4 nested rotated squares
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 8);
    const s = r * (0.4 + i * 0.18);
    ctx.strokeRect(-s, -s, s * 2, s * 2);
    ctx.restore();
  }
}

function drawContractShape(ctx: CanvasRenderingContext2D, r: number) {
  // Branching tree (3 levels)
  function branch(len: number, depth: number) {
    if (depth === 0 || len < 2) return;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -len);
    ctx.stroke();
    ctx.save();
    ctx.translate(0, -len);
    ctx.rotate(0.5);
    branch(len * 0.7, depth - 1);
    ctx.restore();
    ctx.save();
    ctx.translate(0, -len);
    ctx.rotate(-0.5);
    branch(len * 0.7, depth - 1);
    ctx.restore();
  }
  branch(r * 0.7, 3);
}

function drawDefaultShape(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
  ctx.stroke();
}

// Faint persistent ring "scar" left after a bloom expires
export interface Scar {
  x: number;
  y: number;
  radius: number;
  colorVar: string;
  age: number;
  life: number;
}

export function drawScar(s: Scar, ctx: CanvasRenderingContext2D) {
  const t = Math.max(0, 1 - s.age / s.life);
  if (t <= 0) return;
  ctx.strokeStyle = cssVarHsl(s.colorVar, 0.08 * t);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(s.x, s.y, s.radius * (1 + (1 - t) * 0.4), 0, Math.PI * 2);
  ctx.stroke();
}

export { cssVarHsl };