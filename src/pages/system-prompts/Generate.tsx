import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Button,
  Textarea,
} from "@/components";
import { SparklesIcon } from "lucide-react";
import { useRef, useState } from "react";
import { useApp } from "@/contexts";
import { fetchAIResponse } from "@/lib";

interface GenerateSystemPromptProps {
  onGenerate: (prompt: string, promptName: string) => void;
}

interface SystemPromptResponse {
  prompt_name: string;
  system_prompt: string;
}

const META_SYSTEM_PROMPT =
  'You are an expert prompt engineer. Given the user\'s description of the AI behavior they want, output ONLY a single JSON object with exactly two string keys: "prompt_name" (a short title, max 5 words) and "system_prompt" (the full, ready-to-use system prompt). Do not include markdown, code fences, explanations, or any text outside the JSON object.';

/**
 * Parse the model output defensively: strip code fences and extract the first
 * JSON object if the model added surrounding prose.
 */
function parseGeneratedPrompt(raw: string): SystemPromptResponse | null {
  let text = raw.trim();

  // Strip ```json ... ``` or ``` ... ``` fences
  text = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const tryParse = (candidate: string): SystemPromptResponse | null => {
    try {
      const parsed = JSON.parse(candidate);
      if (
        parsed &&
        typeof parsed.system_prompt === "string" &&
        typeof parsed.prompt_name === "string"
      ) {
        return parsed as SystemPromptResponse;
      }
    } catch {
      // ignore
    }
    return null;
  };

  const direct = tryParse(text);
  if (direct) return direct;

  // Fall back to extracting the first {...} block
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    const extracted = tryParse(match[0]);
    if (extracted) return extracted;
  }

  return null;
}

export const GenerateSystemPrompt = ({
  onGenerate,
}: GenerateSystemPromptProps) => {
  const { selectedAIProvider, allAiProviders } = useApp();
  const [userPrompt, setUserPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleGenerate = async () => {
    if (!userPrompt.trim()) {
      setError("Please describe what you want");
      return;
    }

    const provider = allAiProviders.find(
      (p) => p.id === selectedAIProvider.provider
    );
    if (!selectedAIProvider.provider || !provider) {
      setError("Please select an AI provider in settings first.");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setIsGenerating(true);
      setError(null);

      let full = "";
      for await (const chunk of fetchAIResponse({
        provider,
        selectedProvider: selectedAIProvider,
        systemPrompt: META_SYSTEM_PROMPT,
        history: [],
        userMessage: userPrompt.trim(),
        imagesBase64: [],
        signal: controller.signal,
      })) {
        full += chunk;
      }

      if (controller.signal.aborted) return;

      const parsed = parseGeneratedPrompt(full);
      if (parsed) {
        onGenerate(parsed.system_prompt, parsed.prompt_name);
        setIsOpen(false);
        setUserPrompt("");
      } else {
        setError(
          `Could not parse the generated prompt. Raw response: ${full.slice(
            0,
            300
          )}`
        );
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to generate prompt";
        setError(errorMessage);
        console.error("Error generating system prompt:", err);
      }
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && abortRef.current) {
      abortRef.current.abort();
    }
    setIsOpen(open);
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          aria-label="Generate with AI"
          size="sm"
          variant="outline"
          className="w-fit"
        >
          <SparklesIcon className="h-4 w-4" /> Generate with AI
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        className="w-96 p-4 border shadow-lg"
      >
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium mb-1">Generate a system prompt</p>
            <p className="text-xs text-muted-foreground">
              Describe the AI behavior you want, and your configured AI provider
              will generate a prompt for you.
            </p>
          </div>

          <Textarea
            placeholder="e.g., I want an AI that helps me with code reviews and focuses on best practices..."
            className="min-h-[100px] resize-none border-1 border-input/50 focus:border-primary/50 transition-colors"
            value={userPrompt}
            onChange={(e) => {
              setUserPrompt(e.target.value);
              setError(null);
            }}
            disabled={isGenerating}
          />

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button
            className="w-full"
            onClick={handleGenerate}
            disabled={!userPrompt.trim() || isGenerating}
          >
            {isGenerating ? (
              <>
                <SparklesIcon className="h-4 w-4 animate-pulse" />
                Generating...
              </>
            ) : (
              <>
                <SparklesIcon className="h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
