import { Button, Markdown } from "@/components";
import { STT_LANGUAGES } from "@/config";
import { PageLayout } from "@/layouts";
import { useApp } from "@/contexts";
import {
  fetchAIResponse,
  getMeetingById,
  updateMeetingSummary,
  deleteMeeting as deleteMeetingAction,
  downloadMeetingMarkdown,
} from "@/lib";
import { Meeting } from "@/types";
import {
  Check,
  Download,
  Loader2,
  SparklesIcon,
  Trash2,
} from "lucide-react";
import moment from "moment";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LiveTranscript } from "./LiveTranscript";

const SUMMARY_SYSTEM_PROMPT =
  "You are a meeting assistant. Summarize the following meeting transcript. Provide, in markdown: a concise overview, key discussion points, decisions made, and action items with owners where identifiable. Be faithful to the transcript and do not invent details.";

const MeetingView = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { selectedAIProvider, allAiProviders } = useApp();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [streamingSummary, setStreamingSummary] = useState("");
  const [error, setError] = useState<string>("");
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Output language for the AI summary ("" = match the transcript language).
  const [summaryLanguage, setSummaryLanguage] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!meetingId) return;
      setIsLoading(true);
      try {
        const result = await getMeetingById(meetingId);
        if (!cancelled) setMeeting(result);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [meetingId]);

  const handleSummarize = async () => {
    if (!meeting) return;
    setError("");

    const provider = allAiProviders.find(
      (p) => p.id === selectedAIProvider.provider
    );
    if (!selectedAIProvider.provider || !provider) {
      setError("Please select an AI provider in settings first.");
      return;
    }
    if (meeting.segments.length === 0) {
      setError("Nothing to summarize — the transcript is empty.");
      return;
    }

    const transcript = [...meeting.segments]
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(
        (s) =>
          `[${moment(s.timestamp).format("HH:mm:ss")}] ${
            s.source === "you" ? "You" : "Others"
          }: ${s.text}`
      )
      .join("\n");

    const languageInstruction = summaryLanguage
      ? ` Write the entire summary in ${summaryLanguage}, regardless of the transcript's language.`
      : " Write the summary in the same language as the transcript.";
    const systemPrompt = SUMMARY_SYSTEM_PROMPT + languageInstruction;

    const controller = new AbortController();
    abortRef.current = controller;
    setIsSummarizing(true);
    setStreamingSummary("");

    try {
      let full = "";
      for await (const chunk of fetchAIResponse({
        provider,
        selectedProvider: selectedAIProvider,
        systemPrompt,
        history: [],
        userMessage: transcript,
        imagesBase64: [],
        signal: controller.signal,
        enhanceSystemPrompt: false,
      })) {
        full += chunk;
        setStreamingSummary(full);
      }

      if (controller.signal.aborted) return;

      const now = Date.now();
      await updateMeetingSummary(meeting.id, full, now);
      setMeeting((prev) =>
        prev ? { ...prev, summary: full, updatedAt: now } : prev
      );
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(e instanceof Error ? e.message : "Failed to summarize");
      }
    } finally {
      setIsSummarizing(false);
      abortRef.current = null;
    }
  };

  const handleExport = () => {
    if (!meeting) return;
    downloadMeetingMarkdown(meeting);
    setIsDownloaded(true);
    setTimeout(() => setIsDownloaded(false), 2000);
  };

  const handleDelete = async () => {
    if (!meeting) return;
    await deleteMeetingAction(meeting.id);
    navigate("/meetings");
  };

  const summaryToShow = isSummarizing ? streamingSummary : meeting?.summary;

  return (
    <PageLayout
      title={meeting?.title || "Meeting"}
      description={
        meeting
          ? `${meeting.segments.length} segments • ${moment(
              meeting.createdAt
            ).format("MMM D, YYYY hh:mm A")}`
          : "Loading…"
      }
      allowBackButton
      rightSlot={
        meeting ? (
          <div className="flex items-center gap-2">
            <select
              value={summaryLanguage}
              onChange={(e) => setSummaryLanguage(e.target.value)}
              disabled={isSummarizing}
              title="Summary language"
              className="h-8 rounded-md border border-input/60 bg-background px-2 text-xs focus:outline-none focus:border-primary/60"
            >
              <option value="">Auto (match transcript)</option>
              {STT_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.label}>
                  {lang.label}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSummarize}
              disabled={isSummarizing}
              title="Summarize with AI"
            >
              {isSummarizing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <SparklesIcon className="size-4" />
              )}
              Summarize
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              title="Download as Markdown"
            >
              {isDownloaded ? (
                <Check className="size-4 text-green-500" />
              ) : (
                <Download className="size-4" />
              )}
              Export
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete meeting"
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        ) : null
      }
    >
      {error && (
        <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
          <strong>Error:</strong> {error}
        </div>
      )}

      {summaryToShow && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Summary</p>
          <div className="rounded-xl border border-border/60 bg-black/5 dark:bg-white/5 p-4 text-sm">
            <Markdown>{summaryToShow}</Markdown>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-semibold">Transcript</p>
        {!isLoading && meeting && (
          <LiveTranscript segments={meeting.segments} autoScroll={false} />
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-2">Delete Meeting</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to delete this meeting? This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
};

export default MeetingView;
