import React from "react";
import { Link } from "react-router-dom";
import "./LearningWordsPage.css";
import { useLearningWordsPlayer } from "./useLearningWordsPlayer";

export default function LearningWordsPage() {
  const p = useLearningWordsPlayer({ contentUrl: "/basics_01.txt" });

  // Focus overlay UI
  if (p.focusMode) {
    const total = p.playlist.length || 1;
    const progress = p.currentIndex >= 0 ? Math.round(((p.currentIndex + 1) / total) * 100) : 0;

    return (
      <div className="focusOverlay">
        <div className="focusStage">
          <div className="ring" />

          <div className="focusCard" key={p.focusAnimKey}>
            <div className="focusTop">
              <div className="focusPill">
                Focus Mode • {p.idxText} • word×{p.focusRepeatWord} • list×{p.focusRepeatList === -1 ? "∞" : p.focusRepeatList}
              </div>
              <div className="focusBar">
                <div className="focusBarFill" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="focusText">
              <div className="focusDE">{p.currentItem?.word || "—"}</div>
              <div className="focusEN">{p.currentItem?.meaning || "—"}</div>
            </div>
          </div>

          <div className="focusControls">
            <button onClick={p.togglePause}>Pause/Resume</button>
            <button onClick={() => { p.stopAll(); p.exitFocusMode(); }}>Stop</button>
            <button onClick={p.exitFocusMode}>Exit</button>
          </div>

          <div className="focusHint">
            Press <b>Space</b> to Pause/Resume • <b>Esc</b> to Exit
          </div>
        </div>
      </div>
    );
  }

  // Normal page UI
  return (
    <div className="page">
      <div className="topRow">
        <h2 style={{ margin: 0 }}>Learning Words (Big Card)</h2>
        <Link to="/"><button>Back to Study Page</button></Link>
      </div>

      <div className="layout">
        {/* LEFT */}
        <div className="left">
          <label>ElevenLabs API Key:</label>
          <input value={p.apiKey} onChange={(e) => p.setApiKey(e.target.value)} type="password" />

          <div className="grid2">
            <div>
              <label>Voice:</label>
              <select value={p.voiceId} onChange={(e) => p.setVoiceId(e.target.value)}>
                {p.voices.map((v) => (
                  <option key={v.voice_id} value={v.voice_id}>
                    {v.name || v.voice_id}
                  </option>
                ))}
              </select>
              <small>{p.voiceStatus}</small>
            </div>
            <div>
              <button onClick={p.loadVoices}>Load voices</button>
            </div>
          </div>

          <div className="grid3">
            <div>
              <label>Speed: <b>{p.speed.toFixed(2)}x</b></label>
              <input
                type="range"
                min="0.7"
                max="1.2"
                step="0.05"
                value={p.speed}
                onChange={(e) => p.setSpeed(Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label>Delay (seconds):</label>
              <input
                type="number"
                min="0"
                step="0.05"
                value={p.delaySec}
                onChange={(e) => p.setDelaySec(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label>Loop mode:</label>
              <select value={p.loopMode} onChange={(e) => p.setLoopMode(e.target.value)} style={{ width: "100%" }}>
                <option value="none">No loop</option>
                <option value="all">Loop all</option>
                <option value="one">Repeat current</option>
              </select>
            </div>
          </div>

          <div className="stickyBar">
            <div className="controls">
              <button onClick={() => p.playAll(0)} disabled={!p.playlist.length}>Play All</button>

              <label>
                <input type="checkbox" checked={p.speakEnglish} onChange={(e) => p.setSpeakEnglish(e.target.checked)} />
                Speak English (meaning)
              </label>

              <label>
                <input type="checkbox" checked={p.repeatClickMode} onChange={(e) => p.setRepeatClickMode(e.target.checked)} />
                Repeat clicked item
              </label>

              <label>
                <input type="checkbox" checked={p.autoScroll} onChange={(e) => p.setAutoScroll(e.target.checked)} />
                Auto-scroll
              </label>

              <label>
                Scroll:
                <select value={p.scrollBehavior} onChange={(e) => p.setScrollBehavior(e.target.value)}>
                  <option value="smooth">Smooth</option>
                  <option value="auto">Instant</option>
                </select>
              </label>

              <label>
                Focus: word×
                <select value={p.focusRepeatWord} onChange={(e) => p.setFocusRepeatWord(Number(e.target.value))}>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </label>

              <label>
                Focus: list×
                <select
                  value={p.focusRepeatList}
                  onChange={(e) => p.setFocusRepeatList(e.target.value === "-1" ? -1 : Number(e.target.value))}
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={-1}>∞</option>
                </select>
              </label>

              <button onClick={p.startFocusMode} disabled={!p.playlist.length}>Focus Mode</button>
            </div>

            <div className="status">
              <div>Now: <b>{p.nowText}</b></div>
              <div>Index: <b>{p.idxText}</b></div>
            </div>
          </div>

          <div className="list">
            {p.playlist.map((it, i) => (
              <div
                key={it.key}
                data-idx={i}
                className={`row${i === p.currentIndex ? " now" : ""}`}
                onClick={() => p.onRowClick(it, i)}
              >
                <span><b>{it.num}. {it.word}</b> — {it.meaning}</span>
                <span style={{ color: "#666" }}>{i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT */}
        <div className="right">
          <div className="bigCard">
            <div className="badge">
              <span>Word</span>
              <span style={{ color: "#9ca3af" }}>•</span>
              <span>{p.idxText === "—" ? "—" : p.idxText}</span>
            </div>

            <p className="deWord">{p.currentItem?.word || "—"}</p>
            <p className="enWord">{p.currentItem?.meaning || "—"}</p>

            <div className="hint">
              Tip: Focus Mode supports repeating each word and/or the full list.
            </div>
          </div>

          <div className="rightActions">
            <button onClick={p.prevItem}>Prev</button>
            <button onClick={() => p.playAll(p.currentIndex >= 0 ? p.currentIndex : 0)} disabled={!p.playlist.length}>
              Play from here
            </button>
            <button onClick={p.nextItem}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}