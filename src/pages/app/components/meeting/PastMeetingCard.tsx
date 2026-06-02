import { Button, Markdown, ScrollArea } from "@/components";
import { useApp } from "@/contexts";
import {
  fetchAIResponse,
  updateMeetingSummary,
  deleteMeeting as deleteMeetingAction,
  downloadMeetingMarkdown,
} from "@/lib";
import { Meeting } from "@/types";
import {
  Check,
  Download,
  Loader2,
  MicIcon,
  SparklesIcon,
  Trash2,
} from "lucide-react";
import moment from "moment";
import { useRef, useState } from "react";
import { MeetingAsk } from "./MeetingAsk";
import { TranscriptList } from "./TranscriptList";

interface PastMeetingCardProps {
  meeting: Meeting;
  onDeleted: () => void;
  onResume: () => void;
  resumeDisabled?: boolean;
}

const SUMMARY_SYSTEM_PROMPT =
  "You are a meeting assistant. Summarize the following meeting transcript in markdown: a concise overview, key discussion points, decisions made, and action items with owners where identifiable. Be faithful to the transcript and do not invent details. Write in the same language as the transcript.";

export const PastMeetingCard = ({
  meeting,
  onDeleted,
  onResume,
  resumeDisabled = false,
}: PastMeetingCardProps) => {
  const { selectedAIProvider, allAiProviders } = useApp();
  const [summary, setSummary] = useState<string | null>(meeting.summary);
  const [streaming, setStreaming] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const summarize = async () => {
    setError("");
    const provider = allAiProviders.find(
      (p) => p.id === selectedAIProvider.provider
    );
    if (!selectedAIProvider.provider || !provider) {
      setError("Select an AI provider in settings first.");
      return;
    }
    if (meeting.segments.length === 0) {
      setError("Transcript is empty.");
      return;
    }

    const transcript = [...meeting.segments]
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((s) => `${s.source === "you" ? "You" : "Others"}: ${s.text}`)
      .join("\n");

    const controller = new AbortController();
    abortRef.current = controller;
    setIsSummarizing(true);
    setStreaming("");

    try {
      let full = "";
      for await (const chunk of fetchAIResponse({
        provider,
        selectedProvider: selectedAIProvider,
        systemPrompt: SUMMARY_SYSTEM_PROMPT,
        history: [],
        userMessage: transcript,
        imagesBase64: [],
        signal: controller.signal,
        enhanceSystemPrompt: false,
      })) {
        full += chunk;
        setStreaming(full);
      }
      if (controller.signal.aborted) return;
      const now = Date.now();
      await updateMeetingSummary(meeting.id, full, now);
      setSummary(full);
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(e instanceof Error ? e.message : "Failed to summarize");
      }
    } finally {
      setStreaming("");
      setIsSummarizing(false);
      abortRef.current = null;
    }
  };

  const exportMd = () => {
    downloadMeetingMarkdown({ ...meeting, summary });
    setIsDownloaded(true);
    setTimeout(() => setIsDownloaded(false), 2000);
  };

  const remove = async () => {
    await deleteMeetingAction(meeting.id);
    onDeleted();
  };

  const shownSummary = isSummarizing ? streaming : summary;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="min-w-0">
          <h3 className="font-semibold text-xs truncate">{meeting.title}</h3>
          <p className="text-[10px] text-muted-foreground">
            {meeting.segments.length} segments •{" "}
            {moment(meeting.createdAt).format("MMM D, YYYY hh:mm A")}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            className="h-7"
            onClick={onResume}
            disabled={resumeDisabled}
            title={
              resumeDisabled
                ? "Stop system-audio insights to resume recording"
                : "Resume recording into this meeting"
            }
          >
            <MicIcon className="size-3.5" />
            Resume
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={summarize}
            disabled={isSummarizing}
            title="Summarize with AI"
          >
            {isSummarizing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <SparklesIcon className="size-3.5" />
            )}
            Summarize
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="size-7"
            onClick={exportMd}
            title="Download as Markdown"
          >
            {isDownloaded ? (
              <Check className="size-4 text-green-500" />
            ) : (
              <Download className="size-4" />
            )}
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="size-7"
            onClick={remove}
            title="Delete meeting"
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </div>

      {error && (
        <div className="shrink-0 mx-3 mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive">
          {error}
        </div>
      )}

      {shownSummary && (
        <div className="shrink-0 mx-3 mt-2 rounded-md border border-border/60 bg-muted/30 p-2 text-xs max-h-40">
          <ScrollArea className="max-h-36">
            <Markdown>{shownSummary}</Markdown>
          </ScrollArea>
        </div>
      )}

      {/* Ask questions about this past meeting */}
      <MeetingAsk segments={meeting.segments} />

      <TranscriptList segments={meeting.segments} emptyText="No transcript." />
    </div>
  );
};
