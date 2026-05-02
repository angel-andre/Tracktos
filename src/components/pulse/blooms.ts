import type { Transaction } from "@/hooks/useRealtimeTransactions";
import type { Motion } from "./positioning";
import type { Mode } from "./modes";

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
  mode: Mode;
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

  // Inner soft glow halo (skipped for cell-style modes that fill themselves)
  const noHalo = dctx.mode === "grid" || dctx.mode === "rain" || dctx.mode === "waveform";
  if (!noHalo) {
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.4);
    halo.addColorStop(0, glow);
    halo.addColorStop(1, cssVarHsl(b.colorVar, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

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
  const fill = cssVarHsl(b.colorVar, baseAlpha * 0.55);

  switch (dctx.mode) {
    case "garden":
      drawGarden(ctx, r, b.archetype);
      break;
    case "stream":
      drawStream(ctx, r, b);
      break;
    case "constellation":
      drawConstellation(ctx, r);
      break;
    case "spiral":
      drawSpiral(ctx, r, amtBoost);
      break;
    case "rain":
      drawRain(ctx, r, b, fill);
      break;
    case "orbit":
      drawOrbit(ctx, r, fill);
      break;
    case "grid":
      drawGridCell(ctx, r, t, fill);
      break;
    case "waveform":
      drawWaveformBar(ctx, r, b, fill);
      break;
    case "fireworks":
      drawFirework(ctx, r, b, t);
      break;
    case "swarm":
      drawSwarmFish(ctx, r, b, fill);
      break;
    case "mandala":
      drawMandalaShard(ctx, r);
      break;
    default:
      drawGarden(ctx, r, b.archetype);
  }

  // Tiny archetype accent so tx type stays readable (skip for cell modes)
  if (!noHalo && dctx.mode !== "fireworks") {
    drawArchetypeAccent(ctx, b.archetype, r, baseAlpha);
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

// ============== Per-mode renderers ==============
// Each renderer is in local coords (translated+rotated to bloom origin).

function drawGarden(ctx: CanvasRenderingContext2D, r: number, arch: Archetype) {
  // Soft botanical bloom — varied petal counts so it doesn't look uniform
  const petals = arch === "swap" ? 6 : arch === "nft" ? 4 : arch === "stake" ? 8 : 5;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(
      Math.cos(a) * r * 0.5,
      Math.sin(a) * r * 0.5,
      r * 0.5,
      r * 0.18,
      a,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
  ctx.stroke();
}

function drawStream(ctx: CanvasRenderingContext2D, r: number, b: BloomState) {
  // Comet — leading dot + tapering tail to the left (motion is +x)
  const tailLen = r * 2.2;
  const grad = ctx.createLinearGradient(-tailLen, 0, 0, 0);
  grad.addColorStop(0, cssVarHsl(b.colorVar, 0));
  grad.addColorStop(1, cssVarHsl(b.colorVar, 0.7 * aliveFrac(b)));
  ctx.strokeStyle = grad;
  ctx.lineWidth = Math.max(2, r * 0.18);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-tailLen, 0);
  ctx.lineTo(0, 0);
  ctx.stroke();
  ctx.fillStyle = cssVarHsl(b.colorVar, 0.9 * aliveFrac(b));
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

function drawConstellation(ctx: CanvasRenderingContext2D, r: number) {
  // 4-point star + small dot
  const arms = 4;
  ctx.beginPath();
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2;
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
  }
  ctx.stroke();
  ctx.fillStyle = ctx.strokeStyle as string;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.14, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpiral(ctx: CanvasRenderingContext2D, r: number, amtBoost: number) {
  // Rotating pinwheel — 3 swept arms
  const arms = 3;
  for (let i = 0; i < arms; i++) {
    ctx.save();
    ctx.rotate((i / arms) * Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(r * 0.4, -r * 0.3, r * (0.7 + amtBoost * 0.3), 0);
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = ctx.strokeStyle as string;
  ctx.fill();
}

function drawRain(
  ctx: CanvasRenderingContext2D,
  r: number,
  b: BloomState,
  fill: string,
) {
  // Vertical streak — bright head, fading vertical trail upward (motion is +y)
  // We're rotated by b.rotation; undo that to keep streak truly vertical.
  ctx.rotate(-b.rotation);
  const w = Math.max(2, r * 0.18);
  const h = r * 1.8;
  const grad = ctx.createLinearGradient(0, -h, 0, 0);
  grad.addColorStop(0, cssVarHsl(b.colorVar, 0));
  grad.addColorStop(1, cssVarHsl(b.colorVar, 0.7 * aliveFrac(b)));
  ctx.fillStyle = grad;
  ctx.fillRect(-w / 2, -h, w, h);
  // bright head
  ctx.fillStyle = fill;
  ctx.fillRect(-w * 0.9, 0, w * 1.8, w * 1.8);
}

function drawOrbit(ctx: CanvasRenderingContext2D, r: number, fill: string) {
  // Solid planet + thin orbital ring + tiny moon
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.85, r * 0.32, 0.4, 0, Math.PI * 2);
  ctx.stroke();
  // moon
  ctx.beginPath();
  ctx.arc(r * 0.78, -r * 0.18, r * 0.09, 0, Math.PI * 2);
  ctx.fill();
}

function drawGridCell(
  ctx: CanvasRenderingContext2D,
  r: number,
  t: number,
  fill: string,
) {
  // Filled rounded square cell that flashes on birth and decays
  const flash = 1 - Math.pow(1 - t, 4); // bright early
  const s = r * 1.2;
  ctx.fillStyle = fill;
  ctx.globalAlpha = 0.35 + 0.55 * flash;
  const radius = Math.min(s * 0.4, 8);
  roundRect(ctx, -s, -s, s * 2, s * 2, radius);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.stroke();
}

function drawWaveformBar(
  ctx: CanvasRenderingContext2D,
  r: number,
  b: BloomState,
  fill: string,
) {
  // Vertical bar — undo rotation, height proportional to amount, anchored at canvas vertical center.
  ctx.rotate(-b.rotation);
  const w = Math.max(2, r * 0.18);
  const amt = Math.min(1, Math.log10(b.tx.amount + 1) / 4);
  const h = 30 + amt * 220;
  ctx.fillStyle = fill;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  // tip caps
  ctx.beginPath();
  ctx.arc(0, -h / 2, w * 0.6, 0, Math.PI * 2);
  ctx.arc(0, h / 2, w * 0.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawFirework(
  ctx: CanvasRenderingContext2D,
  r: number,
  b: BloomState,
  t: number,
) {
  ctx.rotate(-b.rotation);
  const isExplode = b.motion.kind === "burst" && b.motion.phase === "explode";
  if (!isExplode) {
    // rising spark — small dot with short downward trail
    ctx.fillStyle = cssVarHsl(b.colorVar, 0.9 * t);
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(2, r * 0.18), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = cssVarHsl(b.colorVar, 0.4 * t);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, r * 0.6);
    ctx.stroke();
  } else {
    // radial burst — 12 lines outward, length grows with age past explode
    const growth = Math.min(1, (b.age - 0.5) * 1.2);
    const len = r * (0.8 + growth * 1.6);
    const lines = 12;
    ctx.strokeStyle = cssVarHsl(b.colorVar, 0.85 * t);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < lines; i++) {
      const a = (i / lines) * Math.PI * 2;
      ctx.moveTo(Math.cos(a) * r * 0.15, Math.sin(a) * r * 0.15);
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    }
    ctx.stroke();
  }
}

function drawSwarmFish(
  ctx: CanvasRenderingContext2D,
  r: number,
  b: BloomState,
  fill: string,
) {
  // Triangle oriented along velocity
  ctx.rotate(-b.rotation);
  const heading = Math.atan2(b.vy, b.vx) || 0;
  ctx.rotate(heading);
  const s = r * 0.5;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(s, 0);
  ctx.lineTo(-s * 0.7, s * 0.5);
  ctx.lineTo(-s * 0.4, 0);
  ctx.lineTo(-s * 0.7, -s * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawMandalaShard(ctx: CanvasRenderingContext2D, r: number) {
  // 6-point angular star
  const points = 6;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2;
    const rad = i % 2 === 0 ? r * 0.7 : r * 0.28;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
}

function drawArchetypeAccent(
  ctx: CanvasRenderingContext2D,
  arch: Archetype,
  r: number,
  alpha: number,
) {
  ctx.save();
  ctx.fillStyle = cssVarHsl("--foreground", alpha * 0.35);
  ctx.strokeStyle = cssVarHsl("--foreground", alpha * 0.35);
  ctx.lineWidth = 1;
  const s = Math.max(2, r * 0.09);
  switch (arch) {
    case "transfer":
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "swap":
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = Math.cos(a) * s * 1.3;
        const y = Math.sin(a) * s * 1.3;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      break;
    case "stake":
      ctx.beginPath();
      ctx.arc(0, 0, s * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "nft":
      ctx.strokeRect(-s, -s, s * 2, s * 2);
      break;
    case "contract":
      ctx.beginPath();
      ctx.moveTo(0, s * 1.5);
      ctx.lineTo(0, -s * 0.3);
      ctx.moveTo(0, -s * 0.3);
      ctx.lineTo(-s, -s * 1.2);
      ctx.moveTo(0, -s * 0.3);
      ctx.lineTo(s, -s * 1.2);
      ctx.stroke();
      break;
    default:
      break;
  }
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
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