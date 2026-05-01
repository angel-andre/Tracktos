import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { Voice } from "./AudioEngine";

interface Props {
  muted: boolean;
  volume: number;
  voice: Voice;
  onToggleMute: () => void;
  onVolumeChange: (v: number) => void;
  onVoiceChange: (v: Voice) => void;
}

const VOICES: { value: Voice; label: string }[] = [
  { value: "bloom", label: "Bloom" },
  { value: "crystal", label: "Crystal" },
  { value: "pulse", label: "Pulse" },
];

export function AudioControls({
  muted,
  volume,
  voice,
  onToggleMute,
  onVolumeChange,
  onVoiceChange,
}: Props) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-2"
        onClick={onToggleMute}
        title={muted ? "Click to hear the network" : "Mute"}
      >
        {muted ? (
          <VolumeX className="w-3.5 h-3.5" />
        ) : (
          <Volume2 className="w-3.5 h-3.5 text-primary" />
        )}
        <span className="text-xs">{muted ? "Sound" : "On"}</span>
      </Button>
      <Slider
        value={[muted ? 0 : Math.round(volume * 100)]}
        min={0}
        max={100}
        step={1}
        disabled={muted}
        onValueChange={(v) => onVolumeChange(v[0] / 100)}
        className="w-20"
      />
      <div className="flex items-center gap-0.5 rounded-md border border-border/60 bg-card/40 p-0.5">
        {VOICES.map((v) => (
          <button
            key={v.value}
            onClick={() => onVoiceChange(v.value)}
            className={`text-[10px] px-2 py-0.5 rounded-sm transition-colors ${
              voice === v.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}