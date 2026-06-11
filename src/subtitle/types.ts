/**
 * Emitted when Netflix renders a new subtitle line.
 */
export interface SubtitleEvent {
  /** Full text content of the current subtitle, with multi-span lines joined. */
  text: string;
  /** Unix timestamp (ms) of when the event was emitted. */
  timestamp: number;
}

/**
 * Emitted when the current subtitle disappears (e.g. gap between lines).
 */
export interface SubtitleClearedEvent {
  timestamp: number;
}

/**
 * Union of all subtitle events the observer can emit.
 */
export type SubtitleUpdate =
  | { kind: "subtitle"; event: SubtitleEvent }
  | { kind: "cleared"; event: SubtitleClearedEvent };

/**
 * Callback signature for SubtitleObserver consumers.
 */
export type SubtitleCallback = (update: SubtitleUpdate) => void;

/**
 * A single token produced by the WordProcessor.
 * Tokens cover the full subtitle text with no characters lost.
 */
export interface WordToken {
  /** The raw text of this token (word, punctuation, or whitespace). */
  text: string;
  /**
   * Position of this token among all tokens in the subtitle.
   * Stable across renders of the same subtitle line.
   */
  index: number;
  /** True if this token is an interactive word or phrase; false for punctuation or whitespace. */
  isWord: boolean;
  /**
   * True when this token represents a multi-word idiom or phrase that was
   * merged by PhraseDetector (e.g. "kick the bucket", "by the way").
   * Dictionary lookup is skipped for phrases — only context explanation runs.
   */
  isPhrase?: boolean;
}
