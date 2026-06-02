import { MeetingInsights } from "@/pages/app/components/meeting/MeetingInsights";
import { TranscriptSegment } from "@/types";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { XIcon } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Detached, movable Insights window. Receives the meeting transcript segments
 * from the main overlay via the `insights:segments` event and renders the
 * insights panel (auto-generates as segments arrive). Drag the header to move.
 */
const InsightsWindow = () => {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);

  useEffect(() => {
    const unlisten = listen<TranscriptSegment[]>("insights:segments", (e) => {
      setSegments(Array.isArray(e.payload) ? e.payload : []);
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col bg-background overflow-hidden">
      <div
        data-tauri-drag-region
        className="shrink-0 flex items-center justify-between px-3 py-2 border-b cursor-move select-none bg-muted/30"
      >
        <span data-tauri-drag-region className="text-xs font-semibold">
          Insights
        </span>
        <button
          onClick={() => invoke("toggle_insights_window")}
          title="Close"
          className="rounded p-1 hover:bg-muted"
        >
          <XIcon className="size-4" />
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <MeetingInsights segments={segments} />
      </div>
    </div>
  );
};

export default InsightsWindow;
