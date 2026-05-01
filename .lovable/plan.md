# Add Sonification to Aptos Pulse

Give every Aptos transaction on the `/pulse` page a sound, turning the visualizer into an ambient audiovisual instrument. Each new "bloom" plays a short musical note synthesized in the browser — no external audio files, no new dependencies.

## Design Concept

The visuals already map transaction properties to shape, color, size, and position. We extend that mapping into the audio domain so visuals and music feel like one instrument:

| Transaction property | Sound parameter |
|---|---|
| Transaction type (Transfer / Swap / Stake / NFT / Contract / Other) | Timbre (which voice / oscillator preset) |
| Gas cost | Note duration + reverb send (heavier tx = longer, more spacious) |
| APT amount | Note velocity (louder for bigger transfers, log-scaled) |
| Sender hash | Pitch within a fixed musical scale (deterministic, so the same wallet always plays the same note) |
| TPS (network throughput) | Background ambient pad volume + filter brightness |

All notes are quantized to a **D minor pentatonic scale across 3 octaves** so anything that plays sounds harmonically pleasing, no matter the transaction order or rate. Voices are gentle (sine + triangle + soft pluck), not chiptune — closer to a generative ambient piece like Brian Eno's Music for Airports than an arcade.

## User-Facing Changes

A small audio control cluster is added to the existing bottom control bar on `/pulse`:

- **Mute / Unmute toggle** (speaker icon) — audio starts **muted by default** so the page never autoplays sound (browser policy + courtesy).
- **Volume slider** (0–100%).
- **Voice selector** — three presets the user can switch between live:
  - `Bloom` (default): soft sine pads with pluck attacks
  - `Crystal`: bright bell-like FM tones
  - `Pulse`: short percussive blips, more rhythmic
- **Tooltip / first-run hint**: a one-line caption "Click the speaker to hear the network" appears under the mute button until the user toggles it once.

No layout breaks on mobile — the control bar already wraps; audio buttons join the existing pause / snapshot / density cluster.

## Technical Implementation

**No new dependencies.** Use the native Web Audio API (`AudioContext`). Tone.js was considered but adds ~80kb gzipped for features we don't need; a hand-rolled synth is ~150 lines and gives us total control.

### New files

1. **`src/components/pulse/AudioEngine.ts`** — core synth
   - Singleton-ish class wrapping an `AudioContext`
   - Master chain: `masterGain → compressor → convolver (reverb) → destination`
   - Reverb impulse generated procedurally on init (no asset file)
   - Public API:
     - `init()` — lazily creates `AudioContext` on first user gesture (required by browsers)
     - `setMuted(bool)`, `setVolume(0..1)`, `setVoice('bloom'|'crystal'|'pulse')`
     - `playTransaction(tx: Transaction)` — schedules one note based on the mapping table above
     - `setAmbientLevel(tps: number)` — drives a low background pad whose filter cutoff and gain track TPS
     - `dispose()`
   - Voice synthesis: each voice is 1–2 oscillators + ADSR gain envelope + per-voice filter; `crystal` uses a 2-op FM pair; `pulse` uses a very short envelope on a square + lowpass.
   - Pitch selection: hash the sender address → index into the pentatonic scale array → MIDI note → frequency. Deterministic per wallet.
   - Voice pool / throttle: cap simultaneous voices at 12 and drop the oldest; if more than ~8 transactions arrive in the same frame, only sonify the loudest (highest amount) ones to avoid mud.

2. **`src/components/pulse/useAudioEngine.ts`** — React glue
   - Owns the `AudioEngine` instance via `useRef`
   - Exposes `{ muted, setMuted, volume, setVolume, voice, setVoice, ready }`
   - Watches `transactions` array — for each newly seen tx hash (mirrors the existing `seenRef` pattern from `useBloomEngine`), calls `playTransaction(tx)`
   - Watches `tps` — calls `setAmbientLevel(tps)` on change
   - Cleans up on unmount

3. **`src/components/pulse/AudioControls.tsx`** — UI
   - Renders the mute button, volume slider, and voice select dropdown
   - Uses existing shadcn `Button`, `Slider`, and a small inline `Select` (or `ToggleGroup`) — all already in the project

### Modified files

- **`src/pages/Pulse.tsx`**
  - Call `useAudioEngine({ transactions, tps: stats.tps })`
  - Render `<AudioControls ... />` inside the existing bottom control bar, right after the snapshot button
  - On the first unmute click, call `engine.init()` (satisfies the user-gesture requirement)

- **`src/components/pulse/useBloomEngine.ts`** — *no changes needed*. The audio engine independently watches the same `transactions` prop, so visuals and audio stay decoupled and trivially testable. Both use the same "newly seen hash" detection so they fire in lockstep.

### Browser autoplay & safety

- `AudioContext` is created only after the first user click on the unmute button.
- The mute state persists to `localStorage` under `pulse:audio:muted` so returning users don't get surprised.
- A hard-limit `DynamicsCompressorNode` and a `-6 dBFS` master ceiling prevent painful peaks even if dozens of transactions land at once.

### Performance

- One `AudioContext` for the whole page, reused across mode switches.
- Notes are scheduled with `setTargetAtTime` envelopes — no per-frame work, so this adds essentially zero load to the existing `requestAnimationFrame` canvas loop.
- When the page is hidden (`document.visibilityState === 'hidden'`), the engine suspends the `AudioContext` to save CPU.

## Out of Scope (can follow up later)

- Recording / exporting the audio
- MIDI export
- Per-validator spatial panning (`constellation` mode could pan left/right by validator hash later)
- Mobile gesture chord (long-press = sustained drone)

## Acceptance

- Visiting `/pulse` shows a new speaker icon in the bottom bar; page is silent until clicked.
- Clicking unmute starts a soft ambient pad and each new transaction plays a short musical note.
- Switching voice presets changes timbre live without glitching.
- Muting fully silences output; refreshing the page remembers the muted state.
- No console errors, no new dependencies in `package.json`.
