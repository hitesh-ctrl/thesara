import { injectTooltipStyles } from "./styles";
import { findSubtitleContainer } from "../subtitle/netflixSelectors";
import type { DictionaryResult } from "../dictionary/types";
import type { ContextResult } from "../context/ContextExplanationService";

const TOOLTIP_ID = "nva-tooltip";
const DICT_SECTION_ID = "nva-tooltip-dict";
const CONTEXT_SECTION_ID = "nva-tooltip-context";
const VISIBLE_CLASS = "nva-tooltip--visible";
const VIEWPORT_PADDING = 12;
const TOOLTIP_OFFSET = 16;

/**
 * Manages a single reusable tooltip element.
 *
 * Three-phase rendering:
 * 1. show()       — renders immediately on hover with just the word name + loading skeletons.
 * 2. updateDict() — fills in definition/synonyms when the dictionary API responds.
 * 3. setContext() — fills in the AI explanation when Groq responds.
 *
 * Positioning: always anchored above the subtitle container, not the individual word.
 * This keeps the tooltip in a predictable place and prevents it covering subtitles.
 */
export class TooltipRenderer {
  private readonly el: HTMLDivElement;
  private readonly onHide: (() => void) | null;
  private currentWord: string | null = null;

  constructor(onHide: (() => void) | null = null) {
    this.onHide = onHide;
    injectTooltipStyles();
    this.el = this.createElement();
    document.body.appendChild(this.el);
  }

  /**
   * Shows the tooltip immediately with just the word/phrase name.
   * Dictionary and context sections start as loading skeletons.
   */
  public show(anchor: HTMLElement, word: string, _unused: DictionaryResult | null): void {
    this.currentWord = word;
    this.el.innerHTML = "";
    this.el.appendChild(this.buildShell(word));
    document.body.appendChild(this.el);

    this.el.style.visibility = "hidden";
    this.el.classList.add(VISIBLE_CLASS);
    this.position(anchor);
    this.el.style.visibility = "";
  }

  /**
   * Fills in the dictionary section in-place.
   * Called once the dictionary API responds — no tooltip rebuild needed.
   */
  public updateDict(word: string, result: DictionaryResult): void {
    if (word !== this.currentWord) return;
    const section = document.getElementById(DICT_SECTION_ID);
    if (section === null) return;

    section.innerHTML = "";

    if (!result.ok) {
      const p = document.createElement("p");
      p.className = "nva-tooltip__not-found";
      if (result.error.kind === "not_found") {
        p.textContent = "No definition found.";
      } else {
        p.textContent = "Dictionary unavailable — check your connection.";
      }
      section.appendChild(p);
      return;
    }

    const { partOfSpeech, definition, synonyms } = result.data;

    const posEl = document.createElement("p");
    posEl.className = "nva-tooltip__pos";
    posEl.textContent = partOfSpeech;
    section.appendChild(posEl);

    this.addDivider(section);

    const defLabel = document.createElement("p");
    defLabel.className = "nva-tooltip__label";
    defLabel.textContent = "Definition";
    section.appendChild(defLabel);

    const defEl = document.createElement("p");
    defEl.className = "nva-tooltip__definition";
    defEl.textContent = definition;
    section.appendChild(defEl);

    if (synonyms.length > 0) {
      const synLabel = document.createElement("p");
      synLabel.className = "nva-tooltip__label";
      synLabel.textContent = "Synonyms";
      section.appendChild(synLabel);

      const synList = document.createElement("ul");
      synList.className = "nva-tooltip__synonyms";
      for (const syn of synonyms) {
        const li = document.createElement("li");
        li.className = "nva-tooltip__synonym";
        li.textContent = syn;
        synList.appendChild(li);
      }
      section.appendChild(synList);
    }

    // Re-position after content changes size.
    this.repositionAfterReflow();
  }

  private addDivider(parent: HTMLElement): void {
    const hr = document.createElement("div");
    hr.className = "nva-tooltip__divider";
    parent.appendChild(hr);
  }

  /**
   * Fills in the context section in-place once the AI responds.
   * Pass null to silently remove the placeholder (common words).
   */
  public setContext(word: string, result: ContextResult | null): void {
    if (word !== this.currentWord) return;
    const section = document.getElementById(CONTEXT_SECTION_ID);
    if (section === null) return;

    if (result === null || !result.ok) {
      section.remove();
      return;
    }

    section.innerHTML = "";

    this.addDivider(section);

    const label = document.createElement("p");
    label.className = "nva-tooltip__label--scene";
    label.textContent = "In this scene";
    section.appendChild(label);

    const text = document.createElement("p");
    text.className = "nva-tooltip__context";
    text.textContent = result.explanation;
    section.appendChild(text);

    this.repositionAfterReflow();
  }

  public hide(): void {
    if (!this.el.classList.contains(VISIBLE_CLASS)) return;
    this.currentWord = null;
    this.el.classList.remove(VISIBLE_CLASS);
    this.onHide?.();
  }

  public contains(target: EventTarget | null): boolean {
    return target instanceof Node && this.el.contains(target);
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private createElement(): HTMLDivElement {
    const existing = document.getElementById(TOOLTIP_ID);
    if (existing instanceof HTMLDivElement) return existing;
    const el = document.createElement("div");
    el.id = TOOLTIP_ID;
    return el;
  }

  /**
   * Builds the initial tooltip shell with the word title and loading skeletons.
   */
  private buildShell(word: string): DocumentFragment {
    const frag = document.createDocumentFragment();

    const wordEl = document.createElement("p");
    wordEl.className = "nva-tooltip__word";
    wordEl.textContent = word;
    frag.appendChild(wordEl);

    // Dictionary section — starts as a skeleton, filled by updateDict().
    const dictSection = document.createElement("div");
    dictSection.id = DICT_SECTION_ID;
    const skeleton = document.createElement("div");
    skeleton.className = "nva-tooltip__skeleton";
    dictSection.appendChild(skeleton);
    frag.appendChild(dictSection);

    // Context section — starts empty, filled by setContext().
    const ctxSection = document.createElement("div");
    ctxSection.id = CONTEXT_SECTION_ID;
    frag.appendChild(ctxSection);

    return frag;
  }

  /**
   * Positions the tooltip above the subtitle container.
   *
   * Strategy:
   *   1. Find the Netflix subtitle container and anchor above it — this keeps
   *      the tooltip in a consistent, predictable position above the subtitles.
   *   2. Horizontally centre on the hovered word, clamped to the viewport.
   *   3. If no subtitle container is found, fall back to above the anchor element.
   */
  private position(anchor: HTMLElement): void {
    const tipW = this.el.offsetWidth;
    const tipH = this.el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // ── Vertical: above the subtitle container ──────────────────────────────
    const subtitleContainer = findSubtitleContainer();
    let top: number;

    if (subtitleContainer !== null) {
      const subRect = subtitleContainer.getBoundingClientRect();
      top = subRect.top - tipH - TOOLTIP_OFFSET;
    } else {
      const anchorRect = anchor.getBoundingClientRect();
      top = anchorRect.top - tipH - TOOLTIP_OFFSET;
    }

    // Hard floor/ceiling.
    top = Math.max(VIEWPORT_PADDING, Math.min(top, vh - tipH - VIEWPORT_PADDING));

    // ── Horizontal: centred on the hovered word ─────────────────────────────
    const anchorRect = anchor.getBoundingClientRect();
    let left = anchorRect.left + anchorRect.width / 2 - tipW / 2;
    left = Math.max(VIEWPORT_PADDING, Math.min(left, vw - tipW - VIEWPORT_PADDING));

    this.el.style.top = `${top}px`;
    this.el.style.left = `${left}px`;
  }

  /**
   * Re-runs positioning after content fills in and changes the tooltip height.
   */
  private repositionAfterReflow(): void {
    // Use rAF so the browser has rendered the new content before we measure.
    requestAnimationFrame(() => {
      const wordSpan = document.querySelector<HTMLElement>(".nva-word:hover");
      if (wordSpan !== null) this.position(wordSpan);
    });
  }
}
