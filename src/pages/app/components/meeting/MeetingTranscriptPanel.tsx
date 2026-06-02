import { Button } from "@/components";
import { STT_LANGUAGES } from "@/config";
import { getSttInputLanguages, setSttInputLanguages } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { TranscriptSegment } from "@/types";
import { Loader2, MicIcon, MicOffIcon, SquareIcon } from "lucide-react";
import { useState } from "react";
import { MeetingAsk } from "./MeetingAsk";
import { TranscriptList } from "./TranscriptList";

interface MeetingTranscriptPanelProps {
  segments: TranscriptSegment[];
  pendingCount: number;
  error: string;
  onStop: () => void;
  micMuted: boolean;
  onToggleMic: () => void;
}

/** Live meeting card: header controls + real-time question box + transcript. */
export const MeetingTranscriptPanel = ({
  segments,
  pendingCount,
  error,
  onStop,
  micMuted,
  onToggleMic,
}: MeetingTranscriptPanelProps) => {
  // Session input language — writes the same global setting used by all
  // speech-to-text (transcript, system-audio insights, and voice questions).
  const [language, setLanguage] = useState<string>(
    () => getSttInputLanguages()[0] ?? ""
  );

  const handleLanguageChange = (code: string) => {
    setLanguage(code);
    setSttInputLanguages(code ? [code] : []);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-red-500" />
          </span>
          <h3 className="font-semibold text-xs select-none">Live transcript</h3>
          {pendingCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              transcribing {pendingCount}…
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[10px] text-muted-foreground select-none">
            Language
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              title="Force the spoken language for all transcription (mic, system audio, and questions)"
              className="h-7 rounded-md border border-input/60 bg-background px-2 text-xs focus:outline-none focus:border-primary/60"
            >
              <option value="">Auto-detect</option>
              {STT_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </label>

          <Button
            size="icon"
            variant="outline"
            className={cn(
              "size-7",
              micMuted && "bg-red-50 hover:bg-red-100 dark:bg-red-950/40"
            )}
            onClick={onToggleMic}
            title={
              micMuted
                ? "Microphone muted — your voice isn't being captured. Click to unmute."
                : "Mute my microphone (stop capturing your voice)"
            }
          >
            {micMuted ? (
              <MicOffIcon className="size-4 text-red-500" />
            ) : (
              <MicIcon className="size-4" />
            )}
          </Button>

          <Button
            size="sm"
            variant="destructive"
            onClick={onStop}
            className="h-7"
            title="Stop transcription"
          >
            <SquareIcon className="size-3" />
            Stop
          </Button>
        </div>
      </div>

      {error && (
        <div className="shrink-0 mx-3 mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Real-time question box — always visible for quick live help */}
      <MeetingAsk segments={segments} />

      <TranscriptList
        segments={segments}
        autoScroll
        emptyText="Listening… captured speech will appear here in real time."
      />
    </div>
  );
};
