import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { parseGermanStudyText } from "./parsers"; // adjust path
import { PHRASE_LISTS, usePhraseListSelection } from "./phraseLists";
import {
  countGermanVoices,
  DEFAULT_VOICE,
  DEFAULT_VOICE_ID,
  ELEVENLABS_MODEL_ID,
  ELEVENLABS_MODEL_NAME,
  formatVoiceLabel,
  sortVoicesForGerman,
  V3_VOICE_SETTINGS,
} from "./elevenLabsConfig";

const DEFAULT_TEXT = `1. Ich – I
Mein Name ist Joachim und ich komme aus Berlin.
My name is Joachim and I come from Berlin.

2. Sein – To be
Es ist nicht immer einfach, vernünftig zu sein.
It’s not always easy to be sensible.

3. Sie – She/They
Heute möchte sie ihre Familie in Hamburg besuchen.
Today she wants to visit her family in Hamburg.`;

export default function StudyPage() {
  // =========================
  // UI state
  // =========================
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_ELEVENLABS_API_KEY || "");
  const [voices, setVoices] = useState([DEFAULT_VOICE]);
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE_ID);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [speed, setSpeed] = useState(1.0);
  const [delaySec, setDelaySec] = useState(0.75);
  const [loopMode, setLoopMode] = useState("none");
  const [speakEnglish, setSpeakEnglish] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [repeatClickMode, setRepeatClickMode] = useState(false);
  const [learningWordsMode, setLearningWordsMode] = useState(false);

  const [content, setContent] = useState(DEFAULT_TEXT);
  const [phraseListUrl, setPhraseListUrl] = usePhraseListSelection();

  // Status
  const [nowText, setNowText] = useState("—");
  const [idxText, setIdxText] = useState("—");

  // =========================
  // Playback state (refs)
  // =========================
  const currentAudioRef = useRef(null);
  const rafIdRef = useRef(null);

  const shouldStopRef = useRef(false);
  const isRunningRef = useRef(false);
  const isPausedRef = useRef(false);

  const repeatActiveRef = useRef(false);
  const repeatKeyRef = useRef(null);

  // playlist + current index
  const playlistRef = useRef([]);
  const currentIndexRef = useRef(-1);

  // highlight ids
  const [currentHeaderKey, setCurrentHeaderKey] = useState(null);
  const [currentRowKey, setCurrentRowKey] = useState(null);
  const [playingTokKey, setPlayingTokKey] = useState(null);
  const [playingChipKey, setPlayingChipKey] = useState(null);
  const [playingWordIndex, setPlayingWordIndex] = useState(null);

  // =========================
  // Helpers
  // =========================
  const delayMs = useMemo(() => Math.max(0, Number(delaySec) || 0) * 1000, [delaySec]);

  function setStatus(text, idx) {
    setNowText(text || "—");
    if (idx >= 0) setIdxText(`${idx + 1}/${playlistRef.current.length}`);
    else setIdxText("—");
  }

  function cancelRaf() {
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = null;
  }

  function stopAudioOnly() {
    cancelRaf();
    const a = currentAudioRef.current;
    if (a) {
      try {
        a.pause();
        a.currentTime = 0;
      } catch {}
      currentAudioRef.current = null;
    }
  }

  function clearAllHighlights() {
    setPlayingTokKey(null);
    setPlayingChipKey(null);
    setPlayingWordIndex(null);
    setCurrentRowKey(null);
    setCurrentHeaderKey(null);
  }

  function clearPlaybackHighlightsOnly() {
    setPlayingTokKey(null);
    setPlayingChipKey(null);
    setPlayingWordIndex(null);
  }

  function stopAll() {
    shouldStopRef.current = true;
    isRunningRef.current = false;
    isPausedRef.current = false;

    repeatActiveRef.current = false;
    repeatKeyRef.current = null;

    stopAudioOnly();
    clearAllHighlights();
    setStatus("—", -1);
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

  function base64ToBlobUrl(base64, mime = "audio/mpeg") {
    const binStr = atob(base64);
    const len = binStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
    return URL.createObjectURL(blob);
  }

  function tokenize(text) {
    const re = /[A-Za-zÄÖÜäöüß0-9]+|[^\s]/g;
    return text.match(re) || [];
  }
  function isPunct(tok) {
    return /^[^\wÄÖÜäöüß0-9]+$/.test(tok);
  }
  function wordSpans(sentence) {
    const spans = [];
    const re = /[A-Za-zÄÖÜäöüß0-9]+/g;
    let m;
    while ((m = re.exec(sentence)) !== null) {
      spans.push({ start: m.index, end: m.index + m[0].length });
    }
    return spans;
  }

  // =========================
  // Load content file
  // =========================
  useEffect(() => {
    let alive = true;

    fetch(phraseListUrl, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then((t) => {
        if (alive) setContent(t);
      })
      .catch((e) => {
        console.warn(`Failed to load ${phraseListUrl}:`, e.message);
      });

    return () => {
      alive = false;
    };
  }, [phraseListUrl]);

  // =========================
  // ElevenLabs API calls
  // =========================
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

  async function ttsStream(text, languageCode = "de") {
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

  async function ttsWithTimestamps(text, languageCode = "de") {
    const k = apiKey.trim();
    if (!k) {
      alert("Paste your ElevenLabs API key first.");
      return null;
    }
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`;
    const body = {
      text,
      model_id: ELEVENLABS_MODEL_ID,
      language_code: languageCode,
      voice_settings: V3_VOICE_SETTINGS,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "xi-api-key": k, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      alert("TTS failed: " + res.status + " " + msg);
      return null;
    }
    return await res.json();
  }

  // =========================
  // Audio play primitives
  // =========================
  function playAudioBlob(blob, onEnd) {
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    return playAudioElement(a, onEnd);
  }

  function playAudioElement(a, onEnd, onTick) {
    return new Promise((resolve) => {
      a.playbackRate = Math.min(1.2, Math.max(0.7, Number(speed) || 1.0));
      currentAudioRef.current = a;

      const ended = () => {
        a.removeEventListener("ended", ended);
        a.removeEventListener("pause", pausedListener);
        if (onEnd) onEnd();
        resolve();
      };

      const pausedListener = async () => {
        if (isPausedRef.current) {
          await waitForResume();
          try {
            a.play();
          } catch {}
        }
      };

      a.addEventListener("ended", ended);
      a.addEventListener("pause", pausedListener);

      if (onTick) {
        a.addEventListener(
          "play",
          () => {
            rafIdRef.current = requestAnimationFrame(onTick);
          },
          { once: true }
        );
      }

      a.play().catch(() => resolve());
    });
  }

  // =========================
  // Play actions
  // =========================
  async function playWordQuick(word, chipKey = null, tokKey = null) {
    stopAudioOnly();
    clearPlaybackHighlightsOnly();

    if (chipKey) setPlayingChipKey(chipKey);
    if (tokKey) setPlayingTokKey(tokKey);

    const blob = await ttsStream(word);
    if (!blob) return;

    await playAudioBlob(blob, () => {
      if (chipKey) setPlayingChipKey(null);
      if (tokKey) setPlayingTokKey(null);
    });
  }

  async function playEnglishLine(text) {
    stopAudioOnly();
    clearPlaybackHighlightsOnly();
    const blob = await ttsStream(text, "en");
    if (!blob) return;
    await playAudioBlob(blob, null);
  }

  async function playGermanSentenceWithHighlight(sentence, tokenWordCount) {
    stopAudioOnly();
    setPlayingWordIndex(null);

    const data = await ttsWithTimestamps(sentence);
    if (!data) return;

    const audioUrl = base64ToBlobUrl(data.audio_base64);
    const align = data.alignment || {};
    const starts = align.character_start_times_seconds || [];
    const ends = align.character_end_times_seconds || [];

    const spans = wordSpans(sentence);
    const wordTimings = spans.map((s, i) => {
      const startT = starts[s.start] ?? 0;
      const endT = ends[Math.max(s.end - 1, s.start)] ?? startT + 0.2;
      return { i, startT, endT };
    });

    const a = new Audio(audioUrl);
    currentAudioRef.current = a;

    let lastIdx = -1;
    function tick() {
      const aa = currentAudioRef.current;
      if (!aa) return;
      const t = aa.currentTime;

      let idx = -1;
      for (let k = 0; k < wordTimings.length; k++) {
        if (t >= wordTimings[k].startT && t < wordTimings[k].endT) {
          idx = wordTimings[k].i;
          break;
        }
      }

      if (idx !== lastIdx) {
        if (idx >= 0 && idx < tokenWordCount) setPlayingWordIndex(idx);
        else setPlayingWordIndex(null);
        lastIdx = idx;
      }

      rafIdRef.current = requestAnimationFrame(tick);
    }

    await playAudioElement(
      a,
      () => {
        cancelRaf();
        setPlayingWordIndex(null);
      },
      tick
    );
  }

  // =========================
  // Parsing (strict blocks + fallback line parsing)
  // =========================
  function parseContent(text) {
    const headerRe = /^(\d+)\.\s*(.+?)\s*[–—-]\s*(.+)$/;

    // strict blocks
    const blocks = (text || "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
    const itemsStrict = [];

    for (const b of blocks) {
      const lines = b.split("\n").map((x) => x.trim()).filter(Boolean);
      if (!lines.length) continue;

      const m = lines[0].match(headerRe);
      if (!m) continue;

      const num = m[1], word = m[2], meaning = m[3];
      const examples = [];
      let i = 1;
      while (i + 1 < lines.length) {
        examples.push({ de: lines[i], en: lines[i + 1] });
        i += 2;
      }
      itemsStrict.push({ num, word, meaning, examples });
    }

    if (itemsStrict.length) return itemsStrict;

    // fallback (no blank lines, one-line examples supported with " | " or 2+ spaces)
    const lines = (text || "").split("\n");
    const items = [];
    let cur = null;

    function splitOneLineExample(line) {
      if (line.includes(" | ")) {
        const [de, ...rest] = line.split(" | ");
        return { de: de.trim(), en: rest.join(" | ").trim() };
      }
      const mm = line.match(/^(.*\S)\s{2,}(\S.*)$/);
      if (mm) return { de: mm[1].trim(), en: mm[2].trim() };
      return null;
    }

    function pushCur() {
      if (!cur) return;
      const exLines = cur._buf.map((s) => s.trim()).filter(Boolean);
      const examples = [];

      for (let i = 0; i < exLines.length; i++) {
        const a = exLines[i];

        const one = splitOneLineExample(a);
        if (one) {
          examples.push(one);
          continue;
        }

        if (i + 1 < exLines.length && !headerRe.test(exLines[i + 1])) {
          examples.push({ de: a, en: exLines[i + 1] });
          i++;
          continue;
        }

        examples.push({ de: a, en: "" });
      }

      items.push({ num: cur.num, word: cur.word, meaning: cur.meaning, examples });
      cur = null;
    }

    for (const raw of lines) {
      const line = raw.trim();
      const m = line.match(headerRe);
      if (m) {
        pushCur();
        cur = { num: m[1], word: m[2], meaning: m[3], _buf: [] };
      } else if (cur) {
        cur._buf.push(raw);
      }
    }
    pushCur();
    return items;
  }

  const items = useMemo(() => parseGermanStudyText(content), [content]);

  // =========================
  // Build playlist (derived)
  // =========================
  const uiModel = useMemo(() => {
    const headers = [];
    const rows = [];
    const playlist = [];

    let headerCounter = 0;
    let rowCounter = 0;

    for (const it of items) {
      const headerKey = `h_${++headerCounter}_${it.num}`;
      headers.push({ ...it, headerKey });

      if (learningWordsMode) {
        const rowKey = `wrow_${++rowCounter}_${it.num}`;
        const row = {
          type: "word",
          rowKey,
          headerKey: null,
          word: it.word,
          meaning: it.meaning,
          labelText: `${it.num}. ${it.word} – ${it.meaning}`,
        };
        rows.push(row);
        playlist.push(row);
      } else {
        for (const ex of it.examples) {
          const rowKey = `srow_${++rowCounter}_${it.num}`;
          const row = {
            type: "sentence",
            rowKey,
            headerKey,
            word: it.word,
            meaning: it.meaning,
            de: ex.de,
            en: ex.en,
          };
          rows.push(row);
          playlist.push(row);
        }
      }
    }

    return { headers, rows, playlist };
  }, [items, learningWordsMode]);

  // keep refs in sync
  useEffect(() => {
    playlistRef.current = uiModel.playlist;
    currentIndexRef.current = -1;
    setStatus("—", -1);
    clearAllHighlights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiModel.playlist]);

  // auto scroll
  useEffect(() => {
    if (!autoScroll) return;
    if (currentRowKey) {
      const el = document.querySelector(`[data-rowkey="${currentRowKey}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (currentHeaderKey) {
      const el = document.querySelector(`[data-headerkey="${currentHeaderKey}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentRowKey, currentHeaderKey, autoScroll]);

  // =========================
  // Repeat clicked item
  // =========================
  async function toggleRepeatItem(item) {
    const key = item.rowKey;

    if (repeatActiveRef.current && repeatKeyRef.current === key) {
      repeatActiveRef.current = false;
      repeatKeyRef.current = null;
      stopAudioOnly();
      clearPlaybackHighlightsOnly();
      setStatus("—", -1);
      return;
    }

    stopAll();
    shouldStopRef.current = false;
    isRunningRef.current = false;
    isPausedRef.current = false;

    repeatActiveRef.current = true;
    repeatKeyRef.current = key;

    while (repeatActiveRef.current && repeatKeyRef.current === key && !shouldStopRef.current) {
      setCurrentRowKey(item.rowKey);
      if (item.headerKey) setCurrentHeaderKey(item.headerKey);

      if (item.type === "word") {
        setStatus("Repeating: " + item.word, -1);
        if (isPausedRef.current) await waitForResume();
        if (!repeatActiveRef.current || repeatKeyRef.current !== key || shouldStopRef.current) break;

        await playWordQuick(item.word);
        if (!repeatActiveRef.current || repeatKeyRef.current !== key || shouldStopRef.current) break;

        await wait(delayMs);
      } else {
        setStatus("Repeating: " + item.de, -1);
        if (isPausedRef.current) await waitForResume();
        if (!repeatActiveRef.current || repeatKeyRef.current !== key || shouldStopRef.current) break;

        const tokenWordCount = tokenize(item.de).filter((t) => !isPunct(t)).length;
        await playGermanSentenceWithHighlight(item.de, tokenWordCount);
        if (!repeatActiveRef.current || repeatKeyRef.current !== key || shouldStopRef.current) break;

        await wait(delayMs);
      }
    }
  }

  // =========================
  // Row click handlers
  // =========================
  async function onClickWordRow(row) {
    if (repeatClickMode) return toggleRepeatItem(row);

    stopAll();
    shouldStopRef.current = false;

    setCurrentRowKey(row.rowKey);
    setStatus(row.word, -1);

    await playWordQuick(row.word);
    if (shouldStopRef.current) return;

    await wait(delayMs);
    if (shouldStopRef.current) return;

    if (speakEnglish && row.meaning) {
      await playEnglishLine(row.meaning);
      if (shouldStopRef.current) return;
      await wait(delayMs);
    }
  }

  async function onClickHeader(headerKey, word, meaning) {
    stopAll();
    shouldStopRef.current = false;

    setCurrentHeaderKey(headerKey);
    setStatus(word, -1);

    await playWordQuick(word);
    if (shouldStopRef.current) return;

    await wait(delayMs);
    if (shouldStopRef.current) return;

    if (speakEnglish && meaning) {
      await playEnglishLine(meaning);
    }
  }

  async function onClickSentenceRow(row) {
    if (repeatClickMode) return toggleRepeatItem(row);

    stopAll();
    shouldStopRef.current = false;

    setCurrentHeaderKey(row.headerKey);
    setCurrentRowKey(row.rowKey);
    setStatus(row.de, -1);

    const tokenWordCount = tokenize(row.de).filter((t) => !isPunct(t)).length;
    await playGermanSentenceWithHighlight(row.de, tokenWordCount);
    if (shouldStopRef.current) return;

    await wait(delayMs);
    if (shouldStopRef.current) return;

    if (speakEnglish && row.en) {
      await playEnglishLine(row.en);
      if (shouldStopRef.current) return;
      await wait(delayMs);
    }
  }

  // =========================
  // Playlist play controls
  // =========================
  async function playSingleExample(item, idx) {
    setCurrentRowKey(item.rowKey);
    if (item.headerKey) setCurrentHeaderKey(item.headerKey);

    if (item.type === "word") {
      setStatus(item.word, idx);

      await playWordQuick(item.word);
      if (shouldStopRef.current) return;

      await wait(delayMs);
      if (shouldStopRef.current) return;

      if (speakEnglish && item.meaning) {
        await playEnglishLine(item.meaning);
        if (shouldStopRef.current) return;
        await wait(delayMs);
      }
      return;
    }

    setStatus(item.de, idx);

    const tokenWordCount = tokenize(item.de).filter((t) => !isPunct(t)).length;
    await playGermanSentenceWithHighlight(item.de, tokenWordCount);
    if (shouldStopRef.current) return;

    await wait(delayMs);
    if (shouldStopRef.current) return;

    if (speakEnglish && item.en) {
      await playEnglishLine(item.en);
      if (shouldStopRef.current) return;
      await wait(delayMs);
    }
  }

  async function playAll(startAt = 0) {
    if (!playlistRef.current.length) return alert("No items. Fix your content then try again.");

    repeatActiveRef.current = false;
    repeatKeyRef.current = null;

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

      const item = playlistRef.current[currentIndexRef.current];
      await playSingleExample(item, currentIndexRef.current);
      if (shouldStopRef.current) break;

      if (loopMode === "one") {
        // keep same
      } else {
        currentIndexRef.current++;
      }
    }

    isRunningRef.current = false;
    if (!shouldStopRef.current) {
      clearAllHighlights();
      setStatus("Finished", -1);
    }
  }

  function togglePause() {
    isPausedRef.current = !isPausedRef.current;
    const a = currentAudioRef.current;
    if (a) {
      if (isPausedRef.current) a.pause();
      else a.play().catch(() => {});
    }
  }

  function nextItem() {
    if (!playlistRef.current.length) return;
    stopAll();
    currentIndexRef.current = Math.min(
      playlistRef.current.length - 1,
      currentIndexRef.current < 0 ? 0 : currentIndexRef.current + 1
    );
    const item = playlistRef.current[currentIndexRef.current];
    item.type === "word" ? onClickWordRow(item) : onClickSentenceRow(item);
  }

  function prevItem() {
    if (!playlistRef.current.length) return;
    stopAll();
    currentIndexRef.current = Math.max(0, currentIndexRef.current <= 0 ? 0 : currentIndexRef.current - 1);
    const item = playlistRef.current[currentIndexRef.current];
    item.type === "word" ? onClickWordRow(item) : onClickSentenceRow(item);
  }

  // =========================
  // Render helpers
  // =========================
  function SentenceTokens({ text, rowKey }) {
    const tokens = tokenize(text);
    let wordIndex = -1;

    return (
      <div className="sentenceText">
        {tokens.map((tok, i) => {
          const punct = isPunct(tok);
          const key = `${rowKey}_tok_${i}`;
          const isWord = !punct;
          if (isWord) wordIndex++;

          const isPlaying = isWord && currentRowKey === rowKey && playingWordIndex === wordIndex;

          const next = tokens[i + 1];
          const needSpace = (!punct && next && !isPunct(next)) || (punct && next && !isPunct(next));

          return (
            <React.Fragment key={key}>
              <span
                className={`tok${punct ? " punct" : ""}${playingTokKey === key ? " playing" : ""}${
                  isPlaying ? " playing" : ""
                }`}
                onClick={(ev) => {
                  ev.stopPropagation();
                  if (punct) return;
                  playWordQuick(tok, null, key);
                }}
                style={punct ? { cursor: "default" } : undefined}
              >
                {tok}
              </span>
              {needSpace ? " " : ""}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  function Chips({ text, rowKey }) {
    const toks = tokenize(text).filter((t) => !isPunct(t));
    return (
      <div className="words">
        {toks.map((t, i) => {
          const chipKey = `${rowKey}_chip_${i}_${t}`;
          return (
            <span
              key={chipKey}
              className={`w${playingChipKey === chipKey ? " playing" : ""}`}
              onClick={(ev) => {
                ev.stopPropagation();
                playWordQuick(t, chipKey, null);
              }}
            >
              {t}
            </span>
          );
        })}
      </div>
    );
  }

  // =========================
  // Styles (+ sticky bar)
  // =========================
  const styles = `
    body { font-family: system-ui, sans-serif; margin: 0; }
    .wrap { padding: 24px; }
    textarea { width: 100%; height: 260px; }
    button { padding: 10px 14px; margin: 8px 8px 8px 0; }
    ul { list-style: none; padding: 0; margin: 0; }

    small { color: #666; }
    input[type="text"], input[type="password"], select {
      width:100%; padding:10px; margin:6px 0 10px; box-sizing: border-box;
    }

    .grid2 { display: grid; grid-template-columns: 1fr 170px; gap: 10px; align-items: end; }
    .grid3 { display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; }
    .rowC { margin: 10px 0; }
    .controls { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin: 10px 0; }
    .controls label { display:flex; gap:8px; align-items:center; padding:8px 10px; border:1px solid #e6e6e6; border-radius:12px; }
    .controls select, .controls input[type="number"] { width:auto; margin:0; padding:8px 10px; }

    .stickyBar{
      position: sticky;
      top: 0;
      z-index: 999;
      background: #fff;
      padding: 10px 0;
      border-bottom: 1px solid #eee;
    }

    .itemHead{
      padding: 10px 12px;
      border: 1px solid #ddd;
      border-radius: 12px;
      margin: 16px 0 10px;
      background: #f7f7f7;
      cursor: pointer;
      user-select: none;
    }
    .itemHead:hover{ background:#f1f1f1; }
    .itemHead .title{ font-weight: 800; font-size: 16px; }

li.row{
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 12px;
  margin: 10px 0;
  cursor: pointer;
  user-select: none;

  display: flex;
  flex-direction: column;   /* ✅ vertical */
  align-items: stretch;
  gap: 10px;                /* spacing between DE / chips / EN */
}
    li.row:hover { background: #fafafa; }

    .itemHead.now { outline: 2px solid #86efac; background: #bbf7d0; }
    li.row.now { outline: 2px solid #f59e0b; background: #fff7ed; }

    .sentenceText { margin-top: 2px; line-height: 1.9; }
    .tok {
      display: inline-block;
      padding: 2px 4px;
      border-radius: 8px;
      cursor: pointer;
      user-select: none;
      margin: 1px 0;
    }
    .tok:hover { background: #f2f2f2; }
    .tok.punct { opacity: 0.55; cursor: default; }
    .tok.playing { background: #bbf7d0; }

    .words { margin-top: 10px; line-height: 2.2; }
    .w {
      display: inline-block;
      padding: 4px 8px;
      margin: 4px 4px 0 0;
      border: 1px solid #e3e3e3;
      border-radius: 999px;
      cursor: pointer;
      user-select: none;
      background: #fff;
      font-size: 14px;
    }
    .w:hover { background: #f6f6f6; }
    .w.playing { background: #bbf7d0; border-color:#86efac; }

    .en {
      margin-top: 8px;
      color: #444;
      font-size: 14px;
      padding-top: 8px;
      border-top: 1px dashed #e5e5e5;
      cursor: default;
    }

    .words{
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 0;     /* since we use row gap now */
  line-height: normal;
}

.en{
  margin-top: 0;
  color: #444;
  font-size: 14px;
  padding-top: 10px;
  border-top: 1px dashed #e5e5e5;
  cursor: default;
  width: 100%;
}

.sentenceText{
  width: 100%;
  line-height: 1.9;
}
  
    .status {
      margin-top: 8px;
      padding: 10px 12px;
      border: 1px solid #e6e6e6;
      border-radius: 12px;
      background: #fbfbfb;
      color: #444;
      display:flex;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }
    .status b { color:#111; }

    .learning-words li.row.now{
      outline: 2px solid #86efac !important;
      background: #bbf7d0 !important;
    }
  `;

  useEffect(() => () => stopAll(), []);

  return (
    <div className={`wrap ${learningWordsMode ? "learning-words" : ""}`}>
      <style>{styles}</style>

      <h2>German Study (ElevenLabs)</h2>
        <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <Link to="/learning"><button>Learning Words (Big View)</button></Link>
        <Link to="/recording-focus"><button>Recording Focus</button></Link>
        <label htmlFor="study-phrase-list">Phrase list:</label>
        <select
          id="study-phrase-list"
          value={phraseListUrl}
          onChange={(e) => {
            stopAll();
            setPhraseListUrl(e.target.value);
          }}
        >
          {PHRASE_LISTS.map((list) => (
            <option key={list.value} value={list.value}>{list.label}</option>
          ))}
        </select>
        <small>Model: {ELEVENLABS_MODEL_NAME} • German language override</small>
        </div>
      <label>ElevenLabs API Key:</label>
      <input
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        type="password"
        placeholder="paste your ElevenLabs API key here"
      />

      <div className="grid2">
        <div>
          <label>Voice:</label>
          <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>
            {voices.map((v) => (
              <option key={v.voice_id} value={v.voice_id}>
                {formatVoiceLabel(v)}
              </option>
            ))}
          </select>
          <small>{voiceStatus}</small>
        </div>
        <div>
          <button onClick={loadVoices}>Load voices</button>
        </div>
      </div>

      <div className="grid3">
        <div className="rowC">
          <label>
            Playback speed: <b>{speed.toFixed(2)}x</b>
          </label>
          <input
            type="range"
            min="0.7"
            max="1.2"
            step="0.05"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>

        <div className="rowC">
          <label>Delay (seconds) between lines:</label>
          <input type="number" min="0" step="0.25" value={delaySec} onChange={(e) => setDelaySec(e.target.value)} />
        </div>

        <div className="rowC">
          <label>Loop mode:</label>
          <select value={loopMode} onChange={(e) => setLoopMode(e.target.value)}>
            <option value="none">No loop</option>
            <option value="all">Loop all</option>
            <option value="one">Repeat current</option>
          </select>
        </div>
      </div>

      {/* Sticky controls + status */}
      <div className="stickyBar">
        <div className="controls">
          <button onClick={() => playAll(0)} disabled={!uiModel.playlist.length}>
            Play All
          </button>
          <button onClick={togglePause}>{isPausedRef.current ? "Resume" : "Pause"}</button>
          <button onClick={stopAll}>Stop</button>
          <button onClick={prevItem}>Prev</button>
          <button onClick={nextItem}>Next</button>

          <label>
            <input type="checkbox" checked={speakEnglish} onChange={(e) => setSpeakEnglish(e.target.checked)} /> Speak
            English too
          </label>
          <label>
            <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} /> Auto-scroll
          </label>
          <label>
            <input
              type="checkbox"
              checked={repeatClickMode}
              onChange={(e) => setRepeatClickMode(e.target.checked)}
            />{" "}
            Repeat clicked item
          </label>
          <label>
            <input
              type="checkbox"
              checked={learningWordsMode}
              onChange={(e) => {
                stopAll();
                shouldStopRef.current = false;
                setLearningWordsMode(e.target.checked);
              }}
            />{" "}
            Learning words
          </label>
        </div>

        <div className="status">
          <div>
            Now: <b>{nowText}</b>
          </div>
          <div>
            Index: <b>{idxText}</b>
          </div>
        </div>
      </div>

      <label>Input format (German line then English line):</label>
      <textarea value={content} onChange={(e) => setContent(e.target.value)} />

      {/* Build button (reset/rebuild) */}
      <div>
        <button
          onClick={() => {
            stopAll();
            shouldStopRef.current = false;
            setCurrentHeaderKey(null);
            setCurrentRowKey(null);
            setStatus("—", -1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          Build
        </button>
      </div>

      <ul>
        {learningWordsMode ? (
          uiModel.rows.map((row) => (
            <li
              key={row.rowKey}
              data-rowkey={row.rowKey}
              className={`row${currentRowKey === row.rowKey ? " now" : ""}`}
              onClick={() => onClickWordRow(row)}
            >
              {row.labelText}
            </li>
          ))
        ) : (
          uiModel.headers.map((h) => (
            <React.Fragment key={h.headerKey}>
              <div
                data-headerkey={h.headerKey}
                className={`itemHead${currentHeaderKey === h.headerKey ? " now" : ""}`}
                onClick={() => onClickHeader(h.headerKey, h.word, h.meaning)}
              >
                <div className="title">
                  {h.num}. {h.word} – {h.meaning}
                </div>
              </div>

              {uiModel.rows
                .filter((r) => r.headerKey === h.headerKey)
                .map((row) => (
                  <li
                    key={row.rowKey}
                    data-rowkey={row.rowKey}
                    className={`row${currentRowKey === row.rowKey ? " now" : ""}`}
                    onClick={() => onClickSentenceRow(row)}
                  >
                    <SentenceTokens text={row.de} rowKey={row.rowKey} />
                    <Chips text={row.de} rowKey={row.rowKey} />
                    <div className="en" onClick={(e) => e.stopPropagation()}>
                      {row.en}
                    </div>
                  </li>
                ))}
            </React.Fragment>
          ))
        )}
      </ul>
    </div>
  );
}
