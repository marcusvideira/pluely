export type SegmentSource = "you" | "others";

export interface TranscriptSegment {
  id: string;
  meetingId: string;
  source: SegmentSource;
  text: string;
  timestamp: number;
  // In-memory only: capture time of the last clip merged into this segment,
  // used to decide whether the next clip continues it. Not persisted.
  lastAt?: number;
}

export interface Meeting {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  summary: string | null;
  segments: TranscriptSegment[];
}
