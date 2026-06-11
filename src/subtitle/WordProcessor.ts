import type { WordToken } from "./types";

/**
 * Matches, in order:
 *   1. Words — one or more letters, optionally followed by an apostrophe + letters
 *      (covers contractions: don't, I'm, they're, it's, o'clock)
 *   2. Punctuation — one or more non-letter, non-whitespace characters
 *   3. Whitespace — one or more whitespace characters
 *
 * Every character in the input is covered by exactly one token.
 */
const TOKEN_REGEX = /[a-zA-Z]+(?:'[a-zA-Z]+)*|[^a-zA-Z\s]+|\s+/g;

/**
 * Splits subtitle text into a flat list of tokens.
 *
 * Design decisions:
 * - Contractions (don't, I'm) are kept as a single word token.
 * - Punctuation immediately adjacent to words (e.g. "Hello!") is a separate token.
 * - Whitespace tokens are preserved so the full text can be reconstructed exactly.
 * - Index is assigned across the whole subtitle, not per-word, so every token
 *   has a stable, unique position.
 *
 * @param text - Raw subtitle text (as returned by SubtitleObserver).
 * @returns Ordered array of tokens covering the complete input.
 *
 * @example
 * tokenize("Don't stop!")
 * // [
 * //   { text: "Don't", index: 0, isWord: true },
 * //   { text: " ",     index: 1, isWord: false },
 * //   { text: "stop",  index: 2, isWord: true },
 * //   { text: "!",     index: 3, isWord: false },
 * // ]
 */
export function tokenize(text: string): WordToken[] {
  const tokens: WordToken[] = [];
  let index = 0;
  let match: RegExpExecArray | null;

  TOKEN_REGEX.lastIndex = 0; // reset stateful regex

  while ((match = TOKEN_REGEX.exec(text)) !== null) {
    const raw = match[0];
    tokens.push({
      text: raw,
      index: index++,
      isWord: isWordToken(raw),
    });
  }

  return tokens;
}

/**
 * Returns true if the token text is a word (contains at least one letter).
 * Punctuation-only and whitespace-only tokens return false.
 */
function isWordToken(text: string): boolean {
  return /[a-zA-Z]/.test(text);
}

/**
 * Merges consecutive tokens that together form a detected phrase/idiom into a
 * single phrase token.
 *
 * How it works:
 *   For each phrase returned by PhraseDetector, we scan the token array for a
 *   consecutive run whose concatenated text matches the phrase (case-insensitive).
 *   When found, those tokens are replaced by one merged token with `isPhrase: true`.
 *   Longer phrases are processed first so "kick the bucket" beats "kick".
 *
 * @param tokens  - Output of `tokenize()`.
 * @param phrases - Multi-word expressions to merge (e.g. ["kick the bucket"]).
 * @returns New token array with phrase runs collapsed.
 *
 * @example
 * mergePhrasesIntoTokens(tokenize("He kicked the bucket"), ["kicked the bucket"])
 * // [..., { text: "kicked the bucket", index: 2, isWord: true, isPhrase: true }]
 */
export function mergePhrasesIntoTokens(
  tokens: WordToken[],
  phrases: string[],
): WordToken[] {
  if (phrases.length === 0) return tokens;

  // Work on a mutable copy; sort longest-first to avoid partial overlaps.
  let result = [...tokens];
  const sorted = [...phrases].sort((a, b) => b.length - a.length);

  for (const phrase of sorted) {
    const lowerPhrase = phrase.toLowerCase();
    let i = 0;

    while (i < result.length) {
      // Accumulate token text starting at i until we match or overshoot.
      let combined = "";
      let j = i;

      while (j < result.length && combined.length < lowerPhrase.length) {
        combined += result[j].text;
        if (combined.toLowerCase() === lowerPhrase) {
          // Found: merge tokens [i..j] into one phrase token.
          const phraseText = result.slice(i, j + 1).map((t) => t.text).join("");
          const merged: WordToken = {
            text: phraseText,
            index: result[i].index,
            isWord: true,
            isPhrase: true,
          };
          result.splice(i, j - i + 1, merged);
          break;
        }
        j++;
      }

      i++;
    }
  }

  return result;
}
