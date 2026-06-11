import { SubtitleObserver } from "../subtitle/SubtitleObserver";
import { OverlayRenderer } from "../overlay/OverlayRenderer";
import { DictionaryService } from "../dictionary/DictionaryService";
import { ContextExplanationService } from "../context/ContextExplanationService";
import { TooltipRenderer } from "../tooltip/TooltipRenderer";
import { VideoController } from "../player/VideoController";
import { isCommonWord } from "../subtitle/commonWords";
import { detectNetflixContext } from "../player/NetflixContextDetector";
import { PhraseDetector } from "../subtitle/PhraseDetector";
import { QuotaDisclosureUI } from "../quota/QuotaDisclosureUI";
import type { SubtitleUpdate } from "../subtitle/types";

console.log(
  "%c[Netflix Vocabulary] Content script loaded ✓",
  "color: #e50914; font-weight: bold; font-size: 14px;",
);

const dictionary = new DictionaryService();
const context = new ContextExplanationService();
const phraseDetector = new PhraseDetector();
const video = new VideoController();

// Listens for quota_exceeded events from GeminiProxy and shows the full
// disclosure screen so users can optionally add their own key.
const quotaUI = new QuotaDisclosureUI();
quotaUI.init();

const tooltip = new TooltipRenderer(() => {
  video.resume();
});

/** The subtitle line currently on screen — updated on every subtitle event. */
let currentSentence = "";

/**
 * Rolling buffer of the last N subtitle lines for context.
 * Passed to the AI so it understands what was said before the hovered word.
 */
const HISTORY_SIZE = 4;
const subtitleHistory: string[] = [];

/**
 * Detected phrases for the current subtitle line.
 * The overlay merges these into per-container tokens at render time,
 * so multi-line subtitles never get tokens from the wrong container.
 */
let currentPhrases: string[] = [];

const overlay = new OverlayRenderer(
  (wordOrPhrase, token, spanEl) => {
    video.pause();

    const sentence = currentSentence;
    const recentLines = [...subtitleHistory];
    const netflixContext = detectNetflixContext();
    const isPhrase = token.isPhrase === true;

    // Phrases: skip dictionary (won't have idioms), go straight to context.
    // Single words: run both in parallel.
    const dictPromise = isPhrase
      ? Promise.resolve(null)
      : dictionary.lookup(wordOrPhrase);

    // Skip context only for plain common words — phrases always get context.
    const contextPromise =
      !isPhrase && isCommonWord(wordOrPhrase)
        ? Promise.resolve(null)
        : context.explain(wordOrPhrase, sentence, recentLines, netflixContext);

    // Phase 1 — show tooltip as soon as we have something to display.
    if (isPhrase) {
      // For phrases, wait for context (no dict) — show loading state immediately.
      tooltip.show(spanEl, wordOrPhrase, null);
    } else {
      void dictPromise.then((result) => {
        tooltip.show(spanEl, wordOrPhrase, result);
      });
    }

    // Phase 2 — fill in the context explanation.
    void contextPromise.then((contextResult) => {
      tooltip.setContext(wordOrPhrase, contextResult);
    });

    spanEl.addEventListener(
      "mouseleave",
      (e: MouseEvent) => {
        if (!tooltip.contains(e.relatedTarget)) {
          tooltip.hide();
        }
      },
      { once: true },
    );
  },
  () => currentPhrases,
);

document.addEventListener("mouseover", (e: MouseEvent) => {
  const target = e.target;
  if (
    target instanceof HTMLElement &&
    !target.classList.contains("nva-word") &&
    !tooltip.contains(target)
  ) {
    tooltip.hide();
  }
});

async function handleSubtitleUpdate(update: SubtitleUpdate): Promise<void> {
  if (update.kind === "subtitle") {
    // Push previous sentence into history before updating current.
    if (currentSentence !== "") {
      subtitleHistory.push(currentSentence);
      if (subtitleHistory.length > HISTORY_SIZE) subtitleHistory.shift();
    }
    currentSentence = update.event.text;
    currentPhrases = [];
    overlay.render();

    // Async upgrade: re-render with phrase highlights once detection resolves.
    const phrases = await phraseDetector.detect(currentSentence);
    if (phrases.length > 0 && currentSentence === update.event.text) {
      currentPhrases = phrases;
      overlay.render();
    }
  } else {
    currentSentence = "";
    currentPhrases = [];
    subtitleHistory.length = 0;
    overlay.clear();
  }
}

const observer = new SubtitleObserver((update) => {
  void handleSubtitleUpdate(update);
});
observer.start();
