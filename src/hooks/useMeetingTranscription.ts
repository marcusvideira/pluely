import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useApp } from "@/contexts";
import { fetchSTT } from "@/lib";
import {
  createMeeting,
  addSegment,
  updateSegmentText,
  generateMeetingId,
  deleteMeeting,
} from "@/lib/database";
import { speedUpWav, wavDurationMs } from "@/lib/utils";
import { getPrimarySttLanguage } from "@/lib/storage/stt-language.storage";
import {
  getTranscriptionSpeed,
  getTranscriptionPauseMs,
  getSegmentBreakMs,
} from "@/lib/storage/meeting-settings.storage";
import { Meeting, SegmentSource, TranscriptSegment } from "@/types";

// Detects characters from non-Latin scripts (Hangul, Hiragana/Katakana, CJK
// ideographs, Cyrillic, Arabic, Devanagari). Used to drop hallucinated
// wrong-language output when a Latin-script language is forced.
const NON_LATIN_SCRIPT =
  /[가-힣ᄀ-ᇿ぀-ヿ㐀-鿿Ѐ-ӿ؀-ۿऀ-ॿ]/;
const LATIN_LANGUAGES = new Set(["pt", "en", "es", "fr", "de", "it", "nl"]);

// When a Latin-script language is forced, any non-Latin output is a
// hallucination (e.g. Whisper emitting Korean/Japanese on noise) → drop it.
const isWrongScript = (text: string, lang: string | null): boolean => {
  if (!lang || !LATIN_LANGUAGES.has(lang)) return false;
  return NON_LATIN_SCRIPT.test(text);
};

const newSegmentId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `seg_${Date.now()}_${Math.random().toString(36).slice(2)}`;

// One VAD analysis chunk ≈ hop_size / sample_rate. Assuming ~48kHz capture.
const VAD_CHUNK_MS = (1024 / 48000) * 1000; // ~21.3ms

// Builds the system-audio VAD config, deriving the silence threshold (how long
// a pause before a clip is sent to STT) from the user's "transcription pause"
// setting. Read at meeting start.
const buildMeetingVadConfig = () => {
  const pauseMs = getTranscriptionPauseMs();
  const silenceChunks = Math.max(6, Math.round(pauseMs / VAD_CHUNK_MS));
  return {
    enabled: true,
    hop_size: 1024,
    sensitivity_rms: 0.012,
    peak_threshold: 0.035,
    silence_chunks: silenceChunks,
    min_speech_chunks: 6,
    pre_speech_chunks: 10,
    noise_gate_threshold: 0.003,
    max_recording_duration_secs: 20, // safety flush for continuous speech
  };
};

export function useMeetingTranscription() {
  const {
    selectedSttProvider,
    allSttProviders,
    selectedAudioDevices,
  } = useApp();

  const [meetingId, setMeetingId] = useState<string>("");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [isMeetingActive, setIsMeetingActive] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState<string>("");
  // When true, the microphone ("You") capture is paused; system audio
  // ("Others") keeps being transcribed.
  const [micMuted, setMicMuted] = useState(false);

  const isActiveRef = useRef(false);
  const meetingIdRef = useRef<string>("");
  const abortControllersRef = useRef<Set<AbortController>>(new Set());
  const speechUnlistenRef = useRef<UnlistenFn | null>(null);
  // Mirror of segments for use inside stable callbacks (e.g. stopMeeting).
  const segmentsRef = useRef<TranscriptSegment[]>([]);
  segmentsRef.current = segments;

  // Shared routine: transcribe a captured audio blob and append (or merge into)
  // a transcript segment. `capturedAt` is when the clip's speech ended.
  const transcribeAndAppend = useCallback(
    async (audio: Blob, source: SegmentSource, capturedAt: number) => {
      if (!isActiveRef.current) return;

      const providerConfig = allSttProviders.find(
        (p) => p.id === selectedSttProvider.provider
      );
      if (!selectedSttProvider.provider || !providerConfig) {
        setError(
          "No speech-to-text provider selected. Configure one in App Settings → Audio."
        );
        return;
      }

      const controller = new AbortController();
      abortControllersRef.current.add(controller);
      setPendingCount((c) => c + 1);

      try {
        const forcedLanguage = getPrimarySttLanguage();
        // Speed is read live from settings (per utterance). Only applied when a
        // language is forced: with a forced language the pitch shift is harmless
        // (detection is bypassed), but in auto-detect mode it hurts language
        // detection, so we send the original audio.
        const speed = getTranscriptionSpeed();
        const clip =
          forcedLanguage && speed > 1
            ? await speedUpWav(audio, speed)
            : audio;
        const text = await fetchSTT({
          provider: providerConfig,
          selectedProvider: selectedSttProvider,
          audio: clip,
        });

        // Drop the result if the meeting was stopped while transcribing.
        if (!isActiveRef.current || controller.signal.aborted) return;

        const cleaned = (text || "").trim();
        // Skip empty results and known "no speech" sentinels so silence/noise
        // doesn't produce junk transcript segments.
        if (!cleaned || cleaned.toLowerCase() === "no transcription found") {
          return;
        }
        // Safety net: when a Latin-script language is forced, drop output in a
        // different script (Korean/Japanese/etc.) — it's a hallucination.
        if (isWrongScript(cleaned, forcedLanguage)) {
          console.debug("Dropping wrong-script transcription:", cleaned);
          return;
        }

        // Decide whether to continue the last message or start a new one.
        // Measure the SILENCE gap = this clip's start (capturedAt − duration)
        // minus the previous clip's end. This ignores the length of the clip
        // itself, so a long utterance with no real pause still concatenates.
        const durationMs = await wavDurationMs(audio);
        const clipStart = capturedAt - durationMs;
        const list = segmentsRef.current;
        const last = list.length
          ? [...list].sort(
              (a, b) => (a.lastAt ?? a.timestamp) - (b.lastAt ?? b.timestamp)
            )[list.length - 1]
          : undefined;
        const prevEnd = last ? last.lastAt ?? last.timestamp : 0;
        const silenceGap = clipStart - prevEnd;
        const mergeGap = getSegmentBreakMs();
        const shouldMerge =
          !!last &&
          last.source === source &&
          silenceGap <= mergeGap &&
          silenceGap >= -2000; // allow padding overlap; reject out-of-order

        if (shouldMerge && last) {
          const mergedText = `${last.text} ${cleaned}`.trim();
          setSegments((prev) =>
            prev.map((s) =>
              s.id === last.id
                ? { ...s, text: mergedText, lastAt: capturedAt }
                : s
            )
          );
          try {
            await updateSegmentText(last.id, mergedText);
          } catch (e) {
            console.error("Failed to update merged segment:", e);
          }
        } else {
          const segment: TranscriptSegment = {
            id: newSegmentId(),
            meetingId: meetingIdRef.current,
            source,
            text: cleaned,
            timestamp: capturedAt,
            lastAt: capturedAt,
          };
          setSegments((prev) => [...prev, segment]);
          try {
            await addSegment(segment);
          } catch (e) {
            console.error("Failed to persist transcript segment:", e);
          }
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "Transcription failed");
        }
      } finally {
        abortControllersRef.current.delete(controller);
        setPendingCount((c) => Math.max(0, c - 1));
      }
    },
    [allSttProviders, selectedSttProvider]
  );

  // Microphone utterances (already converted to a WAV Blob by MeetingMicVad,
  // mirroring the AutoSpeechVad mic feature) are routed here as "you".
  const handleMicUtterance = useCallback(
    async (audio: Blob) => {
      if (!isActiveRef.current) return;
      await transcribeAndAppend(audio, "you", Date.now());
    },
    [transcribeAndAppend]
  );

  // Register the system-audio "speech-detected" listener once.
  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      const unlisten = await listen("speech-detected", async (event) => {
        if (!isActiveRef.current) return;
        const capturedAt = Date.now();
        try {
          const base64 = event.payload as string;
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: "audio/wav" });
          await transcribeAndAppend(blob, "others", capturedAt);
        } catch (e) {
          console.error("Failed to process system audio segment:", e);
        }
      });

      if (cancelled) {
        unlisten();
      } else {
        speechUnlistenRef.current = unlisten;
      }
    };

    setup();

    return () => {
      cancelled = true;
      if (speechUnlistenRef.current) {
        speechUnlistenRef.current();
        speechUnlistenRef.current = null;
      }
    };
  }, [transcribeAndAppend]);

  const startMeeting = useCallback(async () => {
    setError("");

    if (!selectedSttProvider.provider) {
      setError(
        "No speech-to-text provider selected. Configure one in App Settings → Audio."
      );
      return;
    }

    // Verify system-audio access (best effort).
    try {
      const hasAccess = await invoke<boolean>("check_system_audio_access");
      if (!hasAccess) {
        setError(
          "System audio access is not granted. Enable it in App Settings → Audio."
        );
        return;
      }
    } catch {
      // If the check fails we still try to start; capture errors surface below.
    }

    const id = generateMeetingId();
    const now = Date.now();
    try {
      await createMeeting({
        id,
        title: `Meeting ${new Date(now).toLocaleString()}`,
        createdAt: now,
        updatedAt: now,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create meeting");
      return;
    }

    setMeetingId(id);
    meetingIdRef.current = id;
    setSegments([]);
    setPendingCount(0);
    setMicMuted(false);
    isActiveRef.current = true;
    setIsMeetingActive(true);

    // Start system-audio capture (VAD mode).
    try {
      await invoke<string>("stop_system_audio_capture");
      const deviceId =
        selectedAudioDevices.output.id &&
        selectedAudioDevices.output.id !== "default"
          ? selectedAudioDevices.output.id
          : null;
      await invoke<string>("start_system_audio_capture", {
        vadConfig: buildMeetingVadConfig(),
        deviceId,
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to start system audio capture"
      );
    }
  }, [selectedSttProvider.provider, selectedAudioDevices.output.id]);

  // Resume recording into an existing meeting (e.g. after the app was closed
  // mid-session). Loads its prior segments and appends new ones to the same id.
  const resumeMeeting = useCallback(
    async (existing: Meeting) => {
      setError("");

      if (!selectedSttProvider.provider) {
        setError(
          "No speech-to-text provider selected. Configure one in App Settings → Audio."
        );
        return;
      }
      try {
        const hasAccess = await invoke<boolean>("check_system_audio_access");
        if (!hasAccess) {
          setError(
            "System audio access is not granted. Enable it in App Settings → Audio."
          );
          return;
        }
      } catch {
        // fall through; capture errors surface below
      }

      setMeetingId(existing.id);
      meetingIdRef.current = existing.id;
      setSegments(existing.segments ?? []);
      setPendingCount(0);
      setMicMuted(false);
      isActiveRef.current = true;
      setIsMeetingActive(true);

      try {
        await invoke<string>("stop_system_audio_capture");
        const deviceId =
          selectedAudioDevices.output.id &&
          selectedAudioDevices.output.id !== "default"
            ? selectedAudioDevices.output.id
            : null;
        await invoke<string>("start_system_audio_capture", {
          vadConfig: buildMeetingVadConfig(),
          deviceId,
        });
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Failed to start system audio capture"
        );
      }
    },
    [selectedSttProvider.provider, selectedAudioDevices.output.id]
  );

  const stopMeeting = useCallback(async () => {
    isActiveRef.current = false;
    setIsMeetingActive(false);

    // Abort in-flight transcriptions.
    abortControllersRef.current.forEach((c) => c.abort());
    abortControllersRef.current.clear();
    setPendingCount(0);

    try {
      await invoke<string>("stop_system_audio_capture");
    } catch (e) {
      console.error("Failed to stop system audio capture:", e);
    }

    // Discard the meeting if it captured nothing.
    if (segmentsRef.current.length === 0 && meetingIdRef.current) {
      try {
        await deleteMeeting(meetingIdRef.current);
      } catch (e) {
        console.error("Failed to discard empty meeting:", e);
      }
    }
  }, []);

  const toggleMeeting = useCallback(() => {
    if (isActiveRef.current) {
      void stopMeeting();
    } else {
      void startMeeting();
    }
  }, [startMeeting, stopMeeting]);

  const toggleMic = useCallback(() => setMicMuted((m) => !m), []);

  // Cleanup on unmount: stop capture and abort pending work.
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      abortControllersRef.current.forEach((c) => c.abort());
      abortControllersRef.current.clear();
      invoke("stop_system_audio_capture").catch(() => {});
    };
  }, []);

  return {
    meetingId,
    segments,
    isMeetingActive,
    pendingCount,
    error,
    setError,
    startMeeting,
    stopMeeting,
    toggleMeeting,
    resumeMeeting,
    handleMicUtterance,
    micMuted,
    toggleMic,
    micDeviceId: selectedAudioDevices.input.id,
  };
}

export type UseMeetingTranscription = ReturnType<
  typeof useMeetingTranscription
>;
