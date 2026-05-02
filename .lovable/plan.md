## Goal
Expand the Aptos Pulse page from 3 visualizations to a richer library of 9 modes, organized in a dropdown menu. Every mode is sonified and shares the existing audio engine, with mode‑specific scales and timbres so each one has its own musical character.

## New visualization modes

Existing (kept):
1. **Garden** — hash‑placed blooms (current default).
2. **Stream** — left‑to‑right flowing river of transactions.
3. **Constellation** — proposer ring layout.

New (added):
4. **Spiral** — txns spawn at center and spiral outward; angle from sender hash, radius grows over life. Feels orbital.
5. **Rain** — txns fall top‑to‑bottom like glyph rain (Matrix‑style verticals); column from sender hash, speed from gas.
6. **Orbit** — central "sun" with txns orbiting at radii based on amount; size from gas. Slow, hypnotic.
7. **Grid Pulse** — txns snap to a quantized grid cell (hash → cell); cells flash + ripple. Architectural, rhythmic.
8. **Waveform** — txns plotted as points along a horizontal waveform that scrolls right‑to‑left; Y is amount, brightness is gas. Reads like an audio scope.
9. **Fireworks** — txns burst from random ground points, trailing particles upward then exploding. High drama for big amounts.
10. **Swarm** — txns become boids that flock around hash‑seeded attractors; cluster behavior reveals sender activity bursts.
11. **Mandala** — txns mirrored across N rotational symmetry axes (kaleidoscope) around the center; produces a generative mandala that evolves.

## Audio: per‑mode musical character

Each mode picks a scale + voice profile so switching modes changes the music, not just the visuals. The existing `Voice` presets (bloom / crystal / pulse) become the *texture* slider; modes set the *scale and rhythm feel*.

| Mode | Scale | Default voice | Notes |
|---|---|---|---|
| Garden | D minor pentatonic (current) | bloom | unchanged |
| Stream | A dorian | bloom | longer release on high‑gas txns |
| Constellation | C lydian | crystal | wide stereo, long reverb |
| Spiral | F# minor pentatonic | crystal | pitch rises as bloom spirals out |
| Rain | E phrygian | pulse | short percussive, Y position → octave |
| Orbit | C major triad arpeggio | bloom | slow envelope, droney |
| Grid Pulse | G minor pentatonic | pulse | quantized to 16th‑note grid for rhythm |
| Waveform | A natural minor | crystal | pitch follows Y (amount) directly |
| Fireworks | D dorian, wide octaves | bloom | velocity scaled with explosion size |
| Swarm | B minor pentatonic | bloom | cluster events trigger chord stabs |
| Mandala | F lydian | crystal | mirrored notes → small chord per txn |

The ambient TPS pad stays globally and re‑tunes its drone roots to match the active mode's key.

## UI changes

- Replace the 3‑button mode strip in the header with a **dropdown** (`shadcn` `Select`) labeled "Visualization", showing the current mode name + a small icon.
- Group modes in the dropdown:
  - **Organic**: Garden, Spiral, Swarm, Fireworks
  - **Geometric**: Constellation, Grid Pulse, Mandala, Orbit
  - **Linear**: Stream, Rain, Waveform
- Each item shows a `lucide-react` icon + short label.
- The bottom audio bar keeps the voice texture toggle (bloom / crystal / pulse) — it now acts as a *modifier* on top of the mode's default voice. Add a small "Auto" option that defers to the mode's recommended voice.

## Technical details

**`positioning.ts`**
- Extend `Mode` union with the 8 new values.
- Add a position function per mode:
  - `spiralPosition(tx, w, h, age)` — uses age inside the engine; for spawn we just compute initial `(cx, cy)` and hand off to a custom updater.
  - `rainPosition`, `orbitPosition`, `gridPulsePosition`, `waveformPosition`, `fireworksPosition`, `swarmPosition`, `mandalaPosition`.
- Some modes (orbit, swarm, spiral, fireworks, rain) need per‑frame motion not currently in `tickBloom`. We extend `BloomState` with an optional `motion` discriminator: `{ kind: "linear" } | { kind: "orbit", cx, cy, r, omega, theta } | { kind: "spiral", cx, cy, omega, growth } | { kind: "fall", ax, ay } | { kind: "boid", target } | { kind: "burst", phase: "rise" | "explode", explodeAt }`.
- `useBloomEngine.ts` switches on `motion.kind` each tick to update position.

**`blooms.ts`**
- Add lightweight draw variants where modes need different visuals (e.g. waveform draws a small dot+stem; rain draws a vertical streak; mandala draws the bloom + mirror copies via `ctx.save`/rotate).
- Mandala drawing is implemented at the engine level (loop N rotations around center) rather than per‑bloom to keep symmetry consistent.

**`AudioEngine.ts`**
- Add `setScale(scale: Scale)` where `Scale` is a small interface `{ root: number; intervals: number[]; octaves: number }`.
- Add a `mode`‑specific scheduling hint:
  - `quantize?: "16n" | "8n"` — when set, `playTransaction` snaps `when` to the next grid tick (used for Grid Pulse).
  - `chord?: number` — when >1, plays N stacked notes (used for Mandala).
- Re‑tune ambient pad oscillators on `setScale` via short `linearRampToValueAtTime`.

**`useAudioEngine.ts`**
- Accepts `mode` prop. On mode change, calls `engine.setScale(MODE_TO_SCALE[mode])` and `engine.setVoice(userVoice ?? MODE_TO_VOICE[mode])`.
- Voice preset becomes nullable ("auto") with localStorage persistence.

**`Pulse.tsx`**
- Replace mode button strip with a `Select` (already in `components/ui/select.tsx`).
- Pass `mode` to `useAudioEngine`.
- Update legend caption per mode (one short sentence describing what size/position/color encode).

## Files to create / edit

Edit:
- `src/components/pulse/positioning.ts` — new mode types + position functions.
- `src/components/pulse/blooms.ts` — extend `BloomState` with motion + add mode‑specific draw helpers.
- `src/components/pulse/useBloomEngine.ts` — motion dispatcher per `motion.kind`.
- `src/components/pulse/AudioEngine.ts` — scale switching, quantize, chord, ambient retune.
- `src/components/pulse/useAudioEngine.ts` — accept `mode`, drive scale/voice.
- `src/components/pulse/AudioControls.tsx` — add "Auto" voice option.
- `src/pages/Pulse.tsx` — replace mode strip with grouped `Select` dropdown; pass `mode` to audio.

Create:
- `src/components/pulse/modes.ts` — central registry: `MODES = [{ id, label, group, icon, scale, defaultVoice, description }]`. Single source of truth used by both UI dropdown and audio/engine.

## Out of scope (intentionally)
- No new dependencies; everything stays Web Audio + Canvas2D.
- No changes to data fetching or edge functions.
- No keyboard shortcut layer (could be a follow‑up).