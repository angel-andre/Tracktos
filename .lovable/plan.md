
# Aptos Pulse — Clean Redesign

Replace the busy 11-mode bloom system with a focused, premium 5-mode visualization where every transaction is a path from an **origin** to a **destination**, with one melodic tone per type. Calm, sparse, readable.

## Visual model

Every transaction becomes a `Flow`: an animated arc/comet/streak from `origin → destination` over ~1.5–3s, then a short fade. No more persistent 12s blooms layering on top of each other.

```text
   origin ●━━━━━━━━━━━━━━━━━━ ➤ ● destination
            comet head + tapering trail
```

- Origin/destination derived from `tx.sender` and `tx.receiver` (fallback: hash) via stable hash → 2D coordinate. Same address → same anchor point, so a network shape emerges.
- Anchors that recently received traffic become small **glowing nodes** that pulse on arrival, then fade.
- Hard cap on simultaneous flows (e.g. 60). Excess transactions queue briefly, then drop oldest. High-TPS bursts are **batched** into a single brighter pulse on the same edge instead of stacking dozens of identical lines.

## The 5 modes

All 5 share the origin→destination model; each interprets the path differently.

1. **Constellation** — anchors are stars on a soft radial layout; flows are thin curved bezier arcs with a comet head. Faint persistent links between recently-active node pairs.
2. **Garden** — anchors bloom briefly (small, 3–5 thin translucent petals, ~40px max) when a flow arrives. Flows are gentle curved stems connecting bloom to bloom. Sparse — max 1 active bloom per anchor.
3. **Pulse Lines** — flows are clean horizontal/radial sine ripples emitted from the origin, expanding outward and dissipating. Destination glows when the wavefront reaches it.
4. **Orbit** — top ~8 most-active addresses become orbital centers (sized by traffic). Flows are short light trails arcing between centers, satellites briefly orbiting the destination before fading.
5. **Rain** — flows fall as soft vertical light streaks; x-position from sender hash, length from amount. Calm, atmospheric.

Mode dropdown shows only these 5, grouped: **Network** (Constellation, Garden, Orbit), **Motion** (Pulse Lines, Rain).

## Visual style refinements

- Background: existing dark + subtle radial gradient + a faint dot grid (very low alpha) for spatial anchoring.
- Palette: keep existing chart tokens (Aptos green/teal/amber/violet) but cap stroke alpha at ~0.7, glow alpha at ~0.05. Thin 1–1.5px lines.
- Trails via per-frame background wash (already present) but slightly darker so old strokes clear faster → no buildup.
- Easing: `easeInOutCubic` along the path, fade tail uses `easeOutQuart`.
- No mandala mirroring, no boid swarms, no fireworks bursts, no per-bloom rotating petals.

## Audio refinements

Keep `AudioEngine` foundation; tighten it:

- **Per-type instrument** (overrides voice when "Auto"):
  - Transfer → soft sine bell (current `bloom`)
  - Swap → warm triangle+detuned saw pad (new `warm` voice)
  - Stake → low sine + sub octave (new `deep` voice)
  - NFT → plucked FM chime (current `crystal`, shorter decay)
  - Contract → bright square+filter blip (current `pulse`, softer)
  - Other → neutral soft sine
- Scale: D minor pentatonic across all modes by default (mode can still override). Mode change → smooth scale crossfade.
- **Stereo positioning**: pan from origin.x → -1..+1 via StereoPannerNode.
- **Polyphony cap**: 6 simultaneous voices (down from 12). Within any 80ms window, dedupe identical pitch+type to one note.
- **High-TPS ducking**: above 50 TPS, per-note gain scales down (1 → 0.4) so it stays musical, not noisy.
- Existing reverb/compressor/ambient pad retained; pad gain reduced.

## UI changes

Bottom control bar adds:
- **Animation Speed** slider (0.5×–2×, default 1×) — multiplies flow duration globally.
- Density slider repurposed to **Max Flows** (10–80, default 40).
- Mode dropdown reduced to 5 entries.
- AudioControls unchanged (mute, volume, voice). Default starts muted (already does).

Legend, Recent Blooms panel, header, snapshot button: kept as-is.

## Technical plan

New files:
- `src/components/pulse/flows.ts` — `FlowState` type, `createFlow`, `tickFlow`, `drawFlow` per-mode renderers, anchor registry (`Anchor` map keyed by address with `x,y,lastHit,heat`).
- `src/components/pulse/useFlowEngine.ts` — replaces `useBloomEngine`. Manages anchors map, flow array (capped), background grid render, per-mode draw dispatch, hover/click hit-testing against anchors.
- New voice synths in `AudioEngine.ts`: `warm`, `deep`. Add `StereoPannerNode` per-note. Reduce polyphony cap, add TPS-based gain scaling, dedupe within 80ms.

Edited files:
- `src/components/pulse/modes.ts` — trim to 5 modes; each gets a `defaultInstrument` per archetype mapping (or rely on per-type override in audio engine). Remove unused icons/scales.
- `src/components/pulse/positioning.ts` — replace per-mode spawn with `anchorFor(address, w, h, mode)` returning a stable point per address per mode (radial ring for Constellation, scattered grid for Garden, top-N orbit centers for Orbit, x-column for Rain, free for Pulse Lines).
- `src/components/pulse/PulseCanvas.tsx` — swap to `useFlowEngine`.
- `src/pages/Pulse.tsx` — trim mode list, add Animation Speed slider, rename Density → Max Flows, pass `speed` prop down.
- `src/components/pulse/useAudioEngine.ts` — pass tx type → instrument override, pass tps for ducking, pass stereo pan from spawn x.

Deleted (or left dormant):
- `src/components/pulse/blooms.ts` and `useBloomEngine.ts` removed (replaced by flows engine).

## Out of scope

- API/data layer changes.
- Globe page.
- Mobile-specific layout overhaul (existing responsive header retained).
