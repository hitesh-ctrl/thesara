import { tokenize, mergePhrasesIntoTokens } from "../subtitle/WordProcessor";
import { injectStyles } from "./styles";
import type { PlatformAdapter } from "../platforms/PlatformAdapter";
import type { WordToken } from "../subtitle/types";

type GetPhrasesFn = () => string[];

const OVERLAY_ROOT_ID = "nva-overlay-root";

/**
 * How long to keep the overlay visible after a subtitle disappears.
 * Gives the user time to move their mouse onto a word before it vanishes.
 */
const CLEAR_GRACE_PERIOD_MS = 1500;

/**
 * Renders interactive word spans in a fixed-position overlay outside the
 * platform's player DOM tree.
 *
 * Platform-specific:
 *   - lineSelector   — which child elements to treat as individual subtitle lines.
 *   - hideSelector   — which element(s) to hide while the overlay is active.
 *
 * Both are read from the PlatformAdapter so this class is platform-agnostic.
 */
export class OverlayRenderer {
  private overlayRoot: HTMLDivElement | null = null;
  private rafHandle: number | null = null;
  private clearTimerId: ReturnType<typeof setTimeout> | null = null;
  private hoverActive = false;
  private pendingClear = false;

  private subtitleContainer: Element | null = null;

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

  /**
   * Called by SubtitleObserver once the subtitle container is located.
   * Keeps a reference so renderNow() can query line elements inside it.
   */
  public setContainer(container: Element): void {
    this.subtitleContainer = container;
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

  // ─── Private ────────────────────────────────────────────────────────────────

  private renderNow(): void {
    const container = this.subtitleContainer ?? this.adapter.findSubtitleContainer();
    if (container === null) return;

    const root = this.ensureOverlayRoot();
    this.clearOverlayDOM();

    const lineSelector = this.adapter.lineSelector;
    if (lineSelector !== null) {
      const textContainers = container.querySelectorAll<HTMLElement>(lineSelector);
      if (textContainers.length === 0) {
        // lineSelector present but no matches yet — treat whole container as one line.
        const line = this.buildLineElement(container as HTMLElement);
        if (line !== null) root.appendChild(line);
      } else {
        for (const tc of Array.from(textContainers)) {
          const line = this.buildLineElement(tc);
          if (line !== null) root.appendChild(line);
        }
      }
    } else {
      // No line selector — treat the container itself as a single line.
      const line = this.buildLineElement(container as HTMLElement);
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
    const text = (textContainer.textContent || "").trim();
    if (text === "") return null;

    const rect = textContainer.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const styledSpan =
      textContainer.querySelector<HTMLElement>("span span") ??
      textContainer.querySelector<HTMLElement>("span") ??
      textContainer;
    const cs = getComputedStyle(styledSpan);

    const left = String(rect.left);
    const top = String(rect.top);
    const width = String(rect.width);
    const minHeight = String(rect.height);

    const line = document.createElement("div");
    line.style.cssText = [
      "position: fixed",
      `left: ${left}px`,
      `top: ${top}px`,
      `width: ${width}px`,
      `min-height: ${minHeight}px`,
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
