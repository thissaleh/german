import { useEffect, useMemo, useState } from "react";
import { useElevenLabsTTS } from "./useElevenLabsTTS";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { usePlaylistRunner } from "./usePlaylistRunner";
import { parseGermanStudyText } from "./parsers"; // adjust path

export function useLearningWordsPlayer({ contentUrl = "/german_phrases_01.txt" } = {}) {
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

  // play one item:
  // - German word: Eleven v3 with German language override
  // - English meaning (if enabled): languageCode=en
  async function playOne(item) {
    setFocusAnimKey((x) => x + 1);

    await tts.playText(item.word || "", { speed, languageCode: "de" });
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
