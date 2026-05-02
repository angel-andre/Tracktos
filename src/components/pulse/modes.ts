import {
  Sparkles,
  Waves,
  Network,
  CircleDot,
  CloudRain,
  Orbit,
  Grid3x3,
  Activity,
  Flame,
  Bug,
  Flower2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Voice } from "./AudioEngine";

export type Mode =
  | "garden"
  | "stream"
  | "constellation"
  | "spiral"
  | "rain"
  | "orbit"
  | "grid"
  | "waveform"
  | "fireworks"
  | "swarm"
  | "mandala";

export type ModeGroup = "Organic" | "Geometric" | "Linear";

export interface Scale {
  root: number; // MIDI
  intervals: number[];
  octaves: number;
}

export interface ModeDef {
  id: Mode;
  label: string;
  group: ModeGroup;
  icon: LucideIcon;
  scale: Scale;
  defaultVoice: Voice;
  description: string;
}

const PENT_MIN = [0, 3, 5, 7, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const PENT_MAJ = [0, 2, 4, 7, 9];
const NAT_MIN = [0, 2, 3, 5, 7, 8, 10];
const MAJ_TRIAD = [0, 4, 7];

export const MODES: ModeDef[] = [
  {
    id: "garden",
    label: "Garden",
    group: "Organic",
    icon: Sparkles,
    scale: { root: 50, intervals: PENT_MIN, octaves: 3 },
    defaultVoice: "bloom",
    description: "Hash-placed blooms across the canvas.",
  },
  {
    id: "spiral",
    label: "Spiral",
    group: "Organic",
    icon: CircleDot,
    scale: { root: 54, intervals: PENT_MIN, octaves: 3 }, // F#
    defaultVoice: "crystal",
    description: "Transactions spiral outward from the center.",
  },
  {
    id: "swarm",
    label: "Swarm",
    group: "Organic",
    icon: Bug,
    scale: { root: 47, intervals: PENT_MIN, octaves: 3 }, // B
    defaultVoice: "bloom",
    description: "Boids flock around hash-seeded attractors.",
  },
  {
    id: "fireworks",
    label: "Fireworks",
    group: "Organic",
    icon: Flame,
    scale: { root: 50, intervals: DORIAN, octaves: 4 },
    defaultVoice: "bloom",
    description: "Bursts rise and explode — bigger amounts, bigger booms.",
  },
  {
    id: "constellation",
    label: "Constellation",
    group: "Geometric",
    icon: Network,
    scale: { root: 48, intervals: LYDIAN, octaves: 3 }, // C
    defaultVoice: "crystal",
    description: "Block proposers form a luminous ring.",
  },
  {
    id: "grid",
    label: "Grid Pulse",
    group: "Geometric",
    icon: Grid3x3,
    scale: { root: 43, intervals: PENT_MIN, octaves: 3 }, // G
    defaultVoice: "pulse",
    description: "Quantized cells flash in rhythm.",
  },
  {
    id: "mandala",
    label: "Mandala",
    group: "Geometric",
    icon: Flower2,
    scale: { root: 53, intervals: LYDIAN, octaves: 3 }, // F
    defaultVoice: "crystal",
    description: "Symmetric kaleidoscope around the center.",
  },
  {
    id: "orbit",
    label: "Orbit",
    group: "Geometric",
    icon: Orbit,
    scale: { root: 48, intervals: MAJ_TRIAD, octaves: 4 },
    defaultVoice: "bloom",
    description: "A central sun, transactions in slow orbit.",
  },
  {
    id: "stream",
    label: "Stream",
    group: "Linear",
    icon: Waves,
    scale: { root: 45, intervals: DORIAN, octaves: 3 }, // A
    defaultVoice: "bloom",
    description: "A river of transactions flowing left-to-right.",
  },
  {
    id: "rain",
    label: "Rain",
    group: "Linear",
    icon: CloudRain,
    scale: { root: 52, intervals: PHRYGIAN, octaves: 3 }, // E
    defaultVoice: "pulse",
    description: "Glyphs falling from the top.",
  },
  {
    id: "waveform",
    label: "Waveform",
    group: "Linear",
    icon: Activity,
    scale: { root: 45, intervals: NAT_MIN, octaves: 3 }, // A
    defaultVoice: "crystal",
    description: "An audio-scope of incoming transactions.",
  },
];

export const MODE_BY_ID: Record<Mode, ModeDef> = MODES.reduce(
  (acc, m) => {
    acc[m.id] = m;
    return acc;
  },
  {} as Record<Mode, ModeDef>,
);

export const GROUPS: ModeGroup[] = ["Organic", "Geometric", "Linear"];
