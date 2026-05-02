
# Aptos Pulse — Truthful, Live-Driven Visuals & Audio

## Why the experience feels "fake" today

After tracing the data path (`useRealtimeTransactions` → `useFlowEngine` → `flows.ts` and `AudioEngine`), three concrete causes explain what you're seeing/hearing:

1. **Sound pulses appear "random" because the audio engine plays a `setAmbientLevel` pad keyed to TPS, plus a TPS‑breathing background wash on the canvas.** The pad slowly modulates volume/cutoff continuously. Even with zero new transactions, you still hear and see motion — that's what reads as "fake."
2. **Polling cadence (3 s) vs. animation cadence are decoupled.** Up to ~25 transactions arrive in one burst every 3 seconds, then the canvas plays them out smoothly with no visible "this just landed" moment, so there's no felt link between a sound/visual and a real event.
3. **"Hover proves it's live" is great, but nothing else does.** There's no on‑screen ledger‑version stamp, no per‑burst counter, and no visible 1:1 marker tying a sound chime to the specific transaction that just triggered it.

## What we'll change

### A. Strict 1:1 binding — every visual & sound = one real, unique transaction

In `useFlowEngine.ts` and `AudioEngine.ts`:
- Maintain a single shared `seen: Set<txHash>` (already exists for visuals; add the same gate for audio so the engine cannot emit a note unless a never-before-seen `tx.hash` arrives).
- **Remove the ambient pad entirely** (`ambientGain`, `ambientFilter`, `ambientOscs`, `setAmbientLevel`). The only sound the user ever hears will be a chime triggered by a confirmed mainnet tx.
- **Remove the TPS "breathing" wash** in `drawBackground`. Background becomes a static dark canvas with a faint dot grid — no motion that isn't a transaction.
- Add a small "Sound = TX" indicator chip near the audio controls so the user can verify the contract.

### B. Visible "tick" per polling burst (proof of liveness)

When a fetch returns N new transactions, fire a one-frame **burst marker**:
- A thin horizontal sweep line briefly crosses the canvas.
- A floating chip appears top-center: `+12 txns @ ledger 5,084,392,051` for ~1.2 s, then fades.
- The chip cycles through the actual incoming hashes (first 6 chars) so users can watch new IDs land in real time.

This is the single clearest "this is live" signal and costs almost nothing.

### C. Per-mode signatures that look genuinely different

Right now Constellation/Garden/Orbit all render the same arc primitive. We'll give each mode a distinct visual grammar tied to real tx fields:

- **Constellation** — Arc + comet head (kept). Adds a static line between sender↔contract anchors that brightens with each tx; line thickness = log(amount).
- **Garden** — Replace arcs with **anchored sprouts**: each tx grows a stem at its destination anchor whose height = gas, with petals colored by archetype. No travel arcs.
- **Orbit** — Top‑K hot anchors (by `heat`) become orbital centers; new txs render as **satellites** that complete one full orbit then dissolve. Orbit radius = log(amount), speed = 1/gas.
- **Pulse Lines** — Single radial ring per tx from sender anchor (kept), but ring count caps at active-tx count — no decorative rings.
- **Rain** — Each streak's x-position is hashed from sender, length from amount, color from type (kept). Add a faint vertical guide column when hovered.

### D. Accuracy overlays (always on)

Top-left HUD adds three live readouts wired directly to `stats`:
```
LEDGER  5,084,392,621
BLOCK   743,989,572
TPS     128.4   (rolling 15s)
```
Bottom-left adds a **rolling tx ticker** showing the last 6 hashes scrolling up as they arrive, each clickable → opens explorer. This makes the proof obvious without requiring a hover.

### E. Audio: tighter, sparser, deterministic

- Drop ambient pad (above).
- Per-tx note pitch is already deterministic from `sender` hash — keep.
- Add a hard rule: **at most one note per unique `tx.hash`, ever.** Maintain a bounded LRU of played hashes (size 5000).
- When a burst lands with >6 new txs, audio plays the 6 highest-amount ones and skips the rest (with a small "+N more" visual indicator) — better than a smear of clicks.
- Remove the TPS-driven duck curve; replace with a fixed soft limiter (compressor stays).

## Technical notes (for the implementer)

Files to edit:
- `src/components/pulse/AudioEngine.ts` — remove ambient pad nodes & `setAmbientLevel`; add `playedHashes` LRU; cap per-burst polyphony to 6; remove TPS duck.
- `src/components/pulse/useAudioEngine.ts` — remove `setAmbientLevel(tps)` call; pass burst (array of new txs since last poll) instead of full transaction list to a new `playBurst` method.
- `src/hooks/useRealtimeTransactions.ts` — expose `lastBurst: { txs: Transaction[]; ledgerVersion: string; at: number } | null` alongside `transactions`.
- `src/components/pulse/flows.ts` — remove the TPS breathing wash in `drawBackground`; add `drawSproutBloom`, `drawOrbitSatellite`; keep arc/ripple/rain.
- `src/components/pulse/useFlowEngine.ts` — branch per mode for new shapes; subscribe to `lastBurst` to trigger the sweep marker.
- `src/components/pulse/PulseCanvas.tsx` — render burst chip overlay (`+N txns @ ledger …`) and the rolling hash ticker.
- `src/pages/Pulse.tsx` — add LEDGER / BLOCK / TPS readouts to the legend card; add "Sound = 1 chime per tx" caption under the audio control.

No backend / edge function changes — data path is already correct and live; we're aligning the UI/audio to that truth.

## Out of scope

- Switching to WebSocket/SSE (memory rule: 3-second polling stays).
- Changing how transactions are classified.
- Visual redesign of header / theme.

## Acceptance check

After implementation, the user should be able to:
1. Mute audio, watch the ledger number tick, see a sweep + chip every 3 s with the real count of new txs.
2. Unmute and hear exactly one chime per unique tx hash (no ambient drone).
3. Switch modes and immediately see a structurally different visualization (sprouts vs orbits vs ripples vs streaks vs comets) — not just different motion of the same arcs.
4. Hover any visible element and confirm the underlying transaction in the tooltip matches one currently in the rolling ticker.
