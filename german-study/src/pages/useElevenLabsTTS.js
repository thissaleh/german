import { useRef, useState } from "react";
import {
  countGermanVoices,
  DEFAULT_VOICE,
  DEFAULT_VOICE_ID,
  ELEVENLABS_MODEL_ID,
  sortVoicesForGerman,
  V3_VOICE_SETTINGS,
} from "./elevenLabsConfig";

export function useElevenLabsTTS() {
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_ELEVENLABS_API_KEY || "");
  const [voices, setVoices] = useState([DEFAULT_VOICE]);
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE_ID);
  const [voiceStatus, setVoiceStatus] = useState("");

  const currentAudioRef = useRef(null);

  function stopAudioOnly() {
    const a = currentAudioRef.current;
    if (a) {
      try {
        a.pause();
        a.currentTime = 0;
      } catch {
        // Audio may already be unavailable while the component is unmounting.
      }
      currentAudioRef.current = null;
    }
  }

  async function loadVoices() {
    const k = apiKey.trim();
    if (!k) return alert("Paste your ElevenLabs API key first.");

    setVoiceStatus("Loading…");
    try {
      const res = await fetch("https://api.elevenlabs.io/v2/voices?page_size=100", {
        method: "GET",
        headers: { "xi-api-key": k },
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(`${res.status} ${msg}`);
      }

      const data = await res.json();
      const list = sortVoicesForGerman(data.voices || []);
      setVoices(list.length ? list : [DEFAULT_VOICE]);

      const keep = list.some((v) => v.voice_id === voiceId);
      setVoiceId(keep ? voiceId : list[0]?.voice_id || DEFAULT_VOICE_ID);

      setVoiceStatus(`Loaded ${list.length} voices • German: ${countGermanVoices(list)}`);
    } catch (e) {
      setVoiceStatus("");
      alert("Failed to load voices: " + e.message);
    }
  }

  async function ttsStream(text, { languageCode = "de" } = {}) {
    const k = apiKey.trim();
    if (!k) {
      alert("Paste your ElevenLabs API key first.");
      return null;
    }

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;
    const body = {
      text,
      model_id: ELEVENLABS_MODEL_ID,
      language_code: languageCode,
      voice_settings: V3_VOICE_SETTINGS,
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

  function playAudioBlob(blob, speed = 1.0) {
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    a.playbackRate = Math.min(1.2, Math.max(0.7, Number(speed) || 1.0));
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
    const blob = await ttsStream(text, { languageCode });
    if (!blob) return;
    await playAudioBlob(blob, speed);
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
