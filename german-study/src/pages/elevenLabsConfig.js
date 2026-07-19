export const ELEVENLABS_MODEL_ID = "eleven_v3";
export const ELEVENLABS_MODEL_NAME = "Eleven v3";
export const DEFAULT_VOICE_ID = "v3V1d2rk6528UrLKRuy8";

export const DEFAULT_VOICE = {
  voice_id: DEFAULT_VOICE_ID,
  name: "Susi - German",
  labels: {
    language: "de",
    locale: "de-DE",
    accent: "standard",
  },
};

export const V3_VOICE_SETTINGS = {
  stability: 0.5,
};

function voiceLanguage(voice) {
  return voice?.labels?.language || voice?.verified_languages?.[0]?.language || "";
}

export function sortVoicesForGerman(voices) {
  return [...voices].sort((a, b) => {
    if (a.voice_id === DEFAULT_VOICE_ID) return -1;
    if (b.voice_id === DEFAULT_VOICE_ID) return 1;

    const aGerman = voiceLanguage(a) === "de";
    const bGerman = voiceLanguage(b) === "de";
    if (aGerman !== bGerman) return aGerman ? -1 : 1;

    return (a.name || "").localeCompare(b.name || "");
  });
}

export function formatVoiceLabel(voice) {
  const language = voiceLanguage(voice);
  const locale = voice?.labels?.locale;
  const accent = voice?.labels?.accent || voice?.verified_languages?.[0]?.accent;
  const details = [locale || language, accent].filter(Boolean);
  return `${voice.name || voice.voice_id}${details.length ? ` — ${details.join(", ")}` : ""}`;
}

export function countGermanVoices(voices) {
  return voices.filter((voice) => voiceLanguage(voice) === "de").length;
}
