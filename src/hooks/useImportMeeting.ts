import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/contexts";
import { fetchSTT } from "@/lib/functions/stt.function";
import {
  createMeeting,
  addSegment,
  generateMeetingId,
  deleteMeeting,
} from "@/lib/database";
import { decodeAndResampleAudio, chunkFloat32ToWavBlobs } from "@/lib/utils";
import { TranscriptSegment } from "@/types";

const STT_SAMPLE_RATE = 16000;
// 10-minute chunks at 16kHz mono 16-bit ≈ 19.2MB (under Whisper's 25MB limit)
const CHUNK_DURATION_SEC = 600;

const newSegmentId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `seg_${Date.now()}_${Math.random().toString(36).slice(2)}`;

export function useImportMeeting(onComplete?: (meetingId: string) => void) {
  const { selectedSttProvider, allSttProviders } = useApp();
  const navigate = useNavigate();

  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({
    current: 0,
    total: 0,
  });
  const [error, setError] = useState("");

  const importFile = useCallback(
    async (file: File) => {
      setError("");

      const providerConfig = allSttProviders.find(
        (p) => p.id === selectedSttProvider.provider
      );
      if (!selectedSttProvider.provider || !providerConfig) {
        setError(
          "No speech-to-text provider selected. Configure one in App Settings → Audio."
        );
        return;
      }

      setIsImporting(true);
      let meetingId = "";

      try {
        const arrayBuffer = await file.arrayBuffer();

        let decoded: { data: Float32Array; sampleRate: number };
        try {
          decoded = await decodeAndResampleAudio(arrayBuffer, STT_SAMPLE_RATE);
        } catch {
          throw new Error(
            "Could not decode audio. Make sure the file is a supported audio or video format."
          );
        }

        const chunkSamples = STT_SAMPLE_RATE * CHUNK_DURATION_SEC;
        const chunks = chunkFloat32ToWavBlobs(
          decoded.data,
          decoded.sampleRate,
          chunkSamples
        );

        setImportProgress({ current: 0, total: chunks.length });

        meetingId = generateMeetingId();
        const now = Date.now();
        const rawName = file.name.replace(/\.[^.]+$/, "").trim();
        const title = rawName || `Import ${new Date(now).toLocaleString()}`;

        await createMeeting({
          id: meetingId,
          title,
          createdAt: now,
          updatedAt: now,
        });

        const totalDurationMs =
          (decoded.data.length / decoded.sampleRate) * 1000;
        const chunkDurationMs = totalDurationMs / chunks.length;

        for (let i = 0; i < chunks.length; i++) {
          setImportProgress({ current: i + 1, total: chunks.length });

          try {
            const text = await fetchSTT({
              provider: providerConfig,
              selectedProvider: selectedSttProvider,
              audio: chunks[i],
            });

            const cleaned = (text || "").trim();
            if (
              cleaned &&
              cleaned.toLowerCase() !== "no transcription found"
            ) {
              const segStart = now + Math.floor(i * chunkDurationMs);
              const segment: TranscriptSegment = {
                id: newSegmentId(),
                meetingId,
                source: "others",
                text: cleaned,
                timestamp: segStart,
                lastAt: segStart + Math.floor(chunkDurationMs),
              };
              await addSegment(segment);
            }
          } catch (e) {
            console.error(`Chunk ${i + 1}/${chunks.length} failed:`, e);
          }
        }

        if (onComplete) {
          onComplete(meetingId);
        } else {
          navigate(`/meetings/view/${meetingId}`);
        }
      } catch (e) {
        if (meetingId) {
          await deleteMeeting(meetingId).catch(() => {});
        }
        setError(e instanceof Error ? e.message : "Import failed");
      } finally {
        setIsImporting(false);
        setImportProgress({ current: 0, total: 0 });
      }
    },
    [allSttProviders, selectedSttProvider, navigate]
  );

  return {
    importFile,
    isImporting,
    importProgress,
    error,
    setError,
  };
}
