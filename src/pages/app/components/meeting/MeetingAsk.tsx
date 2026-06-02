import { Button, Markdown, ScrollArea } from "@/components";
import { useApp } from "@/contexts";
import { fetchAIResponse } from "@/lib";
import { TranscriptSegment } from "@/types";
import { Loader2, SendIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";

interface MeetingAskProps {
  segments: TranscriptSegment[];
}

// How much recent transcript to feed the assistant as context.
const MAX_CONTEXT_SEGMENTS = 50;

/**
 * Real-time "ask for help" box inside the meeting transcript panel. The
 * question is answered by the configured AI provider using the recent
 * transcript as context, so the user can get help about what's happening live.
 */
export const MeetingAsk = ({ segments }: MeetingAskProps) => {
  const { selectedAIProvider, allAiProviders } = useApp();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const buildContext = () => {
    return [...segments]
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-MAX_CONTEXT_SEGMENTS)
      .map((s) => `${s.source === "you" ? "You" : "Others"}: ${s.text}`)
      .join("\n");
  };

  const ask = async () => {
    const q = question.trim();
    if (!q) return;
    setError("");

    const provider = allAiProviders.find(
      (p) => p.id === selectedAIProvider.provider
    );
    if (!selectedAIProvider.provider || !provider) {
      setError("Select an AI provider in settings first.");
      return;
    }

    const context = buildContext();
    const systemPrompt =
      "You are a real-time meeting assistant. Use the ongoing meeting transcript below as context to help the user concisely and practically. If the transcript is empty or unrelated, answer the question directly." +
      (context ? `\n\nMeeting transcript so far:\n${context}` : "");

    const controller = new AbortController();
    abortRef.current = controller;
    setIsAsking(true);
    setAnswer("");

    try {
      let full = "";
      for await (const chunk of fetchAIResponse({
        provider,
        selectedProvider: selectedAIProvider,
        systemPrompt,
        history: [],
        userMessage: q,
        imagesBase64: [],
        signal: controller.signal,
        enhanceSystemPrompt: false,
      })) {
        full += chunk;
        setAnswer(full);
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(e instanceof Error ? e.message : "Failed to get an answer");
      }
    } finally {
      setIsAsking(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  };

  const clearAnswer = () => {
    abortRef.current?.abort();
    setAnswer("");
    setError("");
    setQuestion("");
  };

  return (
    <div className="shrink-0 border-b bg-background/60 px-4 py-2 space-y-2">
      <div className="flex items-center gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask for help about the meeting…"
          disabled={isAsking}
          className="flex-1 h-8 rounded-md border border-input/60 bg-background px-2 text-sm focus:outline-none focus:border-primary/60"
        />
        <Button
          size="sm"
          className="h-8"
          onClick={ask}
          disabled={isAsking || !question.trim()}
          title="Ask"
        >
          {isAsking ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <SendIcon className="size-4" />
          )}
        </Button>
        {(answer || error) && (
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={clearAnswer}
            title="Clear answer"
          >
            <XIcon className="size-4" />
          </Button>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {answer && (
        <ScrollArea className="max-h-40 rounded-md border border-border/60 bg-muted/30 p-2 text-sm">
          <Markdown>{answer}</Markdown>
        </ScrollArea>
      )}
    </div>
  );
};
