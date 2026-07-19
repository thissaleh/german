import { useEffect, useMemo, useState } from "react";
import { useElevenLabsTTS } from "./useElevenLabsTTS";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { usePlaylistRunner } from "./usePlaylistRunner";
import { parseGermanStudyText } from "./parsers"; // adjust path


function parseOverrides(text) {
  const map = new Map();
  const lines = (text || "").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const k = line.slice(0, idx).trim().toLowerCase();
    const v = line.slice(idx + 1).trim();
    if (k && v) map.set(k, v);
  }
  return map;
}

export function useLearningWordsPlayer({ contentUrl = "/basics_01.txt" } = {}) {
  // settings
  const [speed, setSpeed] = useState(1.0);
  const [delaySec, setDelaySec] = useState(0.75);
  const [loopMode, setLoopMode] = useState("none");
  const [speakEnglish, setSpeakEnglish] = useState(true);

  const [repeatClickMode, setRepeatClickMode] = useState(false); // kept for UI
  const [autoScroll, setAutoScroll] = useState(true);
  const [scrollBehavior, setScrollBehavior] = useState("smooth");

  const [focusRepeatWord, setFocusRepeatWord] = useState(1);
  const [focusRepeatList, setFocusRepeatList] = useState(1); // -1 infinite

  const [focusMode, setFocusMode] = useState(false);
  const [focusAnimKey, setFocusAnimKey] = useState(0);

  // pronunciation overrides (editable)
  const [pronOverridesText, setPronOverridesText] = useState(
    "# Add overrides for tricky words (format: word=alias)\n" +
      "ich=ikh\n" +
      "sie=zee\n" +
      "für=fyur\n"
  );
  const overridesMap = useMemo(() => parseOverrides(pronOverridesText), [pronOverridesText]);

  // content
  const [content, setContent] = useState("");

  // TTS
  const tts = useElevenLabsTTS();

  // load content
  useEffect(() => {
    let alive = true;
    fetch(contentUrl, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then((t) => {
        if (alive) setContent(t);
      })
      .catch((e) => console.warn(`Failed to load ${contentUrl}:`, e.message));
    return () => {
      alive = false;
    };
  }, [contentUrl]);

  // parse playlist
  function parseWordsOnly(text) {
    const headerRe = /^(\d+)\.\s*(.+?)\s*[–—-]\s*(.+)$/;
    const lines = (text || "").split("\n").map((x) => x.trim()).filter(Boolean);

    const items = [];
    for (const line of lines) {
      const m = line.match(headerRe);
      if (m) items.push({ num: m[1], word: m[2], meaning: m[3] });
    }
    return items;
  }

const playlist = useMemo(() => {
  const items = parseGermanStudyText(content);

  // For LearningWords, make list from item "word/meaning"
  return items.map((it) => ({
    key: `w_${it.num}_${it.word}`,
    num: it.num,
    word: it.word,
    meaning: it.meaning,
  }));
}, [content]);

  const delayMs = useMemo(() => Math.max(0, Number(delaySec) || 0) * 1000, [delaySec]);

  // ✅ Removed "Deutsch:" completely (no prefix)
  function applyGermanPrefix(text, { isFocus } = {}) {
    return text;
  }

  function aliasForWord(word) {
    const k = (word || "").trim().toLowerCase();
    return overridesMap.get(k) || null;
  }

  // play one item:
  // - German word: languageCode=de + override alias (EVERYWHERE)
  // - English meaning (if enabled): languageCode=en
  async function playOne(item, idx, { isFocus = false } = {}) {
    setFocusAnimKey((x) => x + 1);

    const originalWord = item.word || "";
    const alias = aliasForWord(originalWord);
    const spokenWord = alias || originalWord;

    await tts.playText(applyGermanPrefix(spokenWord, { isFocus }), { speed, languageCode: "de" });
    if (runner.shouldStopRef.current) return;

    if (speakEnglish && item.meaning) {
      await new Promise((r) => setTimeout(r, Math.min(300, delayMs)));
      await tts.playText(item.meaning, { speed, languageCode: "en" });
    }
  }

  // playlist runner
  const runner = usePlaylistRunner({
    playlist,
    playOne: (item, idx) => playOne(item, idx, { isFocus: false }),
  });

  const currentItem = useMemo(() => {
    if (runner.currentIndex >= 0 && runner.currentIndex < playlist.length) return playlist[runner.currentIndex];
    return null;
  }, [runner.currentIndex, playlist]);

  // scroll highlight (disabled in focus mode)
  useEffect(() => {
    if (focusMode) return;
    if (!autoScroll) return;
    if (runner.currentIndex < 0) return;
    const el = document.querySelector(`[data-idx="${runner.currentIndex}"]`);
    if (el) el.scrollIntoView({ behavior: scrollBehavior, block: "center" });
  }, [runner.currentIndex, autoScroll, scrollBehavior, focusMode]);

  function togglePause() {
    const paused = runner.togglePause();
    tts.togglePauseAudio(paused);
  }

  function stopAll() {
    runner.stopAll();
    tts.stopAudioOnly();
  }

  async function startFocusMode() {
    if (!playlist.length) return alert("No words found.");
    setFocusMode(true);

    const startIndex = runner.currentIndex >= 0 ? runner.currentIndex : 0;

    await runner.runFocus({
      startIndex,
      repeatWord: focusRepeatWord,
      repeatList: focusRepeatList,
      delayMs,
      onDone: () => setFocusMode(false),
      playOneOverride: (item, idx) => playOne(item, idx, { isFocus: true }),
    });

    setFocusMode(false);
  }

  function exitFocusMode() {
    stopAll();
    setFocusMode(false);
  }

  useKeyboardShortcuts({
    enabled: focusMode,
    onTogglePause: togglePause,
    onExit: exitFocusMode,
  });

  async function onRowClick(item, idx) {
    stopAll();
    runner.shouldStopRef.current = false;
    runner.setCurrentIndexManually(idx);
    await playOne(item, idx, { isFocus: false });
  }

  return {
    // tts
    apiKey: tts.apiKey,
    setApiKey: tts.setApiKey,
    voices: tts.voices,
    voiceId: tts.voiceId,
    setVoiceId: tts.setVoiceId,
    voiceStatus: tts.voiceStatus,
    loadVoices: tts.loadVoices,

    // settings
    speed,
    setSpeed,
    delaySec,
    setDelaySec,
    loopMode,
    setLoopMode,
    speakEnglish,
    setSpeakEnglish,
    repeatClickMode,
    setRepeatClickMode,
    autoScroll,
    setAutoScroll,
    scrollBehavior,
    setScrollBehavior,

    focusRepeatWord,
    setFocusRepeatWord,
    focusRepeatList,
    setFocusRepeatList,

    // pronunciation overrides
    pronOverridesText,
    setPronOverridesText,

    // state
    nowText: runner.nowText,
    idxText: runner.idxText,
    currentIndex: runner.currentIndex,
    currentItem,
    playlist,

    focusMode,
    focusAnimKey,

    // actions
    playAll: (startAt = 0) => runner.playAll({ startAt, loopMode, delayMs }),
    startFocusMode,
    togglePause,
    exitFocusMode,
    stopAll,

    onRowClick,
  };
}