import { STORAGE_KEYS } from "@/config";
import { safeLocalStorage } from "./helper";

export const DEFAULT_TRANSCRIPTION_SPEED = 1.2;
export const MIN_TRANSCRIPTION_SPEED = 1.0;
export const MAX_TRANSCRIPTION_SPEED = 1.5;

/**
 * Playback-speed multiplier applied to each meeting audio clip before STT.
 * Higher = faster/cheaper but shifts pitch (hurts quality). Read per utterance,
 * so changes apply live. Only takes effect when a language is forced.
 */
export const getTranscriptionSpeed = (): number => {
  const raw = Number(
    safeLocalStorage.getItem(STORAGE_KEYS.MEETING_TRANSCRIPTION_SPEED)
  );
  if (!raw || isNaN(raw)) return DEFAULT_TRANSCRIPTION_SPEED;
  return Math.min(
    MAX_TRANSCRIPTION_SPEED,
    Math.max(MIN_TRANSCRIPTION_SPEED, raw)
  );
};

export const setTranscriptionSpeed = (value: number): void => {
  safeLocalStorage.setItem(
    STORAGE_KEYS.MEETING_TRANSCRIPTION_SPEED,
    String(value)
  );
};

// --- Transcription pause (VAD silence before a clip is sent to STT) ---
// Default ≈ the algorithm's current value (~0.47s). Lower = more frequent,
// faster clips. Applies on the next meeting start.
export const DEFAULT_TRANSCRIPTION_PAUSE_MS = 450;
export const MIN_TRANSCRIPTION_PAUSE_MS = 200;
export const MAX_TRANSCRIPTION_PAUSE_MS = 1500;

export const getTranscriptionPauseMs = (): number => {
  const raw = Number(
    safeLocalStorage.getItem(STORAGE_KEYS.MEETING_TRANSCRIPTION_PAUSE_MS)
  );
  if (!raw || isNaN(raw)) return DEFAULT_TRANSCRIPTION_PAUSE_MS;
  return Math.min(
    MAX_TRANSCRIPTION_PAUSE_MS,
    Math.max(MIN_TRANSCRIPTION_PAUSE_MS, raw)
  );
};

export const setTranscriptionPauseMs = (value: number): void => {
  safeLocalStorage.setItem(
    STORAGE_KEYS.MEETING_TRANSCRIPTION_PAUSE_MS,
    String(value)
  );
};

// --- Conversation break pause (gap that starts a new bubble vs merging) ---
// Default = the algorithm's current value (3s). Read live, applies in real time.
export const DEFAULT_SEGMENT_BREAK_MS = 3000;
export const MIN_SEGMENT_BREAK_MS = 1000;
export const MAX_SEGMENT_BREAK_MS = 8000;

export const getSegmentBreakMs = (): number => {
  const raw = Number(
    safeLocalStorage.getItem(STORAGE_KEYS.MEETING_SEGMENT_BREAK_MS)
  );
  if (!raw || isNaN(raw)) return DEFAULT_SEGMENT_BREAK_MS;
  return Math.min(MAX_SEGMENT_BREAK_MS, Math.max(MIN_SEGMENT_BREAK_MS, raw));
};

export const setSegmentBreakMs = (value: number): void => {
  safeLocalStorage.setItem(
    STORAGE_KEYS.MEETING_SEGMENT_BREAK_MS,
    String(value)
  );
};
