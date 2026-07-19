import { useEffect } from "react";

export function useKeyboardShortcuts({ enabled, onTogglePause, onExit }) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e) => {
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        onTogglePause?.();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onExit?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, onTogglePause, onExit]);
}