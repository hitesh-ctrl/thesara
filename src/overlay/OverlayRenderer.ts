import { tokenize, mergePhrasesIntoTokens } from "../subtitle/WordProcessor";
import { findSubtitleContainer } from "../subtitle/netflixSelectors";
import { injectStyles } from "./styles";
import type { WordToken } from "../subtitle/types";

type GetPhrasesFn = () => string[];

const OVERLAY_ROOT_ID = "nva-overlay-root";
const TEXT_CONTAINER_SELECTOR = ".player-timedtext-text-container";

/**
 * How long to keep the overlay visible after a subtitle disappears.
 * Gives the user time to move their mouse onto a word before it vanishes.
 */
const CLEAR_GRACE_PERIOD_MS = 1500;

/**
 * Renders interactive word spans in a fixed-position overlay outside Netflix's
 * React DOM tree.
 *
 * Why not inject directly into Netflix's subtitle DOM:
 *   Netflix's player is built on React. Its reconciler detects unexpected DOM
 *   mutations inside managed containers and immediately removes injected nodes.
 *
 * Overlay strategy:
 *   A fixed #nva-overlay-root div is appended to document.body. On each subtitle
 *   event, we measure each .player-timedtext-text-container with
 *   getBoundingClientRect() and mirror its position and font in the overlay.
 *   Netflix's original text is hidden via a body class so React cannot reset it.
 *
 * Grace period + hover freeze (solves rapid subtitle changes):
 *   When a subtitle clears, the overlay is NOT removed immediately. Instead:
 *   - A 1.5s grace period timer starts.
 *   - If a new subtitle arrives before the timer fires, it replaces the overlay.
 *   - If the user hovers a word before the timer fires, the timer is cancelled
 *     and the overlay stays frozen until the mouse leaves.
 *   - Only after both conditions are clear does the overlay actually disappear.
 */
export class OverlayRenderer {
  private overlayRoot: HTMLDivElement | null = null;
  private rafHandle: number | null = null;
  private clearTimerId: ReturnType<typeof setTimeout> | null = null;

  /** True while the mouse is over any word span in the current overlay. */
  private hoverActive = false;
  /** True when clear() was called but deferred due to an active hover. */
  private pendingClear = false;

  private readonly onWordHover: ((word: string, token: WordToken, spanEl: HTMLElement) => void) | null;
  private readonly getPhrases: GetPhrasesFn;

  constructor(
    onWordHover: ((word: string, token: WordToken, spanEl: HTMLElement) => void) | null = null,
    getPhrases: GetPhrasesFn = () => [],
  ) {
    this.onWordHover = onWordHover;
    this.getPhrases = getPhrases;
    injectStyles();
    this.overlayRoot = this.createOverlayRoot();
  }

  /**
   * Schedules a render on the next animation frame.
   * Cancels any pending clear — a new subtitle always takes priority.
   */
  public render(): void {
    this.cancelClearTimer();
    this.pendingClear = false;

    if (this.rafHandle !== null) cancelAnimationFrame(this.rafHandle);
    this.rafHandle = requestAnimationFrame(() => {
      this.rafHandle = null;
      this.renderNow();
    });
  }

  /**
   * Requests a clear with a grace period.
   * If the user is hovering a word, the clear is deferred until they leave.
   */
  public clear(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }

    if (this.hoverActive) {
      // Don't clear yet — user is interacting. Clear when hover ends.
      this.pendingClear = true;
      return;
    }

    // Start grace period — keep overlay visible a little longer.
    this.cancelClearTimer();
    this.clearTimerId = setTimeout(() => {
      this.clearTimerId = null;
      this.executeClear();
    }, CLEAR_GRACE_PERIOD_MS);
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private renderNow(): void {
    const container = findSubtitleContainer();
    if (container === null) return;

    const textContainers = container.querySelectorAll<HTMLElement>(TEXT_CONTAINER_SELECTOR);
    if (textContainers.length === 0) return;

    const root = this.ensureOverlayRoot();
    this.clearOverlayDOM();

    for (const textContainer of Array.from(textContainers)) {
      const line = this.buildLineElement(textContainer);
      if (line !== null) root.appendChild(line);
    }

    this.setOverlayActive(true);
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

  private buildLineElement(textContainer: HTMLElement): HTMLDivElement | null {
    const text = textContainer.textContent?.trim() ?? "";
    if (text === "") return null;

    const rect = textContainer.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const styledSpan =
      textContainer.querySelector<HTMLElement>("span span") ??
      textContainer.querySelector<HTMLElement>("span") ??
      textContainer;
    const cs = getComputedStyle(styledSpan);

    const line = document.createElement("div");
    line.style.cssText = [
      "position: fixed",
      `left: ${rect.left}px`,
      `top: ${rect.top}px`,
      `width: ${rect.width}px`,
      `min-height: ${rect.height}px`,
      "pointer-events: none",
      "display: block",
      `font-family: ${cs.fontFamily}`,
      `font-size: ${cs.fontSize}`,
      `font-weight: ${cs.fontWeight}`,
      `color: ${cs.color}`,
      `text-shadow: ${cs.textShadow}`,
      `line-height: ${cs.lineHeight}`,
      "white-space: pre",
      "z-index: 2147483640",
    ].join(";");

    // Tokenize this container's text independently, then merge any detected
    // phrases. Each container gets its own tokenization so multi-line subtitles
    // (split across two containers) never bleed tokens into each other.
    const phrases = this.getPhrases();
    const tokens = mergePhrasesIntoTokens(tokenize(text), phrases);

    for (const token of tokens) {
      if (token.isWord) {
        line.appendChild(this.createWordSpan(token));
      } else {
        line.appendChild(document.createTextNode(token.text));
      }
    }

    return line;
  }

  private createWordSpan(token: WordToken): HTMLElement {
    const span = document.createElement("span");
    span.className = "nva-word";
    span.textContent = token.text;
    span.dataset["nvaIndex"] = String(token.index);
    if (token.isPhrase) span.dataset["nvaPhrase"] = "true";

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

    return span;
  }

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

  private setOverlayActive(active: boolean): void {
    document.body.classList.toggle("nva-overlay-active", active);
  }
}
