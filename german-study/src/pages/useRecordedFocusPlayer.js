import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

export function useRecordedFocusPlayer({ track, playbackRate = 1 }) {
  const audioRef = useRef(null);
  const timerRef = useRef(null);

  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopAudio = useCallback(() => {
    stopTimer();
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    }
  }, [stopTimer]);

  const exit = useCallback(() => {
    stopAudio();
    setActive(false);
    setPaused(false);
    setCurrentIndex(0);
    setElapsed(0);
  }, [stopAudio]);

  const updateFromAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const time = audio.currentTime;
    let index = 0;

    for (let i = 1; i < track.words.length; i++) {
      if (track.words[i].start > time) break;
      index = i;
    }

    setElapsed(time);
    setCurrentIndex(index);

  }, [track]);

  const startTimer = useCallback(() => {
    stopTimer();
    updateFromAudio();
    timerRef.current = setInterval(updateFromAudio, 30);
  }, [stopTimer, updateFromAudio]);

  const start = useCallback(async (startIndex = 0) => {
    stopAudio();

    const safeIndex = Math.min(
      track.words.length - 1,
      Math.max(0, Number(startIndex) || 0),
    );
    const startTime = track.words[safeIndex].start;
    const audio = new Audio(track.audioUrl);
    audio.preload = "auto";
    audio.playbackRate = Math.min(1.2, Math.max(0.7, Number(playbackRate) || 1));
    audio.currentTime = startTime;
    audioRef.current = audio;

    setActive(true);
    setPaused(false);
    setCurrentIndex(safeIndex);
    setElapsed(startTime);

    audio.addEventListener(
      "ended",
      () => {
        stopTimer();
        setElapsed(track.duration);
        setCurrentIndex(track.words.length - 1);
        setActive(false);
        setPaused(false);
        audioRef.current = null;
      },
      { once: true },
    );

    try {
      await audio.play();
      startTimer();
    } catch (error) {
      exit();
      alert(`Could not play the Liam recording: ${error.message}`);
    }
  }, [exit, playbackRate, startTimer, stopAudio, stopTimer, track]);

  const togglePause = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
        setPaused(false);
        startTimer();
      } catch (error) {
        alert(`Could not resume the Liam recording: ${error.message}`);
      }
    } else {
      audio.pause();
      stopTimer();
      setPaused(true);
    }
  }, [startTimer, stopTimer]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = Math.min(1.2, Math.max(0.7, Number(playbackRate) || 1));
    }
  }, [playbackRate]);

  useEffect(() => stopAudio, [stopAudio]);

  useKeyboardShortcuts({
    enabled: active,
    onTogglePause: togglePause,
    onExit: exit,
  });

  const currentItem = track.words[currentIndex] || track.words[0];
  const progress = Math.min(100, (elapsed / track.duration) * 100);
  const idxText = `${currentIndex + 1}/${track.words.length}`;
  const isSpeaking = elapsed >= currentItem.start && elapsed <= currentItem.end;

  return useMemo(
    () => ({
      active,
      paused,
      currentItem,
      currentIndex,
      elapsed,
      progress,
      idxText,
      isSpeaking,
      total: track.words.length,
      trackName: track.name,
      start,
      track,
      togglePause,
      exit,
    }),
    [
      active,
      currentIndex,
      currentItem,
      elapsed,
      exit,
      idxText,
      isSpeaking,
      paused,
      progress,
      start,
      track,
      togglePause,
    ],
  );
}
