import { useMemo, useRef, useState } from "react";

export function usePlaylistRunner({ playlist, playOne }) {
  const playlistRef = useRef([]);
  const currentIndexRef = useRef(-1);

  const shouldStopRef = useRef(false);
  const isRunningRef = useRef(false);
  const isPausedRef = useRef(false);

  const [nowText, setNowText] = useState("—");
  const [idxText, setIdxText] = useState("—");
  const [currentIndex, setCurrentIndex] = useState(-1);

  // keep ref in sync
  useMemo(() => {
    playlistRef.current = playlist || [];
    if (!playlistRef.current.length) {
      currentIndexRef.current = -1;
      setCurrentIndex(-1);
      setNowText("—");
      setIdxText("—");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlist]);

  function setStatus(text, idx) {
    setNowText(text || "—");
    setIdxText(idx >= 0 ? `${idx + 1}/${playlistRef.current.length}` : "—");
  }

  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function waitForResume() {
    return new Promise((resolve) => {
      const t = setInterval(() => {
        if (!isPausedRef.current) {
          clearInterval(t);
          resolve();
        }
      }, 100);
    });
  }

  function stopAll() {
    shouldStopRef.current = true;
    isRunningRef.current = false;
    isPausedRef.current = false;
    setStatus("—", -1);
    currentIndexRef.current = -1;
    setCurrentIndex(-1);
  }

  function togglePause() {
    isPausedRef.current = !isPausedRef.current;
    return isPausedRef.current;
  }

  async function playAll({ startAt = 0, loopMode = "none", delayMs = 0 } = {}) {
    if (!playlistRef.current.length) return alert("No words found.");

    shouldStopRef.current = false;
    isRunningRef.current = true;
    isPausedRef.current = false;

    if (currentIndexRef.current < 0) currentIndexRef.current = startAt;

    while (!shouldStopRef.current && isRunningRef.current) {
      if (currentIndexRef.current < 0) currentIndexRef.current = 0;

      if (currentIndexRef.current >= playlistRef.current.length) {
        if (loopMode === "all") currentIndexRef.current = 0;
        else break;
      }

      if (isPausedRef.current) await waitForResume();
      if (shouldStopRef.current) break;

      const idx = currentIndexRef.current;
      const item = playlistRef.current[idx];

      currentIndexRef.current = idx;
      setCurrentIndex(idx);
      setStatus(item.word ?? "—", idx);

      await playOne(item, idx);
      if (shouldStopRef.current) break;

      if (loopMode === "one") {
        // keep same
      } else {
        currentIndexRef.current++;
      }

      if (delayMs > 0) await wait(delayMs);
    }

    isRunningRef.current = false;
  }

  async function runFocus({
  startIndex = 0,
  repeatWord = 1,
  repeatList = 1, // -1 = infinite
  delayMs = 0,
  onDone,
  playOneOverride, // ✅ NEW
} = {}) {
  if (!playlistRef.current.length) return alert("No words found.");

  shouldStopRef.current = false;
  isRunningRef.current = true;
  isPausedRef.current = false;

  const total = playlistRef.current.length;
  const listRepeats = repeatList === -1 ? Number.POSITIVE_INFINITY : Math.max(1, repeatList);
  const wordRepeats = Math.max(1, repeatWord);

  let firstStart = Math.max(0, startIndex);

  const playFn = playOneOverride || playOne;

  for (let cycle = 0; cycle < listRepeats && !shouldStopRef.current; cycle++) {
    const startIdx = cycle === 0 ? firstStart : 0;

    for (let idx = startIdx; idx < total && !shouldStopRef.current; idx++) {
      if (isPausedRef.current) await waitForResume();
      if (shouldStopRef.current) break;

      const item = playlistRef.current[idx];

      for (let r = 0; r < wordRepeats && !shouldStopRef.current; r++) {
        currentIndexRef.current = idx;
        setCurrentIndex(idx);
        setStatus(item.word ?? "—", idx);

        await playFn(item, idx);
        if (shouldStopRef.current) break;

        if (wordRepeats > 1 && r < wordRepeats - 1) await wait(Math.min(250, delayMs));
      }

      if (delayMs > 0) await wait(delayMs);
    }

    if (!shouldStopRef.current && cycle < listRepeats - 1) await wait(Math.min(600, delayMs + 200));
  }

  isRunningRef.current = false;
  onDone?.();
}

  function setCurrentIndexManually(idx) {
    currentIndexRef.current = idx;
    setCurrentIndex(idx);
    setStatus(playlistRef.current[idx]?.word ?? "—", idx);
  }

  return {
    // state
    nowText, idxText, currentIndex,

    // refs helpers
    currentIndexRef,
    shouldStopRef,
    isPausedRef,

    // controls
    stopAll,
    togglePause,
    setCurrentIndexManually,

    // runners
    playAll,
    runFocus,
  };
}