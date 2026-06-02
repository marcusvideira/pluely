import { useRef } from "react";
import { PageLayout } from "@/layouts";
import { useMeetings, useImportMeeting } from "@/hooks";
import { Button } from "@/components";
import { FileUp, Loader2, X } from "lucide-react";
import { MeetingsList } from "./components";

const MeetingTranscription = () => {
  const { meetings, isLoading, deleteMeeting } = useMeetings();
  const { importFile, isImporting, importProgress, error, setError } =
    useImportMeeting();
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <PageLayout
      title="Meetings"
      description="History of your meeting transcripts. Start a live transcript from the main overlay (the notebook button). Open a meeting to summarize it with AI or export it as Markdown."
      rightSlot={
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          title="Import a recording file (audio or video)"
        >
          {isImporting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileUp className="size-4" />
          )}
          {isImporting
            ? `Transcribing ${importProgress.current} / ${importProgress.total}…`
            : "Import Recording"}
        </Button>
      }
    >
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
      {error && (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <span>
            <strong>Import error:</strong> {error}
          </span>
          <button
            onClick={() => setError("")}
            className="shrink-0 text-destructive/70 hover:text-destructive"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
      <MeetingsList
        meetings={meetings}
        isLoading={isLoading}
        onDelete={deleteMeeting}
      />
    </PageLayout>
  );
};

export default MeetingTranscription;
