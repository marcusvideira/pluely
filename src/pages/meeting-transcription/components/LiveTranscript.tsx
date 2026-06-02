import { Badge, Empty } from "@/components";
import { TranscriptSegment } from "@/types";
import { MessagesSquareIcon } from "lucide-react";
import moment from "moment";
import { useEffect, useRef } from "react";

interface LiveTranscriptProps {
  segments: TranscriptSegment[];
  autoScroll?: boolean;
}

export const LiveTranscript = ({
  segments,
  autoScroll = true,
}: LiveTranscriptProps) => {
  const endRef = useRef<HTMLDivElement | null>(null);

  const sorted = [...segments].sort((a, b) => a.timestamp - b.timestamp);

  useEffect(() => {
    if (autoScroll) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [sorted.length, autoScroll]);

  if (sorted.length === 0) {
    return (
      <Empty
        icon={MessagesSquareIcon}
        title="No transcript yet"
        description="Captured speech will appear here as the meeting progresses."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-4 pr-4">
      {sorted.map((segment) => {
        const isYou = segment.source === "you";
        return (
          <div
            key={segment.id}
            className={`flex flex-col gap-1 ${
              isYou ? "items-end" : "items-start"
            }`}
          >
            <div className="flex items-center gap-2">
              <Badge
                variant={isYou ? "default" : "outline"}
                className="text-xs"
              >
                {isYou ? "You" : "Others"}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {moment(segment.timestamp).format("hh:mm:ss A")}
              </span>
            </div>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                isYou
                  ? "bg-primary/10 border border-primary/20"
                  : "bg-black/5 dark:bg-white/5 border border-border/60"
              }`}
            >
              {segment.text}
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
};
