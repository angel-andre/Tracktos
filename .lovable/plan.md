## Goal

Replace the current abstract Garden / Stream / Constellation modes on `/pulse` with three visualizations that actually express what's happening on Aptos: wallets sending transactions, validators producing blocks, and the chain advancing version by version. Keep the artistic, audio-reactive feel — but make every shape map to something real.

## What's wrong with the current modes

- Garden / Stream / Constellation all just position blooms by a hash. Nothing connects to anything else.
- There is no sense of *flow* (who sent → who included it), no sense of *blocks*, and no sense of *wallets repeating activity*.
- A viewer can't tell a swap from a transfer except by color, and there's no relational structure on screen.

## The three new visualizations

### 1. Flow — "Senders → Validators"

A radial diagram. Active **validators (proposers)** sit on an outer ring around the canvas. **Sender wallets** appear as small nodes drifting in the interior. Each new transaction draws an animated arc from its sender node to the validator that included it, with a particle traveling along the arc. The arc fades over ~3 seconds, leaving a faint trail. Validator nodes pulse and grow brighter the more transactions they include in the visible window.

```text
        validator
       /    |    \
      /     |     \
     /   . sender  \
    /   .  arc    . \
   validator -- validator
```

What it shows: the real producer/consumer relationship of the chain. Who's busy. Which validators are doing the work right now.

### 2. Ledger — "Live Block Stream"

A horizontal river flowing right-to-left. New transactions enter as small shapes on the right, grouped into "block bands" by their block proposer (transactions sharing a proposer arrive as a cluster). Each block band drifts leftward at a speed proportional to current TPS. The current `blockHeight` and `epoch` are rendered as quiet markers along the top edge. As blocks exit the left edge they dissolve into the background wash.

What it shows: the literal forward motion of the chain. You see TPS as river speed, you see block composition (lots of swaps vs lots of transfers) as color density inside each band.

### 3. Swarm — "Wallet Constellations"

Sender addresses become persistent nodes — the same wallet always lands at the same spot (deterministic from address hash). Each new transaction from that wallet pulses its node and adds a short edge to a small cluster of **type satellites** (Transfer, Swap, Stake, NFT, Contract) arranged around it. Wallets that transact more often grow larger and brighter; idle wallets fade. Hovering a wallet highlights all its activity.

What it shows: who the active participants are, what kinds of things they do, and how concentrated activity is across the network.

## Technical details

### Data we have (from `useRealtimeTransactions`)
- `sender`, `proposer` (validator), `type`, `amount`, `gasCost`, `success`, `version`, `hash`
- `stats.tps`, `stats.blockHeight`, `stats.epoch`

We do **not** have an explicit recipient address — so "Flow" uses sender→validator (which is real and meaningful), not sender→receiver.

### Files to change
- **`src/components/pulse/positioning.ts`** — replace `Mode` type with `"flow" | "ledger" | "swarm"`. Add deterministic `validatorRingPosition`, `walletAnchorPosition`, and `blockLanePosition` helpers.
- **`src/components/pulse/blooms.ts`** — keep archetype shapes for reuse, add a new `Edge` primitive (animated arc with traveling particle) and a `WalletNode` primitive (persistent pulsing node sized by activity count).
- **`src/components/pulse/useBloomEngine.ts`** — branch render logic by mode:
  - `flow`: maintain a `Map<proposer, RingSlot>` and a transient `Edge[]` list. On each new tx, push an edge from sender position to its validator slot.
  - `ledger`: maintain `BlockBand[]` keyed by proposer; each band has an `x` that decreases over time at `speed = 40 + tps * 2 px/s`. Group incoming txs sharing a proposer within a 1.5s window into the same band.
  - `swarm`: maintain `Map<sender, WalletNode>` with `activityCount`, `lastSeen`, and `typeCounts`. New txs increment counts and spawn a short pulse + satellite mark. Decay nodes whose `lastSeen` is older than 30s.
- **`src/pages/Pulse.tsx`** — update `MODES` array to `Flow / Ledger / Swarm`, update Legend card text to explain the new mappings ("Arcs = sender→validator", "Bands = blocks", "Nodes = wallets").
- **`src/components/pulse/useAudioEngine.ts`** — no change needed; it already keys on transaction events, which all three modes still emit.

### Audio integration
The existing audio engine fires per-transaction. All three new modes consume the same `transactions` stream, so audio keeps working unchanged across modes.

### Performance
- Flow: cap concurrent edges at ~80 (FIFO eviction). Edges live ~3s.
- Ledger: cap visible blocks at ~30; off-screen blocks are dropped.
- Swarm: cap wallet nodes at 200 (drop least-recently-active). Type satellites are drawn as part of the parent node, not separate objects.

### What stays the same
- Header, density slider (now controls "max active edges/nodes"), pause, snapshot, audio controls, recent feed, selected-tx detail card, color tokens (`--chart-*`), TPS-driven background breathing.

## Out of scope
- No new data fetching — purely a rendering rework on existing data.
- No backend/edge-function changes.
- No changes to Globe page.
