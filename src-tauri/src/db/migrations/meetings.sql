-- Create meetings table
CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    summary TEXT
);

-- Create transcript_segments table
CREATE TABLE IF NOT EXISTS transcript_segments (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    source TEXT NOT NULL CHECK(source IN ('you', 'others')),
    text TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_meetings_updated_at ON meetings(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_segments_meeting_id ON transcript_segments(meeting_id);
CREATE INDEX IF NOT EXISTS idx_segments_meeting_timestamp ON transcript_segments(meeting_id, timestamp ASC);

-- Trigger to bump meeting updated_at when a segment is inserted
CREATE TRIGGER IF NOT EXISTS update_meeting_timestamp_on_segment_insert
AFTER INSERT ON transcript_segments
FOR EACH ROW
BEGIN
    UPDATE meetings
    SET updated_at = NEW.timestamp
    WHERE id = NEW.meeting_id;
END;
