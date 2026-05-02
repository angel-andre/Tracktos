## Problem

Right now every mode renders the same 6 archetype shapes (transfer line, swap petals, stake rings, NFT squares, **contract tree**, default circle). Mode only changes *where* and *how* blooms move — never *what they look like*. Because Contract is the most common Aptos tx type, its tree shape dominates every screen, making Garden, Stream, Spiral, Orbit, etc. all look like the same drifting forest.

## Goal

Each mode should have an instantly recognizable visual identity. Archetype (tx type) should still influence color and subtle detail, but the **primary shape language is owned by the mode**.

## Mode → Visual Language

| Mode | Visual signature |
|---|---|
| Garden | Soft botanical blooms — concentric petals, organic & varied (current style, kept as the "default organic") |
| Stream | Horizontal comet trails with leading dot + fading tail |
| Constellation | Star points connected by thin lines to nearby blooms (k-nearest links) |
| Spiral | Pinwheel arms — rotating multi-arm spokes scaled by gas |
| Rain | Vertical glyph streaks (Matrix-style) with a bright head + ghost trail |
| Orbit | Solid planet disc with a thin orbital ring + tiny moon dot |
| Grid Pulse | Filled square cells that flash and decay (no inner shapes) |
| Waveform | Tall thin vertical bars (oscilloscope sample), height = amount |
| Fireworks | Rising spark + radial burst lines on explode phase |
| Swarm | Small triangle "fish" oriented along velocity, with short motion trail |
| Mandala | Angular polygon stars (mirrored 8x by the engine) |

Archetype still drives **color** (existing chart token mapping) and one small accent (e.g. a tiny inner symbol: dot for transfer, hex for swap, ring for stake, square for NFT, fork for contract) so tx type is still readable on hover/inspection — but it no longer defines the dominant silhouette.

## Technical Changes

**`src/components/pulse/blooms.ts`**
- Replace the archetype-switch in `drawBloom` with a `mode`-switch that calls a per-mode renderer (`drawGarden`, `drawStream`, `drawConstellation`, `drawSpiral`, `drawRain`, `drawOrbit`, `drawGrid`, `drawWaveform`, `drawFireworks`, `drawSwarm`, `drawMandala`).
- Add `mode: Mode` to `DrawCtx` (passed through from the engine).
- Keep archetype color + add a small `drawArchetypeAccent(ctx, archetype, r)` helper used by renderers that want to surface tx type subtly.
- For Fireworks, branch on `motion.phase` ("rise" → spark, "explode" → radial burst).
- For Swarm, use `vx/vy` to orient a triangle.
- Garden keeps a refined version of the current organic petal look so the "Garden" name still matches.

**`src/components/pulse/useBloomEngine.ts`**
- Pass `mode: modeRef.current` into `drawBloom` via `DrawCtx`.
- Constellation: after drawing blooms, do one pass linking each bloom to its 1–2 nearest neighbors with a faint line (cheap O(n²) at current density caps).
- Grid Pulse: render filled rounded-rect cells sized to the grid cell instead of bloom radius.
- Waveform: render thin vertical bars anchored to canvas vertical center.

**`src/components/pulse/positioning.ts`**
- No structural change. Minor: in `waveform`, also store target `y` so the renderer can anchor bar height to vertical distance from center.

**Files NOT touched**
- `modes.ts`, `AudioEngine.ts`, `useAudioEngine.ts`, `AudioControls.tsx`, `Pulse.tsx` — audio behavior and UI stay as they are.

## Acceptance

- Switching the dropdown produces a visibly different shape language each time, not just different motion of the same shapes.
- The "tree" silhouette no longer appears in any mode (the contract tree shape is removed entirely; contract txs get the mode's shape + an optional small fork accent).
- Hover still highlights same-sender blooms; click-to-inspect still works; performance stays smooth at the current density cap.
