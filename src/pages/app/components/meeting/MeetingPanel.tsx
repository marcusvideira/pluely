import { Button } from "@/components";
import { UseMeetingTranscription, useMeetings, useImportMeeting } from "@/hooks";
import { getMeetingById, getSttInputLanguages, setSttInputLanguages } from "@/lib";
import { cn } from "@/lib/utils";
import { Meeting } from "@/types";
import { invoke } from "@tauri-apps/api/core";
import {
  FileUp,
  Loader2,
  MicIcon,
  MicOffIcon,
  SparklesIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MeetingAsk } from "./MeetingAsk";
import { PastMeetingCard } from "./PastMeetingCard";
import { TranscriptList } from "./TranscriptList";

interface MeetingPanelProps {
  meeting: UseMeetingTranscription;
  onClose: () => void;
  startDisabled?: boolean;
}

/**
 * The meeting panel. Recording (start/stop) and panel visibility are
 * independent: stopping never closes the panel, and closing the panel never
 * stops a running recording.
 */
export const MeetingPanel = ({
  meeting,
  onClose,
  startDisabled = false,
}: MeetingPanelProps) => {
  const { meetings, refreshMeetings } = useMeetings();
  const [pastMeeting, setPastMeeting] = useState<Meeting | null>(null);
  const [loadingPast, setLoadingPast] = useState(false);
  const [insightsError, setInsightsError] = useState("");
  const [language, setLanguage] = useState<string>(
    () => getSttInputLanguages()[0] ?? ""
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLive = meeting.isMeetingActive;

  // After import completes, load the new meeting inline as a past meeting.
  const handleImportComplete = useCallback(
    async (id: string) => {
      await refreshMeetings();
      setLoadingPast(true);
      try {
        setPastMeeting(await getMeetingById(id));
      } finally {
        setLoadingPast(false);
      }
    },
    [refreshMeetings]
  );

  const {
    importFile,
    isImporting,
    importProgress,
    error: importError,
    setError: setImportError,
  } = useImportMeeting(handleImportComplete);

  useEffect(() => {
    refreshMeetings();
  }, [isLive, refreshMeetings]);

  const handleLanguageChange = (code: string) => {
    setLanguage(code);
    setSttInputLanguages(code ? [code] : []);
  };

  const handleSelect = async (value: string) => {
    if (isLive || isImporting) return;
    if (value === "import") {
      fileInputRef.current?.click();
      return; // controlled select reverts to current value, no state change
    }
    if (value === "live") {
      setPastMeeting(null);
      return;
    }
    setLoadingPast(true);
    try {
      setPastMeeting(await getMeetingById(value));
    } finally {
      setLoadingPast(false);
    }
  };

  const handleDeleted = async () => {
    setPastMeeting(null);
    await refreshMeetings();
  };

  const openInsightsWindow = async () => {
    try {
      setInsightsError("");
      await invoke("toggle_insights_window");
    } catch (e) {
      const msg = String(e);
      console.error("toggle_insights_window failed:", e);
      setInsightsError(
        msg.includes("not found") || msg.includes("not allowed")
          ? "Restart the app (Rust changed)."
          : msg
      );
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            void importFile(file);
            e.target.value = "";
          }
        }}
      />

      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-1.5 border-b bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-muted-foreground shrink-0">Meeting</span>
          <select
            value={pastMeeting ? pastMeeting.id : "live"}
            onChange={(e) => handleSelect(e.target.value)}
            disabled={isLive || isImporting}
            title={
              isLive
                ? "Stop the live meeting to switch / view past transcripts"
                : isImporting
                ? "Import in progress…"
                : "Switch between live and past meetings"
            }
            className="h-7 max-w-[18rem] rounded-md border border-input/60 bg-background px-2 text-xs focus:outline-none focus:border-primary/60 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <option value="live">
              {isLive ? "● Live meeting" : "Live / new meeting"}
            </option>
            <option value="import">↑ Import recording…</option>
            {meetings.length > 0 && (
              <optgroup label="Past meetings">
                {meetings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {isLive && (
            <span className="flex items-center gap-1 text-[10px] text-red-500 shrink-0">
              <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
              REC
              {meeting.pendingCount > 0 && ` · transcribing ${meeting.pendingCount}`}
            </span>
          )}
          {(loadingPast || isImporting) && (
            <Loader2 className="size-3.5 animate-spin shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {insightsError && (
            <span className="text-[10px] text-destructive max-w-[12rem] truncate">
              {insightsError}
            </span>
          )}

          {/* Recording controls (hidden while viewing a past meeting or importing) */}
          {!pastMeeting && !isImporting && (
            <>
              <select
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                title="Force the spoken language for transcription (switch on the fly)"
                className="h-7 rounded-md border border-input/60 bg-background px-1.5 text-[11px] focus:outline-none focus:border-primary/60"
              >
                <option value="">Auto</option>
                <option value="pt">PT</option>
                <option value="en">EN</option>
              </select>

              {isLive ? (
                <>
                  <Button
                    size="icon"
                    variant="outline"
                    className={cn(
                      "size-7",
                      meeting.micMuted &&
                        "bg-red-50 hover:bg-red-100 dark:bg-red-950/40"
                    )}
                    onClick={meeting.toggleMic}
                    title={
                      meeting.micMuted
                        ? "Mic muted — click to unmute"
                        : "Mute my microphone"
                    }
                  >
                    {meeting.micMuted ? (
                      <MicOffIcon className="size-4 text-red-500" />
                    ) : (
                      <MicIcon className="size-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7"
                    onClick={meeting.stopMeeting}
                    title="Stop recording"
                  >
                    <SquareIcon className="size-3" />
                    Stop
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  className="h-7"
                  onClick={meeting.startMeeting}
                  disabled={startDisabled}
                  title={
                    startDisabled
                      ? "Stop system-audio insights to start a meeting"
                      : "Start recording (mic + system audio)"
                  }
                >
                  <MicIcon className="size-3.5" />
                  Start
                </Button>
              )}
            </>
          )}

          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={openInsightsWindow}
            title="Open the insights in a separate, movable window"
          >
            <SparklesIcon className="size-3.5" />
            Insights
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={onClose}
            title="Close panel (recording keeps running in the background)"
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col">
        {importError && (
          <div className="shrink-0 mx-3 mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive flex items-center justify-between gap-2">
            <span>{importError}</span>
            <button
              onClick={() => setImportError("")}
              className="shrink-0 text-destructive/70 hover:text-destructive"
              aria-label="Dismiss"
            >
              <XIcon className="size-3" />
            </button>
          </div>
        )}

        {isImporting ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
            <FileUp className="size-6 text-muted-foreground/50" />
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Transcribing {importProgress.current} of {importProgress.total}{" "}
              {importProgress.total === 1 ? "chunk" : "chunks"}…
            </p>
            <p className="text-[10px] text-muted-foreground/60">
              Long recordings may take a moment.
            </p>
          </div>
        ) : pastMeeting ? (
          <PastMeetingCard
            meeting={pastMeeting}
            onDeleted={handleDeleted}
            onResume={() => {
              const m = pastMeeting;
              setPastMeeting(null);
              void meeting.resumeMeeting(m);
            }}
            resumeDisabled={startDisabled}
          />
        ) : isLive || meeting.segments.length > 0 ? (
          <>
            {meeting.error && (
              <div className="shrink-0 mx-3 mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive">
                {meeting.error}
              </div>
            )}
            <MeetingAsk segments={meeting.segments} />
            <TranscriptList
              segments={meeting.segments}
              autoScroll={isLive}
              emptyText="Listening… captured speech will appear here in real time."
            />
          </>
        ) : (
          <div className="h-full flex items-center justify-center p-6 text-center">
            <p className="text-xs text-muted-foreground max-w-xs">
              Press <strong>Start</strong> to begin a meeting transcript, or pick
              a past meeting from the dropdown above to review it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
