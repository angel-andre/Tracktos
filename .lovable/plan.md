## Goal

Add a new page at `/pulse` to Tracktos that visualizes live Aptos transactions as an original, generative artwork — distinct from both the existing `/globe` page and the Soundtos repo's vertical "rain" aesthetic. Reuses the existing `useRealtimeTransactions` hook (3s polling) so no new edge function or backend work is required.

## The Visual Concept: "Aptos Bloom"

Instead of falling notes (Soundtos) or a rotating earth (current globe), each new transaction is rendered as a **bloom** — a procedural radial burst on a dark canvas. The composition behaves like a living, slowly-decaying generative painting.

```text
                  · ✦ ·
              ✧         ✧
           ·   ◉ ─── ◉   ·       ← a "Swap" bloom (orange, 6 petals)
              ✧    ◉    ✧
                  · ✦ ·

   ◉ ── ◉ ── ◉                   ← a "Transfer" line-bloom (green)

         · · · ◯ · · ·            ← old blooms fading into dust rings
```

**Mapping (data → visual)**
- Transaction **type** → color + shape archetype
  - Transfer → green, two-node line with traveling particle
  - Swap → orange, rotating hexagonal petal burst
  - Stake → purple, slow concentric expanding rings
  - NFT → yellow, square-grid kaleidoscope
  - Contract → blue, branching tree (L-system, 3 levels)
  - Other → cyan, simple soft-glow dot
- **Gas cost** → bloom radius (log-scaled, clamped 20–180 px)
- **APT amount** → outline thickness + inner glow intensity
- **Success** → solid colored stroke; **Failed** → dashed red stroke
- **Sender address hash** → deterministic XY position via `hash → 2 floats`, so the same wallet always blooms in the same region (creates recognizable "neighborhoods" over time)
- **Time** → blooms fade over ~12s, leaving a faint ring "scar" that persists ~60s before disappearing

**Composition modes** (toggle in top bar)
1. **Garden** (default) — blooms placed by sender hash, builds a persistent field
2. **Stream** — blooms enter from the left edge and drift right, exit-fading (timeline feel)
3. **Constellation** — blooms placed at fixed validator positions; lines connect tx → its block proposer

**Ambient layer**
- Background: animated noise gradient using existing `--primary` (Aptos green) at very low alpha, drifting slowly
- TPS pulse: the entire canvas brightness breathes at the current TPS rate (subtle, ±5%)
- A thin ring around the canvas edge fills based on **epoch progress** (reusing `txStats.ledgerTimestamp`)

## UX & Layout

```text
┌─────────────────────────────────────────────────────────────┐
│  ← back   Aptos Pulse        [Garden|Stream|Constellation]  │
│                              TPS 142 · Block 1.2B · Live ●  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                    [ FULL-BLEED CANVAS ]                     │
│                                                              │
│   ┌──────────────┐                       ┌────────────────┐ │
│   │ Legend       │                       │ Last 5 blooms  │ │
│   │ ● Transfer   │                       │ Swap  0.42 APT │ │
│   │ ● Swap …     │                       │ Stake 12 APT…  │ │
│   └──────────────┘                       └────────────────┘ │
│                                                              │
│           [⏸ Pause]  [📷 Snapshot]  [↗ Density slider]      │
└─────────────────────────────────────────────────────────────┘
```

- Click a bloom → small glass card with hash, type, amount, link to Aptos explorer (reuses existing pattern from `Globe.tsx`)
- Hover → highlights other blooms by the same sender
- Pause freezes the canvas; Snapshot exports current canvas as PNG
- Density slider caps simultaneous blooms (50–500) for performance

## Discovery

- Add a button on `Index.tsx` header (next to existing "Globe" link) labeled "Pulse" with a sparkle icon
- Add a small "View on Pulse" link inside the existing `/globe` page header

## Technical Plan

**New files**
- `src/pages/Pulse.tsx` — page shell, header, mode toggle, legend, detail card
- `src/components/pulse/PulseCanvas.tsx` — main 2D canvas (HTML5 Canvas, not Three.js — better perf for many translucent strokes, simpler than r3f for this look)
- `src/components/pulse/blooms.ts` — pure functions: `drawTransfer`, `drawSwap`, `drawStake`, `drawNFT`, `drawContract`, `drawDefault`, plus `BloomState` type and `tickBloom(state, dt)`
- `src/components/pulse/positioning.ts` — `hashToXY(hash, width, height)` deterministic placement, plus stream/constellation strategies
- `src/components/pulse/useBloomEngine.ts` — manages the active bloom array, ingests new transactions from `useRealtimeTransactions`, runs `requestAnimationFrame` loop, exposes `pause`, `snapshot`, `setMode`, `setDensity`

**Edits**
- `src/App.tsx` — add `<Route path="/pulse" element={<Pulse />} />` above the catch-all
- `src/pages/Index.tsx` — add a Pulse nav button next to the existing Globe button
- `src/pages/Globe.tsx` — add a small link in the header to `/pulse`

**Reused (no changes)**
- `src/hooks/useRealtimeTransactions.ts` — provides `transactions`, `stats.tps`, `stats.epoch`, `stats.ledgerTimestamp`
- `supabase/functions/aptos-transactions/index.ts` — already returns everything Pulse needs
- shadcn `Button`, `Card`, `Badge`, `Slider`, `ThemeToggle` — used for the chrome

**No new dependencies.** Pure 2D Canvas API + the project's existing stack (React, Tailwind, shadcn, lucide-react).

**Design tokens**
- All colors come from `index.css` HSL tokens (`--primary`, `--chart-1..5`, `--background`, `--border`)
- Type colors map to existing chart vars so they auto-adapt to light/dark theme
- Glassmorphism panels reuse the same `bg-card/30 backdrop-blur-xl border-border/50` classes already used in `/globe`

**Performance**
- Single canvas, one rAF loop, max 500 active blooms (oldest evicted)
- Old blooms collapse to a 1-byte "scar" entry (just x, y, color, ageRemaining) to keep memory flat
- Off-screen blooms in Stream mode are removed immediately
- `devicePixelRatio` clamp at 2

**Why a new page (vs separate site)**
- 70% of the plumbing (polling, edge function, design system, theming, routing, layout primitives) is already here
- Cross-promotion: users in `/globe` and the wallet dashboard can discover it
- Single deploy, single domain (tracktos.com), shared analytics
- Zero backend changes — no risk to the existing wallet/portfolio features

## Out of Scope (explicit)

- No audio / sonification (can be a follow-up; keeping this PR focused on visuals)
- No WebSocket upgrade — sticks with the existing 3s polling
- No new edge functions, DB tables, or auth
- No Three.js / WebGL — 2D canvas is sufficient and lighter

## Acceptance

- `/pulse` loads, shows the live Aptos green bloom field
- New transactions appear as blooms within ~3s of confirmation on-chain
- Same sender's transactions cluster in the same screen region (Garden mode)
- Mode toggle smoothly switches between Garden / Stream / Constellation without reloading data
- Clicking a bloom shows tx details with an explorer link
- Light and dark themes both look intentional
- 60fps with up to 200 simultaneous blooms on a typical laptop