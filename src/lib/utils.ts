import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const floatArrayToWav = (
  audioData: Float32Array,
  sampleRate: number = 16000,
  format: "wav" | "mp3" | "ogg" = "wav"
): Blob => {
  const buffer = new ArrayBuffer(44 + audioData.length * 2);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  const dataSize =
    format === "wav" ? 36 + audioData.length * 2 : 44 + audioData.length * 2;
  view.setUint32(4, dataSize, true);
  writeString(8, format === "wav" ? "WAVE" : "FORM");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, audioData.length * 2, true);

  // Convert float samples to 16-bit PCM
  let offset = 44;
  for (let i = 0; i < audioData.length; i++) {
    const sample = Math.max(-1, Math.min(1, audioData[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: `audio/${format}` });
};

/**
 * Duration (ms) of a PCM WAV blob, read from its header (sample rate, channels,
 * bits) and data size. Used to estimate when a clip's speech started.
 */
export const wavDurationMs = async (blob: Blob): Promise<number> => {
  try {
    const buf = await blob.arrayBuffer();
    if (buf.byteLength < 44) return 0;
    const view = new DataView(buf);
    const channels = view.getUint16(22, true) || 1;
    const sampleRate = view.getUint32(24, true) || 16000;
    const bitsPerSample = view.getUint16(34, true) || 16;
    const bytesPerSample = Math.max(1, bitsPerSample / 8);
    const dataBytes = buf.byteLength - 44;
    const frames = dataBytes / (bytesPerSample * channels);
    return (frames / sampleRate) * 1000;
  } catch {
    return 0;
  }
};

// Shared AudioContext for decoding (lazily created)
let _decodeAudioCtx: AudioContext | null = null;
const getDecodeAudioCtx = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  if (!_decodeAudioCtx) _decodeAudioCtx = new Ctx();
  return _decodeAudioCtx;
};

/**
 * Decode an ArrayBuffer containing audio or video data and resample to a
 * target sample rate, returning a mono Float32Array.
 * Uses OfflineAudioContext for high-quality resampling when needed.
 */
export const decodeAndResampleAudio = async (
  arrayBuffer: ArrayBuffer,
  targetSampleRate: number = 16000
): Promise<{ data: Float32Array; sampleRate: number }> => {
  const ctx = new AudioContext();
  const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  await ctx.close();

  if (buffer.sampleRate === targetSampleRate) {
    return { data: buffer.getChannelData(0), sampleRate: targetSampleRate };
  }

  const outputLength = Math.ceil(buffer.duration * targetSampleRate);
  const offlineCtx = new OfflineAudioContext(1, outputLength, targetSampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(offlineCtx.destination);
  source.start(0);
  const resampled = await offlineCtx.startRendering();
  return { data: resampled.getChannelData(0), sampleRate: targetSampleRate };
};

/**
 * Split a Float32Array of mono audio data into WAV Blob chunks.
 * Each chunk is `chunkSamples` samples long (except possibly the last).
 */
export const chunkFloat32ToWavBlobs = (
  audioData: Float32Array,
  sampleRate: number,
  chunkSamples: number
): Blob[] => {
  const chunks: Blob[] = [];
  for (let offset = 0; offset < audioData.length; offset += chunkSamples) {
    const end = Math.min(offset + chunkSamples, audioData.length);
    chunks.push(floatArrayToWav(audioData.slice(offset, end), sampleRate));
  }
  return chunks;
};

/**
 * Time-compress a mono WAV blob so it plays `factor`x faster (e.g. 1.5x).
 * Shorter audio = faster + cheaper speech-to-text. Pitch rises with speed
 * (no pitch correction), which Whisper-class models tolerate well.
 * Falls back to the original blob on any failure.
 */
export const speedUpWav = async (
  blob: Blob,
  factor: number = 1.5
): Promise<Blob> => {
  if (factor <= 1) return blob;
  try {
    const ctx = getDecodeAudioCtx();
    if (!ctx) return blob;

    const arrayBuf = await blob.arrayBuffer();
    const audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0));
    const input = audioBuf.getChannelData(0);
    const sr = audioBuf.sampleRate;

    const outLen = Math.floor(input.length / factor);
    if (outLen < 1) return blob;

    const output = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const pos = i * factor;
      const idx = Math.floor(pos);
      const frac = pos - idx;
      const a = input[idx] ?? 0;
      const b = input[idx + 1] ?? a;
      output[i] = a + (b - a) * frac; // linear interpolation
    }

    return floatArrayToWav(output, sr, "wav");
  } catch (e) {
    console.warn("speedUpWav failed; sending original audio:", e);
    return blob;
  }
};
