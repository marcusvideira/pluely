import { useMicVAD } from "@ricky0123/vad-react";
import { floatArrayToWav } from "@/lib/utils";
import { getTranscriptionPauseMs } from "@/lib/storage";

interface MeetingMicVadProps {
  micDeviceId?: string;
  onUtterance: (audio: Blob) => void | Promise<void>;
}

// vad-web mic frame ≈ 1536 samples @ 16kHz ≈ 96ms.
const MIC_FRAME_MS = 96;

/**
 * Headless microphone capture for meeting transcription — mirrors the
 * "ask questions" mic feature (`AutoSpeechVad`): same `useMicVAD` config,
 * same `floatArrayToWav` conversion. Mounted only while a meeting is active;
 * unmounting tears down the VAD worklet (stops the mic).
 *
 * Keyed by device id by the parent so switching mics remounts cleanly.
 */
const MeetingMicVadInternal = ({
  micDeviceId,
  onUtterance,
}: MeetingMicVadProps) => {
  // End a mic clip after the configured "transcription pause" of silence.
  const redemptionFrames = Math.max(
    2,
    Math.round(getTranscriptionPauseMs() / MIC_FRAME_MS)
  );

  useMicVAD({
    userSpeakingThreshold: 0.6,
    startOnLoad: true,
    redemptionFrames,
    minSpeechFrames: 3,
    preSpeechPadFrames: 2,
    additionalAudioConstraints:
      micDeviceId && micDeviceId !== "default"
        ? { deviceId: { exact: micDeviceId } }
        : {},
    onSpeechEnd: (audio) => {
      const blob = floatArrayToWav(audio, 16000, "wav");
      void onUtterance(blob);
    },
  });

  return null;
};

export const MeetingMicVad = (props: MeetingMicVadProps) => {
  return <MeetingMicVadInternal key={props.micDeviceId} {...props} />;
};
