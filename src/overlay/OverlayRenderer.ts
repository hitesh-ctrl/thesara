import { tokenize, mergePhrasesIntoTokens } from "../subtitle/WordProcessor";
import { extractSubtitleText } from "../subtitle/extractText";
import { injectStyles } from "./styles";
import type { PlatformAdapter } from "../platforms/PlatformAdapter";
import type { WordToken } from "../subtitle/types";

type GetPhrasesFn = () => string[];

const OVERLAY_ROOT_ID = "nva-overlay-root";
const CLEAR_GRACE_PERIOD_MS = 1500;

/**
 * Renders interactive word spans over subtitle text.
 *
 * Two rendering strategies depending on the platform adapter:
 *
 *  "mutation" (Netflix, Disney+, Prime Video, Max):
 *    Position-based overlay — the original subtitle element stays visible.
 *    We walk its text nodes, use document.createRange() to get each word's
 *    exact bounding rect, then place a transparent interactive <span> at that
 *    position in a fixed-position overlay root. This handles all word-per-span
 *    and character-per-span layouts without needing to recreate the subtitle
 *    text, so sounds (♪, [sound]) and styling are always preserved.
 *
 *  "cue" (Apple TV+):
 *    Text-recreation overlay — native VTT is suppressed by SubtitleObserver.
 *    We tokenize the subtitle text (from setCurrentText) and render it in a
 *    fixed bottom-center div that visually replaces the native render.
 */
export class OverlayRenderer {
  private overlayRoot: HTMLDivElement | null = null;
  private rafHandle: number | null = null;
  private clearTimerId: ReturnType<typeof setTimeout> | null = null;
  private hoverActive = false;
  private pendingClear = false;

  private subtitleContainer: Element | null = null;
  private currentText: string | null = null;

  private readonly adapter: PlatformAdapter;
  private readonly onWordHover: ((word: string, token: WordToken, spanEl: HTMLElement) => void) | null;
  private readonly getPhrases: GetPhrasesFn;

  constructor(
    adapter: PlatformAdapter,
    onWordHover: ((word: string, token: WordToken, spanEl: HTMLElement) => void) | null = null,
    getPhrases: GetPhrasesFn = () => [],
  ) {
    this.adapter = adapter;
    this.onWordHover = onWordHover;
    this.getPhrases = getPhrases;
    injectStyles(adapter.hideSelector);
    this.overlayRoot = this.createOverlayRoot();
  }

  public setContainer(container: Element): void {
    this.subtitleContainer = container;
  }

  /**
   * Store the subtitle text for the text-recreation path (Apple TV+).
   * Also used to sync phrase detection for position-based rendering.
   */
  public setCurrentText(text: string | null): void {
    this.currentText = text;
  }

  public render(): void {
    this.cancelClearTimer();
    this.pendingClear = false;
    if (this.rafHandle !== null) cancelAnimationFrame(this.rafHandle);
    this.rafHandle = requestAnimationFrame(() => {
      this.rafHandle = null;
      this.renderNow();
    });
  }

  public clear(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    if (this.hoverActive) {
      this.pendingClear = true;
      return;
    }
    this.cancelClearTimer();
    this.clearTimerId = setTimeout(() => {
      this.clearTimerId = null;
      this.executeClear();
    }, CLEAR_GRACE_PERIOD_MS);
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private renderNow(): void {
    const root = this.ensureOverlayRoot();
    this.clearOverlayDOM();

    if (this.adapter.observationStrategy === "mutation") {
      this.renderPositionBased(root);
    } else {
      this.renderTextBased(root);
    }
  }

  /**
   * Position-based rendering (DOM platforms).
   *
   * Walks text nodes inside the subtitle container, creates a Range for each
   * word, and places a transparent interactive span at the word's bounding rect.
   * The original subtitle element is never touched or hidden.
   */
  private renderPositionBased(root: HTMLDivElement): void {
    const container = this.subtitleContainer ?? this.adapter.findSubtitleContainer();
    if (container === null) return;

    const fullText = extractSubtitleText(container);
    if (fullText === "") return;

    const phrases = this.getPhrases();
    const wordTokenMap = buildWordToTokenMap(fullText, phrases);

    let wordIdx = 0;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);

    while (walker.nextNode()) {
      const textNode = walker.currentNode as Text;
      const text = textNode.data;

      const wordRegex = /[a-zA-Z]+(?:'[a-zA-Z]+)*/g;
      let m: RegExpExecArray | null;

      while ((m = wordRegex.exec(text)) !== null) {
        const token: WordToken = wordTokenMap.get(wordIdx) ?? {
          text: m[0],
          index: wordIdx,
          isWord: true,
        };

        const range = document.createRange();
        range.setStart(textNode, m.index);
        range.setEnd(textNode, m.index + m[0].length);

        const rect = range.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          root.appendChild(this.createPositionSpan(token, rect));
        }

        wordIdx++;
      }
    }

    // Do NOT hide original subtitle — it stays visible beneath our hover spans.
    this.setOverlayActive(false);
  }

  /**
   * Text-recreation rendering (Apple TV+ / cue-based).
   *
   * Renders the subtitle text as an interactive text block at the bottom of
   * the screen, since native VTT cues have no accessible DOM representation.
   */
  private renderTextBased(root: HTMLDivElement): void {
    const text = this.currentText;
    if (!text) return;

    const phrases = this.getPhrases();
    const tokens = mergePhrasesIntoTokens(tokenize(text), phrases);

    const line = document.createElement("div");
    line.style.cssText = [
      "position: fixed",
      "bottom: 10%",
      "left: 50%",
      "transform: translateX(-50%)",
      "max-width: 80%",
      "text-align: center",
      "font-size: 1.5vw",
      "font-weight: 600",
      "color: white",
      "text-shadow: 0 1px 3px #000, 0 0 8px #000",
      "line-height: 1.5",
      "white-space: pre-wrap",
      "word-break: break-word",
      "pointer-events: none",
      "z-index: 2147483640",
    ].join(";");

    for (const token of tokens) {
      if (token.isWord) {
        line.appendChild(this.createInlineWordSpan(token));
      } else {
        line.appendChild(document.createTextNode(token.text));
      }
    }

    root.appendChild(line);
    this.setOverlayActive(true); // triggers ::cue suppressor for Apple TV+
  }

  // ─── Span factories ───────────────────────────────────────────────────────────

  /** Transparent fixed-position span placed over a word's bounding rect. */
  private createPositionSpan(token: WordToken, rect: DOMRect): HTMLElement {
    const span = document.createElement("span");
    span.className = "nva-word";
    span.dataset["nvaIndex"] = String(token.index);
    if (token.isPhrase === true) span.dataset["nvaPhrase"] = "true";

    span.style.cssText = [
      "position: fixed",
      `left: ${String(rect.left)}px`,
      `top: ${String(rect.top)}px`,
      `width: ${String(rect.width + 1)}px`,
      `height: ${String(rect.height)}px`,
      "display: block",
      "pointer-events: auto",
    ].join(";");

    this.attachHoverHandlers(span, token);
    return span;
  }

  /** Inline word span for the text-recreation path (Apple TV+). */
  private createInlineWordSpan(token: WordToken): HTMLElement {
    const span = document.createElement("span");
    span.className = "nva-word";
    span.textContent = token.text;
    span.dataset["nvaIndex"] = String(token.index);
    if (token.isPhrase === true) span.dataset["nvaPhrase"] = "true";

    this.attachHoverHandlers(span, token);
    return span;
  }

  private attachHoverHandlers(span: HTMLElement, token: WordToken): void {
    span.addEventListener("mouseenter", () => {
      this.hoverActive = true;
      this.cancelClearTimer();
      if (this.onWordHover !== null) {
        this.onWordHover(token.text, token, span);
      }
    });

    span.addEventListener("mouseleave", () => {
      this.hoverActive = false;
      if (this.pendingClear) {
        this.executeClear();
      }
    });
  }

  // ─── Overlay root lifecycle ───────────────────────────────────────────────────

  private createOverlayRoot(): HTMLDivElement {
    const existing = document.getElementById(OVERLAY_ROOT_ID);
    if (existing instanceof HTMLDivElement) return existing;
    const div = document.createElement("div");
    div.id = OVERLAY_ROOT_ID;
    div.style.cssText = [
      "position: fixed",
      "top: 0",
      "left: 0",
      "width: 100%",
      "height: 100%",
      "pointer-events: none",
      "z-index: 2147483640",
    ].join(";");
    document.body.appendChild(div);
    return div;
  }

  private ensureOverlayRoot(): HTMLDivElement {
    if (this.overlayRoot !== null && document.body.contains(this.overlayRoot)) {
      return this.overlayRoot;
    }
    this.overlayRoot = this.createOverlayRoot();
    return this.overlayRoot;
  }

  private clearOverlayDOM(): void {
    const root = this.ensureOverlayRoot();
    while (root.firstChild !== null) root.removeChild(root.firstChild);
  }

  private executeClear(): void {
    this.clearOverlayDOM();
    this.setOverlayActive(false);
    this.pendingClear = false;
    this.hoverActive = false;
  }

  private cancelClearTimer(): void {
    if (this.clearTimerId !== null) {
      clearTimeout(this.clearTimerId);
      this.clearTimerId = null;
    }
  }

  private setOverlayActive(active: boolean): void {
    document.body.classList.toggle("nva-overlay-active", active);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Builds a map from word-order-index → merged WordToken.
 *
 * For phrase tokens (which represent multiple words), all word indices within
 * the phrase map to the same merged phrase token so that hovering any word in
 * the phrase triggers the phrase tooltip.
 */
function buildWordToTokenMap(sentence: string, phrases: string[]): Map<number, WordToken> {
  const rawTokens = tokenize(sentence);
  const mergedTokens = mergePhrasesIntoTokens(rawTokens, phrases);

  const map = new Map<number, WordToken>();
  let wordIdx = 0;

  for (const mt of mergedTokens) {
    if (!mt.isWord) continue;

    if (mt.isPhrase === true) {
      const wordCount = (mt.text.match(/[a-zA-Z]+(?:'[a-zA-Z]+)*/g) ?? []).length;
      for (let i = 0; i < wordCount; i++) {
        map.set(wordIdx + i, mt);
      }
      wordIdx += wordCount;
    } else {
      map.set(wordIdx, mt);
      wordIdx++;
    }
  }

  return map;
}
