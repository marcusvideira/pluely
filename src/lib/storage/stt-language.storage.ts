import { STORAGE_KEYS } from "@/config";
import { safeLocalStorage } from "./helper";

/**
 * Selected speech-to-text input language codes (ISO-639-1, e.g. ["pt","en"]).
 * Empty array = auto-detect (the STT provider decides).
 */
export const getSttInputLanguages = (): string[] => {
  try {
    const raw = safeLocalStorage.getItem(STORAGE_KEYS.STT_INPUT_LANGUAGES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c): c is string => typeof c === "string");
  } catch {
    return [];
  }
};

export const setSttInputLanguages = (codes: string[]): void => {
  safeLocalStorage.setItem(
    STORAGE_KEYS.STT_INPUT_LANGUAGES,
    JSON.stringify(codes)
  );
};

/**
 * The language code to force on an STT request, or null for auto-detect.
 * Whisper transcribes one language per clip, so when several are selected the
 * first (primary) is used.
 */
export const getPrimarySttLanguage = (): string | null => {
  const codes = getSttInputLanguages();
  return codes.length > 0 ? codes[0] : null;
};
