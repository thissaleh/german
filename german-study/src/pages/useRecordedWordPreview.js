import { useCallback, useEffect, useRef, useState } from "react";

export function useRecordedWordPreview({ track, playbackRate = 1 }) {
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const [playingIndex, setPlayingIndex] = useState(null);

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audioRef.current = null;
    }

    setPlayingIndex(null);
  }, []);

  const play = useCallback(async (index) => {
    if (playingIndex === index) {
      stop();
      return;
    }

    stop();

    const item = track.words[index];
    if (!item) return;

    const audio = new Audio(track.audioUrl);
    const startAt = Math.max(0, item.start - 0.05);
    const nextItem = track.words[index + 1];
    const nextBoundary = nextItem
      ? Math.max(item.end, nextItem.start - 0.02)
      : track.duration;
    const stopAt = Math.min(track.duration, item.end + 0.12, nextBoundary);

    audio.preload = "auto";
    audio.playbackRate = Math.min(1.2, Math.max(0.7, Number(playbackRate) || 1));
    audio.currentTime = startAt;
    audioRef.current = audio;
    setPlayingIndex(index);

    try {
      await audio.play();
      timerRef.current = setInterval(() => {
        if (!audioRef.current || audio.currentTime >= stopAt || audio.ended) {
          stop();
        }
      }, 25);
    } catch (error) {
      stop();
      alert(`Could not play this word: ${error.message}`);
    }
  }, [playbackRate, playingIndex, stop, track]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = Math.min(1.2, Math.max(0.7, Number(playbackRate) || 1));
    }
  }, [playbackRate]);

  useEffect(() => stop, [stop]);

  return {
    playingIndex,
    play,
    stop,
  };
}
