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
  "%c[Thesara] Content script loaded ✓",
  "color: #e50914; font-weight: bold; font-size: 14px;",
);

const dictionary = new DictionaryService();
const context = new ContextExplanationService();
const phraseDetector = new PhraseDetector();
const video = new VideoController();

// Listens for quota_exceeded events from AIProxy and shows the full
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
const HISTORY_SIZE = 6;
const subtitleHistory: string[] = [];

/**
 * Detected phrases for the current subtitle line.
 * The overlay merges these into per-container tokens at render time,
 * so multi-line subtitles never get tokens from the wrong container.
 */
let currentPhrases: string[] = [];

/**
 * Debounced hide — prevents flickering when the mouse briefly passes over
 * gaps between word spans as it moves from one word to another.
 */
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleHide(): void {
  if (hideTimer !== null) return;
  hideTimer = setTimeout(() => {
    hideTimer = null;
    tooltip.hide();
  }, 80);
}

function cancelHide(): void {
  if (hideTimer !== null) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

/**
 * Debounce timer for AI calls (context + phrase detection).
 * Fires 300ms after the subtitle settles — avoids blasting the API on
 * rapid-fire subtitles in fast-paced scenes.
 */
let aiDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const AI_DEBOUNCE_MS = 300;

function scheduleAICalls(sentence: string): void {
  if (aiDebounceTimer !== null) clearTimeout(aiDebounceTimer);
  aiDebounceTimer = setTimeout(() => {
    aiDebounceTimer = null;
    // Only run if the sentence is still the current one.
    if (sentence !== currentSentence) return;
    void runPhraseDetection(sentence);
  }, AI_DEBOUNCE_MS);
}

async function runPhraseDetection(sentence: string): Promise<void> {
  const phrases = await phraseDetector.detect(sentence);
  if (phrases.length > 0 && currentSentence === sentence) {
    currentPhrases = phrases;
    overlay.render();
  }
}

const overlay = new OverlayRenderer(
  (wordOrPhrase, token, spanEl) => {
    cancelHide();
    video.pause();

    const sentence = currentSentence;
    const recentLines = [...subtitleHistory];
    const netflixContext = detectNetflixContext();
    const isPhrase = token.isPhrase === true;

    // Show tooltip immediately with loading state — no waiting.
    tooltip.show(spanEl, wordOrPhrase, null);

    // Phase 1 — update with dictionary data as soon as it arrives.
    if (!isPhrase) {
      void dictionary.lookup(wordOrPhrase).then((result) => {
        tooltip.updateDict(wordOrPhrase, result);
      });
    }

    // Phase 2 — fill context explanation when AI responds.
    const contextPromise =
      !isPhrase && isCommonWord(wordOrPhrase)
        ? Promise.resolve(null)
        : context.explain(wordOrPhrase, sentence, recentLines, netflixContext);

    void contextPromise.then((contextResult) => {
      tooltip.setContext(wordOrPhrase, contextResult);
    });

    spanEl.addEventListener(
      "mouseleave",
      (e: MouseEvent) => {
        if (!tooltip.contains(e.relatedTarget)) {
          scheduleHide();
        }
      },
      { once: true },
    );
  },
  () => currentPhrases,
);

document.addEventListener("mouseover", (e: MouseEvent) => {
  const target = e.target;
  if (target instanceof HTMLElement) {
    if (target.classList.contains("nva-word") || tooltip.contains(target)) {
      cancelHide();
    } else {
      scheduleHide();
    }
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

    // Async upgrade: re-render with phrase highlights after debounce settles.
    scheduleAICalls(currentSentence);
  } else {
    if (aiDebounceTimer !== null) {
      clearTimeout(aiDebounceTimer);
      aiDebounceTimer = null;
    }
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
