import React from "react";
import { Link } from "react-router-dom";
import "./LearningWordsPage.css";
import "./RecordingFocusPage.css";
import {
  formatTrackDuration,
  RECORDING_FOCUS_TRACKS,
} from "./recordingFocusTracks";

export default function RecordingFocusListsPage() {
  return (
    <main className="recordingPage">
      <header className="recordingHeader">
        <div>
          <p className="recordingEyebrow">Synchronized listening practice</p>
          <h1>Recording Focus Lists</h1>
        </div>
        <nav className="recordingNav">
          <Link to="/learning"><button>Learning Words</button></Link>
          <Link to="/"><button>Study Page</button></Link>
        </nav>
      </header>

      <section className="recordingCatalogIntro">
        <span className="recordingBadge">Liam • Eleven v3</span>
        <h2>Choose a recording</h2>
        <p>
          Each list supports synchronized Focus Mode, English translations,
          individual pronunciation playback, and starting from any item.
        </p>
      </section>

      <section className="recordingCatalogGrid">
        {RECORDING_FOCUS_TRACKS.map((track) => (
          <article className="recordingCatalogCard" key={track.id}>
            <div className="recordingCatalogMeta">
              <span>{track.words.length} {track.itemLabel || "words"}</span>
              <span>{formatTrackDuration(track.duration)}</span>
            </div>
            <h2>{track.title}</h2>
            <p>{track.description}</p>

            <div className="recordingCatalogPreview">
              {track.words.slice(0, 6).map((item, index) => (
                <span key={`${item.word}-${index}`}>
                  {item.word}
                </span>
              ))}
              <span>+{track.words.length - 6}</span>
            </div>

            <Link className="recordingCatalogOpen" to={`/recording-focus/${track.id}`}>
              Open recording list
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
