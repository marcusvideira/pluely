import { Header, Slider } from "@/components";
import {
  DEFAULT_TRANSCRIPTION_SPEED,
  MAX_TRANSCRIPTION_SPEED,
  MIN_TRANSCRIPTION_SPEED,
  getTranscriptionSpeed,
  setTranscriptionSpeed,
} from "@/lib/storage";
import { useState } from "react";

export const TranscriptionSpeed = () => {
  const [speed, setSpeed] = useState<number>(() => getTranscriptionSpeed());

  const handleChange = (value: number) => {
    const rounded = Math.round(value * 100) / 100;
    setSpeed(rounded);
    setTranscriptionSpeed(rounded);
  };

  return (
    <div className="space-y-3">
      <Header
        title="Meeting transcription speed"
        description="Speeds up each captured clip before sending to speech-to-text — faster and cheaper, but higher values shift the pitch and reduce accuracy. Applied only when a transcription language is forced (above). Changes apply live to a running meeting."
        isMainTitle
      />

      <div className="max-w-md space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {speed <= 1 ? "1.0× (no speed-up — best quality)" : `${speed.toFixed(2)}×`}
          </span>
          <button
            type="button"
            className="text-[11px] text-muted-foreground/70 hover:text-foreground"
            onClick={() => handleChange(DEFAULT_TRANSCRIPTION_SPEED)}
            title="Reset to default"
          >
            Reset ({DEFAULT_TRANSCRIPTION_SPEED}×)
          </button>
        </div>
        <Slider
          value={[speed]}
          onValueChange={(v: number[]) => handleChange(v[0])}
          min={MIN_TRANSCRIPTION_SPEED}
          max={MAX_TRANSCRIPTION_SPEED}
          step={0.05}
          className="flex-1"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground/60">
          <span>1.0× best quality</span>
          <span>1.5× fastest</span>
        </div>
      </div>
    </div>
  );
};
