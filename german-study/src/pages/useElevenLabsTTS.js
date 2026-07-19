import { useRef, useState } from "react";

const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";

export function useElevenLabsTTS() {
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_ELEVENLABS_API_KEY || "");
  const [voices, setVoices] = useState([{ voice_id: DEFAULT_VOICE, name: "Default" }]);
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE);
  const [voiceStatus, setVoiceStatus] = useState("");

  const currentAudioRef = useRef(null);

  function stopAudioOnly() {
    const a = currentAudioRef.current;
    if (a) {
      try {
        a.pause();
        a.currentTime = 0;
      } catch {}
      currentAudioRef.current = null;
    }
  }

  async function loadVoices() {
    const k = apiKey.trim();
    if (!k) return alert("Paste your ElevenLabs API key first.");

    setVoiceStatus("Loading…");
    try {
      const res = await fetch("https://api.elevenlabs.io/v1/voices", {
        method: "GET",
        headers: { "xi-api-key": k },
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(`${res.status} ${msg}`);
      }

      const data = await res.json();
      const list = data.voices || [];
      setVoices(list.length ? list : [{ voice_id: DEFAULT_VOICE, name: "Default" }]);

      const keep = list.some((v) => v.voice_id === voiceId);
      setVoiceId(keep ? voiceId : list[0]?.voice_id || DEFAULT_VOICE);

      setVoiceStatus(`Loaded ${list.length} voice(s).`);
    } catch (e) {
      setVoiceStatus("");
      alert("Failed to load voices: " + e.message);
    }
  }

  async function ttsStream(text, { speed = 1.0, languageCode = "de" } = {}) {
    const k = apiKey.trim();
    if (!k) {
      alert("Paste your ElevenLabs API key first.");
      return null;
    }

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;
    const body = {
      text,
      model_id: "eleven_multilingual_v2",
      language_code: languageCode, // ✅ FORCE German
      voice_settings: { stability: 0.35, similarity_boost: 0.85, speed: Number(speed) || 1.0 },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "xi-api-key": k, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      alert("TTS failed: " + res.status + " " + msg);
      return null;
    }

    return await res.blob();
  }

  function playAudioBlob(blob) {
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    currentAudioRef.current = a;

    return new Promise((resolve) => {
      const ended = () => {
        a.removeEventListener("ended", ended);
        resolve();
      };
      a.addEventListener("ended", ended);
      a.play().catch(() => resolve());
    });
  }

  async function playText(text, { speed = 1.0, languageCode = "de" } = {}) {
    stopAudioOnly();
    const blob = await ttsStream(text, { speed, languageCode });
    if (!blob) return;
    await playAudioBlob(blob);
  }

  function togglePauseAudio(isPaused) {
    const a = currentAudioRef.current;
    if (!a) return;
    if (isPaused) a.pause();
    else a.play().catch(() => {});
  }

  return {
    apiKey,
    setApiKey,
    voices,
    voiceId,
    setVoiceId,
    voiceStatus,
    loadVoices,
    playText,
    stopAudioOnly,
    togglePauseAudio,
  };
}