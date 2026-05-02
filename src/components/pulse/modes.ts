import { Network, Sparkles, Activity, Orbit, CloudRain } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Voice } from "./AudioEngine";

export type Mode = "constellation" | "garden" | "pulse" | "orbit" | "rain";

export type ModeGroup = "Network" | "Motion";

export interface Scale {
  root: number;
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

export const MODES: ModeDef[] = [
  {
    id: "constellation",
    label: "Constellation",
    group: "Network",
    icon: Network,
    scale: { root: 50, intervals: PENT_MIN, octaves: 3 },
    defaultVoice: "crystal",
    description: "Glowing nodes linked by comet arcs across the network.",
  },
  {
    id: "garden",
    label: "Garden",
    group: "Network",
    icon: Sparkles,
    scale: { root: 50, intervals: PENT_MIN, octaves: 3 },
    defaultVoice: "bloom",
    description: "Each transaction sprouts a small bloom at its destination.",
  },
  {
    id: "orbit",
    label: "Orbit",
    group: "Network",
    icon: Orbit,
    scale: { root: 48, intervals: PENT_MIN, octaves: 4 },
    defaultVoice: "bloom",
    description: "High-traffic accounts become orbital centers; transactions arc between them.",
  },
  {
    id: "pulse",
    label: "Pulse Lines",
    group: "Motion",
    icon: Activity,
    scale: { root: 50, intervals: PENT_MIN, octaves: 3 },
    defaultVoice: "pulse",
    description: "Clean radial ripples emitted by each transaction.",
  },
  {
    id: "rain",
    label: "Rain",
    group: "Motion",
    icon: CloudRain,
    scale: { root: 50, intervals: PENT_MIN, octaves: 3 },
    defaultVoice: "pulse",
    description: "Soft vertical light streaks falling like calm rain.",
  },
];

export const MODE_BY_ID: Record<Mode, ModeDef> = MODES.reduce(
  (acc, m) => {
    acc[m.id] = m;
    return acc;
  },
  {} as Record<Mode, ModeDef>,
);

export const GROUPS: ModeGroup[] = ["Network", "Motion"];
