import React, { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import "./LearningWordsPage.css";
import "./RecordingFocusPage.css";
import {
  formatTrackDuration,
  getRecordingFocusTrack,
  RECORDING_FOCUS_TRACKS,
} from "./recordingFocusTracks";
import { useRecordedFocusPlayer } from "./useRecordedFocusPlayer";
import { useRecordedWordPreview } from "./useRecordedWordPreview";

export default function RecordingFocusPage() {
  const { trackId } = useParams();
  const requestedTrack = getRecordingFocusTrack(trackId);
  const track = requestedTrack || RECORDING_FOCUS_TRACKS[0];
  const itemLabel = track.itemLabel || "words";
  const itemSingular = track.itemSingular || "word";
  const [playbackRate, setPlaybackRate] = useState(1);
  const recorded = useRecordedFocusPlayer({ track, playbackRate });
  const preview = useRecordedWordPreview({ track, playbackRate });

  if (!requestedTrack) {
    return <Navigate to="/recording-focus" replace />;
  }

  if (recorded.active) {
    return (
      <div className="focusOverlay">
        <div className="focusStage">
          <div className="ring" />

          <div className="focusCard" key={recorded.currentIndex}>
            <div className="focusTop">
              <div className="focusPill">
                Recorded Liam • {recorded.idxText} • {recorded.paused ? "Paused" : "Playing"}
              </div>
              <div className="focusBar">
                <div className="focusBarFill" style={{ width: `${recorded.progress}%` }} />
              </div>
            </div>

            <div className="focusText">
              <div className={`focusDE${recorded.isSpeaking ? " recordedSpeaking" : ""}`}>
                {recorded.currentItem.word}
              </div>
              <div className="focusEN">{recorded.currentItem.meaning}</div>
              <div className="recordingTime">
                {recorded.trackName} • {recorded.elapsed.toFixed(1)}s
              </div>
            </div>
          </div>

          <div className="focusControls">
            <button onClick={recorded.togglePause}>
              {recorded.paused ? "Resume" : "Pause"}
            </button>
            <button onClick={recorded.exit}>Stop</button>
            <button onClick={recorded.exit}>Exit</button>
          </div>

          <div className="focusHint">
            German {itemSingular} + English meaning • <b>Space</b> Pause/Resume • <b>Esc</b> Exit
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="recordingPage">
      <header className="recordingHeader">
        <div>
          <p className="recordingEyebrow">Synchronized listening practice</p>
          <h1>{track.title}</h1>
        </div>
        <nav className="recordingNav">
          <Link to="/recording-focus"><button>All Recording Lists</button></Link>
          <Link to="/learning"><button>Learning Words</button></Link>
          <Link to="/"><button>Study Page</button></Link>
        </nav>
      </header>

      <section className="recordingHero">
        <div>
          <span className="recordingBadge">Eleven v3 • Original recording</span>
          <h2>{track.title}</h2>
          <p>
            Follow {recorded.total} German {itemLabel} with their English meanings,
            synchronized to Liam’s original {formatTrackDuration(track.duration)} recording.
          </p>
        </div>

        <div className="recordingActions">
          <label htmlFor="recording-speed">
            Playback speed <strong>{playbackRate.toFixed(2)}x</strong>
          </label>
          <input
            id="recording-speed"
            type="range"
            min="0.7"
            max="1.2"
            step="0.05"
            value={playbackRate}
            onChange={(event) => setPlaybackRate(Number(event.target.value))}
          />
          <button
            className="recordingStart"
            onClick={() => {
              preview.stop();
              recorded.start(0);
            }}
          >
            Start Recording Focus
          </button>
        </div>
      </section>

      <section className="recordingListSection">
        <div className="recordingListHeading">
          <div>
            <p className="recordingEyebrow">Track contents</p>
            <h2>{recorded.total} {itemLabel} with translations</h2>
          </div>
          <p>Click a {itemSingular} to hear it alone, or choose “Focus from here” to continue through the track.</p>
        </div>

        <div className="recordingWordGrid">
          {track.words.map((item, index) => (
            <div
              className={`recordingWordCard${preview.playingIndex === index ? " isPlaying" : ""}`}
              key={`${item.word}-${index}`}
            >
              <button
                className="recordingWord"
                onClick={() => preview.play(index)}
                aria-label={`${preview.playingIndex === index ? "Stop" : "Play"} ${item.word}`}
              >
                <span className="recordingWordNumber">{index + 1}</span>
                <span className="recordingWordText">
                  <strong>{item.word}</strong>
                  <small>{item.meaning}</small>
                </span>
                <span className="recordingPlayIcon" aria-hidden="true">
                  {preview.playingIndex === index ? "■" : "▶"}
                </span>
              </button>
              <button
                className="recordingFromHere"
                onClick={() => {
                  preview.stop();
                  recorded.start(index);
                }}
              >
                Focus from here
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
