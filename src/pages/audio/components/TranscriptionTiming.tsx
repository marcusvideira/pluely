import { Header, Slider } from "@/components";
import {
  DEFAULT_SEGMENT_BREAK_MS,
  DEFAULT_TRANSCRIPTION_PAUSE_MS,
  MAX_SEGMENT_BREAK_MS,
  MAX_TRANSCRIPTION_PAUSE_MS,
  MIN_SEGMENT_BREAK_MS,
  MIN_TRANSCRIPTION_PAUSE_MS,
  getSegmentBreakMs,
  getTranscriptionPauseMs,
  setSegmentBreakMs,
  setTranscriptionPauseMs,
} from "@/lib/storage";
import { useState } from "react";

const secs = (ms: number) => `${(ms / 1000).toFixed(2)}s`;

export const TranscriptionTiming = () => {
  const [pause, setPause] = useState<number>(() => getTranscriptionPauseMs());
  const [breakMs, setBreakMs] = useState<number>(() => getSegmentBreakMs());

  const onPause = (v: number) => {
    setPause(v);
    setTranscriptionPauseMs(v);
  };
  const onBreak = (v: number) => {
    setBreakMs(v);
    setSegmentBreakMs(v);
  };

  return (
    <div className="space-y-6">
      {/* Transcription pause */}
      <div className="space-y-3">
        <Header
          title="Transcription pause"
          description="How long a speaker must pause before the clip is sent to speech-to-text. Shorter = more frequent, faster clips (more API calls) that get concatenated into the same message. Applies on the next meeting start."
          isMainTitle
        />
        <div className="max-w-md space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{secs(pause)}</span>
            <button
              type="button"
              className="text-[11px] text-muted-foreground/70 hover:text-foreground"
              onClick={() => onPause(DEFAULT_TRANSCRIPTION_PAUSE_MS)}
              title="Reset to default"
            >
              Reset ({secs(DEFAULT_TRANSCRIPTION_PAUSE_MS)})
            </button>
          </div>
          <Slider
            value={[pause]}
            onValueChange={(v: number[]) => onPause(v[0])}
            min={MIN_TRANSCRIPTION_PAUSE_MS}
            max={MAX_TRANSCRIPTION_PAUSE_MS}
            step={50}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground/60">
            <span>{secs(MIN_TRANSCRIPTION_PAUSE_MS)} faster</span>
            <span>{secs(MAX_TRANSCRIPTION_PAUSE_MS)}</span>
          </div>
        </div>
      </div>

      {/* Conversation break pause */}
      <div className="space-y-3">
        <Header
          title="Conversation break pause"
          description="The pause between two clips (from the same speaker) above which a new message bubble is started; below it, the new text is concatenated into the previous bubble. Applies live to a running meeting."
          isMainTitle
        />
        <div className="max-w-md space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{secs(breakMs)}</span>
            <button
              type="button"
              className="text-[11px] text-muted-foreground/70 hover:text-foreground"
              onClick={() => onBreak(DEFAULT_SEGMENT_BREAK_MS)}
              title="Reset to default"
            >
              Reset ({secs(DEFAULT_SEGMENT_BREAK_MS)})
            </button>
          </div>
          <Slider
            value={[breakMs]}
            onValueChange={(v: number[]) => onBreak(v[0])}
            min={MIN_SEGMENT_BREAK_MS}
            max={MAX_SEGMENT_BREAK_MS}
            step={250}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground/60">
            <span>{secs(MIN_SEGMENT_BREAK_MS)} more bubbles</span>
            <span>{secs(MAX_SEGMENT_BREAK_MS)} fewer</span>
          </div>
        </div>
      </div>
    </div>
  );
};
