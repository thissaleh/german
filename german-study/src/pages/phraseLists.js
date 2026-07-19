import { useEffect, useState } from "react";

export const DEFAULT_PHRASE_LIST = "/german_phrases_01.txt";

export const PHRASE_LISTS = [
  { value: "/basics_01.txt", label: "Basics 01" },
  { value: "/german_phrases.txt", label: "German phrases (main)" },
  ...Array.from({ length: 10 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return {
      value: `/german_phrases_${number}.txt`,
      label: `German phrases ${number}`,
    };
  }),
];

const STORAGE_KEY = "german-study:phrase-list";
const VALID_LISTS = new Set(PHRASE_LISTS.map((list) => list.value));

export function usePhraseListSelection() {
  const [phraseListUrl, setPhraseListUrl] = useState(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return VALID_LISTS.has(saved) ? saved : DEFAULT_PHRASE_LIST;
    } catch {
      return DEFAULT_PHRASE_LIST;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, phraseListUrl);
    } catch {
      // The selector still works when browser storage is unavailable.
    }
  }, [phraseListUrl]);

  return [phraseListUrl, setPhraseListUrl];
}
