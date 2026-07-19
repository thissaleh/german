import { LIAM_FOCUS_TRACK } from "./liamFocusTrack";
import { LIAM_TOP_100_ADJECTIVES_TRACK } from "./liamTop100AdjectivesTrack";
import { LIAM_TOP_100_ADVERBS_TRACK } from "./liamTop100AdverbsTrack";
import { LIAM_TOP_100_CONJUNCTIONS_TRACK } from "./liamTop100ConjunctionsTrack";
import { LIAM_TOP_100_EXPRESSION_SENTENCES_TRACK } from "./liamTop100ExpressionSentencesTrack";
import { LIAM_TOP_100_INTERJECTIONS_TRACK } from "./liamTop100InterjectionsTrack";
import { LIAM_TOP_100_INTRODUCTION_SENTENCES_TRACK } from "./liamTop100IntroductionSentencesTrack";
import { LIAM_TOP_100_NOUNS_TRACK } from "./liamTop100NounsTrack";
import { LIAM_TOP_100_PRONOUNS_TRACK } from "./liamTop100PronounsTrack";
import { LIAM_TOP_100_QUESTIONS_TRACK } from "./liamTop100QuestionsTrack";
import { LIAM_TOP_100_VERBS_TRACK } from "./liamTop100VerbsTrack";
import { LIAM_TOP_100_WORDS_TRACK } from "./liamTop100WordsTrack";

export const RECORDING_FOCUS_TRACKS = [
  LIAM_TOP_100_QUESTIONS_TRACK,
  LIAM_TOP_100_EXPRESSION_SENTENCES_TRACK,
  LIAM_TOP_100_INTRODUCTION_SENTENCES_TRACK,
  LIAM_TOP_100_INTERJECTIONS_TRACK,
  LIAM_TOP_100_CONJUNCTIONS_TRACK,
  LIAM_TOP_100_PRONOUNS_TRACK,
  LIAM_TOP_100_ADVERBS_TRACK,
  LIAM_TOP_100_ADJECTIVES_TRACK,
  LIAM_TOP_100_NOUNS_TRACK,
  LIAM_TOP_100_VERBS_TRACK,
  LIAM_TOP_100_WORDS_TRACK,
  LIAM_FOCUS_TRACK,
];

export function getRecordingFocusTrack(trackId) {
  return RECORDING_FOCUS_TRACKS.find((track) => track.id === trackId);
}

export function formatTrackDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}
