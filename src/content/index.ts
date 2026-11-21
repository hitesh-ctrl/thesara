import { detectPlatform } from "../platforms/detectPlatform";
import { SubtitleObserver } from "../subtitle/SubtitleObserver";
import { OverlayRenderer } from "../overlay/OverlayRenderer";
import { DictionaryService } from "../dictionary/DictionaryService";
import { ContextExplanationService } from "../context/ContextExplanationService";
import { TooltipRenderer } from "../tooltip/TooltipRenderer";
import { VideoController } from "../player/VideoController";
import { isCommonWord } from "../subtitle/commonWords";
import { PhraseDetector } from "../subtitle/PhraseDetector";
import { QuotaDisclosureUI } from "../quota/QuotaDisclosureUI";
import type { SubtitleUpdate } from "../subtitle/types";

console.log(
  "%c[Thesara] Content script loaded ✓",
  "color: #e50914; font-weight: bold; font-size: 14px;",
);

// ── Platform detection ────────────────────────────────────────────────────────

const adapter = detectPlatform();
if (adapter === null) {
  // Not a supported platform — bail out silently.
  // eslint-disable-next-line no-throw-literal
  throw new Error("[Thesara] Unsupported platform — extension will not activate.");
}

// ── Services ──────────────────────────────────────────────────────────────────

const dictionary = new DictionaryService();
const context = new ContextExplanationService();
const phraseDetector = new PhraseDetector();
const video = new VideoController();

const quotaUI = new QuotaDisclosureUI();
quotaUI.init();

const tooltip = new TooltipRenderer(() => {
  video.resume();
});

// ── State ─────────────────────────────────────────────────────────────────────

let currentSentence = "";

const HISTORY_SIZE = 6;
const subtitleHistory: string[] = [];

let currentPhrases: string[] = [];

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

let aiDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const AI_DEBOUNCE_MS = 300;

function scheduleAICalls(sentence: string): void {
  if (aiDebounceTimer !== null) clearTimeout(aiDebounceTimer);
  aiDebounceTimer = setTimeout(() => {
    aiDebounceTimer = null;
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

// ── Overlay ───────────────────────────────────────────────────────────────────

const overlay = new OverlayRenderer(
  adapter,
  (wordOrPhrase, token, spanEl) => {
    cancelHide();
    video.pause();

    const sentence = currentSentence;
    const recentLines = [...subtitleHistory];
    const showContext = adapter.getShowContext();
    const isPhrase = token.isPhrase === true;

    tooltip.show(spanEl, wordOrPhrase);

    if (!isPhrase) {
      void dictionary.lookup(wordOrPhrase).then((result) => {
        tooltip.updateDict(wordOrPhrase, result);
      });
    }

    const contextPromise =
      !isPhrase && isCommonWord(wordOrPhrase)
        ? Promise.resolve(null)
        : context.explain(wordOrPhrase, sentence, recentLines, showContext);

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

// ── Global mouse handler ──────────────────────────────────────────────────────

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

// ── Subtitle handling ─────────────────────────────────────────────────────────

function handleSubtitleUpdate(update: SubtitleUpdate): void {
  if (update.kind === "subtitle") {
    if (currentSentence !== "") {
      subtitleHistory.push(currentSentence);
      if (subtitleHistory.length > HISTORY_SIZE) subtitleHistory.shift();
    }
    currentSentence = update.event.text;
    currentPhrases = [];
    overlay.render();
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

// ── Observer ──────────────────────────────────────────────────────────────────

const observer = new SubtitleObserver(adapter, (update) => {
  handleSubtitleUpdate(update);
});

// Wire the overlay and tooltip container references so they stay in sync with
// the observer's ResizeObserver (fires on player resize / fullscreen toggle).
let currentContainer: Element | null = null;
observer.setOnContainerReady((container) => {
  currentContainer = container;
  overlay.setContainer(container);
  overlay.render();
});
tooltip.setContainerFinder(() => currentContainer);

observer.registerUnloadCleanup();
observer.start();
