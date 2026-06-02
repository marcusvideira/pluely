// Input languages for speech-to-text. `code` is the ISO-639-1 language code
// that Whisper-style STT APIs (OpenAI, Groq) accept via the `language` field.
// Forcing the language fixes wrong-language detection on short clips.
export interface SttLanguage {
  code: string;
  label: string;
}

export const STT_LANGUAGES: SttLanguage[] = [
  { code: "pt", label: "Português (PT-BR)" },
  { code: "en", label: "English (EN-US)" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "nl", label: "Nederlands" },
  { code: "ja", label: "日本語 (Japanese)" },
  { code: "zh", label: "中文 (Chinese)" },
  { code: "ko", label: "한국어 (Korean)" },
  { code: "ru", label: "Русский (Russian)" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "ar", label: "العربية (Arabic)" },
];
