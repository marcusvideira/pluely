import { Button, Markdown, ScrollArea } from "@/components";
import { useApp } from "@/contexts";
import { fetchAIResponse } from "@/lib";
import { cn } from "@/lib/utils";
import { TranscriptSegment } from "@/types";
import { Loader2, SparklesIcon } from "lucide-react";
import moment from "moment";
import { useCallback, useEffect, useRef, useState } from "react";

interface MeetingInsightsProps {
  segments: TranscriptSegment[];
}

interface Insight {
  id: string;
  text: string;
  timestamp: number;
}

const MAX_CONTEXT_SEGMENTS = 60;
// Auto-generation tuning: short lull before generating, refresh during
// continuous talk, after a couple of new utterances.
const MIN_NEW_SEGMENTS = 2;
const AUTO_DEBOUNCE_MS = 3000;
const AUTO_MAX_WAIT_MS = 20000;

const INSIGHT_SYSTEM_PROMPT = [
  "You are an expert real-time meeting copilot for the user (the person labeled \"You\" in the transcript).",
  "Read the transcript and give immediately useful, concrete help for THIS specific conversation — never generic advice.",
  "Reply in the SAME language as the transcript, as short markdown.",
  "",
  "Provide, when applicable:",
  "- **Suggest:** a concrete recommendation or proposal the user could make right now. Name specific options, tools, sizes, or trade-offs that fit exactly what is being discussed (e.g. for deploying a .NET app with MySQL and no Docker, propose concrete hosting like a single VM with the app as a service + managed MySQL, or a managed app platform, with rough sizing).",
  "- **Ask:** 1–2 sharp questions the user should ask to unblock or clarify the decision (budget, expected load, cloud preference, existing infra, constraints).",
  "",
  "Hard rules:",
  "- Ground everything STRICTLY in the transcript. NEVER invent facts, technologies, names, or numbers that were not mentioned. If they said MySQL, do not switch to PostgreSQL; if no cloud was named, don't assume one.",
  "- Be decision-useful and concrete. Do NOT output filler like \"develop a plan\", \"consider requirements\", or restatements of the obvious.",
  "- Keep it under ~5 short bullets total.",
].join("\n");

/**
 * Side column that generates AI insights about the live meeting. Auto mode
 * regenerates as new transcript segments arrive (debounced); the spark button
 * also generates on demand. Insights stack newest-first.
 */
export const MeetingInsights = ({ segments }: MeetingInsightsProps) => {
  const { selectedAIProvider, allAiProviders } = useApp();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [streaming, setStreaming] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [auto, setAuto] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const isGeneratingRef = useRef(false);
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const lastInsightSegRef = useRef(0);
  const lastInsightTimeRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generateRef = useRef<(() => Promise<void>) | null>(null);

  const buildContext = () =>
    [...segmentsRef.current]
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-MAX_CONTEXT_SEGMENTS)
      .map((s) => `${s.source === "you" ? "You" : "Others"}: ${s.text}`)
      .join("\n");

  const generate = useCallback(async () => {
    if (isGeneratingRef.current) return;

    const provider = allAiProviders.find(
      (p) => p.id === selectedAIProvider.provider
    );
    if (!selectedAIProvider.provider || !provider) {
      setError("Select an AI provider in settings first.");
      return;
    }

    const context = buildContext();
    if (!context) {
      setError("Nothing captured yet.");
      return;
    }
    setError("");

    // Mark immediately so auto mode doesn't re-trigger mid-generation.
    lastInsightSegRef.current = segmentsRef.current.length;
    const controller = new AbortController();
    abortRef.current = controller;
    isGeneratingRef.current = true;
    setIsGenerating(true);
    setStreaming("");

    try {
      let full = "";
      for await (const chunk of fetchAIResponse({
        provider,
        selectedProvider: selectedAIProvider,
        systemPrompt: INSIGHT_SYSTEM_PROMPT,
        history: [],
        userMessage: `Meeting transcript so far (most recent last):\n\n${context}\n\nBased ONLY on this, give me the most useful insight right now — a concrete suggestion to make and/or the key question to ask.`,
        imagesBase64: [],
        signal: controller.signal,
        enhanceSystemPrompt: false,
      })) {
        full += chunk;
        setStreaming(full);
      }

      if (controller.signal.aborted) return;
      const clean = full.trim();
      if (clean) {
        setInsights((prev) => [
          { id: crypto.randomUUID(), text: clean, timestamp: Date.now() },
          ...prev,
        ]);
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(e instanceof Error ? e.message : "Failed to generate insight");
      }
    } finally {
      lastInsightTimeRef.current = Date.now();
      isGeneratingRef.current = false;
      setIsGenerating(false);
      setStreaming("");
    }
  }, [selectedAIProvider, allAiProviders]);
  generateRef.current = generate;

  // Auto mode: regenerate as new segments arrive (debounced + capped).
  useEffect(() => {
    if (!auto || !selectedAIProvider.provider) return;
    if (segments.length - lastInsightSegRef.current < MIN_NEW_SEGMENTS) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    const sinceLast = Date.now() - lastInsightTimeRef.current;
    const delay = sinceLast > AUTO_MAX_WAIT_MS ? 800 : AUTO_DEBOUNCE_MS;

    debounceRef.current = setTimeout(() => {
      void generateRef.current?.();
    }, delay);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [segments.length, auto, selectedAIProvider.provider]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col min-h-0 bg-muted/10">
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-semibold select-none flex items-center gap-1">
          <SparklesIcon className="size-3.5 text-primary" />
          Insights
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className={cn("h-6 px-2 text-[10px]", auto && "bg-primary/10")}
            onClick={() => setAuto((a) => !a)}
            title={
              auto
                ? "Auto insights are ON (updates as the meeting progresses)"
                : "Auto insights are OFF"
            }
          >
            Auto {auto ? "on" : "off"}
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="size-6"
            onClick={() => void generate()}
            disabled={isGenerating}
            title="Generate an insight now"
          >
            {isGenerating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <SparklesIcon className="size-3.5" />
            )}
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-2 p-3">
          {error && <p className="text-[11px] text-destructive">{error}</p>}

          {isGenerating && streaming && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 text-xs">
              <Markdown>{streaming}</Markdown>
            </div>
          )}

          {insights.length === 0 && !isGenerating && !error && (
            <p className="text-[11px] text-muted-foreground select-none">
              {auto
                ? "Live insights will appear here as the meeting progresses."
                : "Tap ✨ to get an insight about what's being said."}
            </p>
          )}

          {insights.map((insight) => (
            <div
              key={insight.id}
              className="rounded-lg border border-border/60 bg-background p-2 text-xs"
            >
              <div className="text-[10px] text-muted-foreground mb-1">
                {moment(insight.timestamp).format("hh:mm:ss A")}
              </div>
              <Markdown>{insight.text}</Markdown>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
