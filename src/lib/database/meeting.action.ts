import { getDatabase } from "./config";
import { Meeting, TranscriptSegment, SegmentSource } from "@/types";

/**
 * Database meeting row (flattened for SQL)
 */
interface DbMeeting {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  summary: string | null;
}

/**
 * Database transcript segment row (flattened for SQL)
 */
interface DbSegment {
  id: string;
  meeting_id: string;
  source: SegmentSource;
  text: string;
  timestamp: number;
}

function mapMeeting(row: DbMeeting, segments: TranscriptSegment[]): Meeting {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    summary: row.summary ?? null,
    segments,
  };
}

function mapSegment(row: DbSegment): TranscriptSegment {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    source: row.source,
    text: row.text,
    timestamp: row.timestamp,
  };
}

/**
 * Generate a unique meeting id.
 */
export function generateMeetingId(): string {
  return `meeting_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Create a new meeting row (without segments).
 */
export async function createMeeting(meeting: {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    "INSERT INTO meetings (id, title, created_at, updated_at, summary) VALUES (?, ?, ?, ?, NULL)",
    [meeting.id, meeting.title, meeting.createdAt, meeting.updatedAt]
  );
}

/**
 * Append a transcript segment to a meeting. The DB trigger bumps the
 * meeting's updated_at automatically.
 */
export async function addSegment(segment: TranscriptSegment): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    "INSERT INTO transcript_segments (id, meeting_id, source, text, timestamp) VALUES (?, ?, ?, ?, ?)",
    [
      segment.id,
      segment.meetingId,
      segment.source,
      segment.text,
      segment.timestamp,
    ]
  );
}

/**
 * Update an existing segment's text (used when coalescing consecutive clips
 * into one transcript message).
 */
export async function updateSegmentText(
  id: string,
  text: string
): Promise<void> {
  const db = await getDatabase();
  await db.execute("UPDATE transcript_segments SET text = ? WHERE id = ?", [
    text,
    id,
  ]);
}

/**
 * Get all meetings (without segments, for the list view).
 */
export async function getAllMeetings(): Promise<Meeting[]> {
  const db = await getDatabase();
  const rows = await db.select<DbMeeting[]>(
    "SELECT * FROM meetings ORDER BY updated_at DESC"
  );
  return rows.map((row) => mapMeeting(row, []));
}

/**
 * Get a single meeting with all of its transcript segments.
 */
export async function getMeetingById(id: string): Promise<Meeting | null> {
  const db = await getDatabase();
  const rows = await db.select<DbMeeting[]>(
    "SELECT * FROM meetings WHERE id = ?",
    [id]
  );
  if (!rows.length) return null;

  const segmentRows = await db.select<DbSegment[]>(
    "SELECT * FROM transcript_segments WHERE meeting_id = ? ORDER BY timestamp ASC",
    [id]
  );

  return mapMeeting(rows[0], segmentRows.map(mapSegment));
}

/**
 * Save an AI-generated summary onto a meeting.
 */
export async function updateMeetingSummary(
  id: string,
  summary: string,
  updatedAt: number
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    "UPDATE meetings SET summary = ?, updated_at = ? WHERE id = ?",
    [summary, updatedAt, id]
  );
}

/**
 * Rename a meeting.
 */
export async function updateMeetingTitle(
  id: string,
  title: string
): Promise<void> {
  const db = await getDatabase();
  await db.execute("UPDATE meetings SET title = ? WHERE id = ?", [title, id]);
}

/**
 * Delete a meeting (segments cascade via the FK).
 */
export async function deleteMeeting(id: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.execute("DELETE FROM meetings WHERE id = ?", [id]);
  return result.rowsAffected > 0;
}

/**
 * Delete all meetings that have no transcript segments (e.g. recordings that
 * captured nothing, or were orphaned by an app crash). Returns rows removed.
 */
export async function deleteEmptyMeetings(): Promise<number> {
  const db = await getDatabase();
  const result = await db.execute(
    "DELETE FROM meetings WHERE id NOT IN (SELECT DISTINCT meeting_id FROM transcript_segments)"
  );
  return result.rowsAffected;
}
