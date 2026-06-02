import { Badge, ScrollArea } from "@/components";
import { TranscriptSegment } from "@/types";
import moment from "moment";
import { useEffect, useRef } from "react";

interface TranscriptListProps {
  segments: TranscriptSegment[];
  autoScroll?: boolean;
  emptyText?: string;
}

/** Renders transcript segments as You/Others bubbles. Used for both the live
 * meeting and read-only past meetings. */
export const TranscriptList = ({
  segments,
  autoScroll = false,
  emptyText = "No speech captured yet.",
}: TranscriptListProps) => {
  const endRef = useRef<HTMLDivElement | null>(null);
  const sorted = [...segments].sort((a, b) => a.timestamp - b.timestamp);

  useEffect(() => {
    if (autoScroll) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sorted.length, autoScroll]);

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="flex flex-col gap-2 p-4">
        {sorted.length === 0 ? (
          <p className="text-xs text-muted-foreground select-none">
            {emptyText}
          </p>
        ) : (
          sorted.map((segment) => {
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
                    className="text-[10px]"
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
          })
        )}
        <div ref={endRef} />
      </div>
    </ScrollArea>
  );
};
