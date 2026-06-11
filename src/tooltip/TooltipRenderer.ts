import { injectTooltipStyles } from "./styles";
import type { DictionaryResult } from "../dictionary/types";
import type { ContextResult } from "../context/ContextExplanationService";

const TOOLTIP_ID = "nva-tooltip";
const CONTEXT_SECTION_ID = "nva-tooltip-context";
const VISIBLE_CLASS = "nva-tooltip--visible";
const TOOLTIP_OFFSET = 12;
const VIEWPORT_PADDING = 8;

/**
 * Manages a single reusable tooltip element.
 *
 * Two-phase rendering:
 * 1. show() renders the dictionary result immediately (word, pos, definition, synonyms).
 * 2. setContext() is called once the Claude API responds — it updates the
 *    "In this scene" section in-place without rebuilding the tooltip.
 *
 * This ensures the tooltip appears instantly while context loads asynchronously.
 */
export class TooltipRenderer {
  private readonly el: HTMLDivElement;
  private readonly onHide: (() => void) | null;
  /** Tracks which word the current tooltip is for — stale context updates are ignored. */
  private currentWord: string | null = null;

  constructor(onHide: (() => void) | null = null) {
    this.onHide = onHide;
    injectTooltipStyles();
    this.el = this.createElement();
    document.body.appendChild(this.el);
  }

  /**
   * Displays the tooltip immediately with dictionary data.
   * Context explanation is shown later via setContext().
   */
  public show(anchor: HTMLElement, word: string, result: DictionaryResult | null): void {
    this.currentWord = word;
    this.el.innerHTML = "";
    this.el.appendChild(this.buildContent(result));

    // Move tooltip to the end of body so it's always on top in DOM order.
    document.body.appendChild(this.el);

    this.el.style.visibility = "hidden";
    this.el.classList.add(VISIBLE_CLASS);
    this.el.style.visibility = "";

    this.position(anchor);
    this.el.classList.add(VISIBLE_CLASS);
  }

  /**
   * Updates the context section in-place once the Claude response arrives.
   * No-ops if the tooltip has moved to a different word since the request started.
   */
  /**
   * Updates the context section in-place.
   * Pass null to hide the section entirely (e.g. for common words).
   */
  public setContext(word: string, result: ContextResult | null): void {
    if (word !== this.currentWord) return;

    const section = document.getElementById(CONTEXT_SECTION_ID);
    if (section === null) return;

    // null = common word, no context needed — remove the section silently.
    if (result === null || !result.ok) {
      section.remove();
      return;
    }

    section.innerHTML = "";

    const label = document.createElement("p");
    label.className = "nva-tooltip__label";
    label.textContent = "In this scene";
    section.appendChild(label);

    const text = document.createElement("p");
    text.className = "nva-tooltip__context";
    text.textContent = result.explanation;
    section.appendChild(text);
  }

  /** Hides and clears the tooltip, then fires the onHide callback. */
  public hide(): void {
    if (!this.el.classList.contains(VISIBLE_CLASS)) return;
    this.currentWord = null;
    this.el.classList.remove(VISIBLE_CLASS);
    this.onHide?.();
  }

  /** Returns true if the mouse event target is inside the tooltip. */
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

  private buildContent(result: DictionaryResult | null): DocumentFragment {
    const frag = document.createDocumentFragment();

    // Phrase token — no dictionary data, just show the phrase as title and
    // let the context section fill in with the AI explanation.
    if (result === null) {
      const wordEl = document.createElement("p");
      wordEl.className = "nva-tooltip__word";
      wordEl.textContent = this.currentWord ?? "";
      frag.appendChild(wordEl);

      const tagEl = document.createElement("p");
      tagEl.className = "nva-tooltip__pos";
      tagEl.textContent = "phrase / idiom";
      frag.appendChild(tagEl);

      frag.appendChild(this.buildContextSection());
      return frag;
    }

    if (!result.ok) {
      const p = document.createElement("p");
      p.className = "nva-tooltip__not-found";
      p.textContent =
        result.error.kind === "not_found"
          ? "No definition found."
          : "Could not load definition.";
      frag.appendChild(p);
      // Still add empty context section — context might load independently.
      frag.appendChild(this.buildContextSection());
      return frag;
    }

    const { word, partOfSpeech, definition, synonyms } = result.data;

    const wordEl = document.createElement("p");
    wordEl.className = "nva-tooltip__word";
    wordEl.textContent = word;
    frag.appendChild(wordEl);

    const posEl = document.createElement("p");
    posEl.className = "nva-tooltip__pos";
    posEl.textContent = partOfSpeech;
    frag.appendChild(posEl);

    const defLabel = document.createElement("p");
    defLabel.className = "nva-tooltip__label";
    defLabel.textContent = "Definition";
    frag.appendChild(defLabel);

    const defEl = document.createElement("p");
    defEl.className = "nva-tooltip__definition";
    defEl.textContent = definition;
    frag.appendChild(defEl);

    if (synonyms.length > 0) {
      const synLabel = document.createElement("p");
      synLabel.className = "nva-tooltip__label";
      synLabel.textContent = "Synonyms";
      frag.appendChild(synLabel);

      const synList = document.createElement("ul");
      synList.className = "nva-tooltip__synonyms";
      for (const syn of synonyms) {
        const li = document.createElement("li");
        li.className = "nva-tooltip__synonym";
        li.textContent = syn;
        synList.appendChild(li);
      }
      frag.appendChild(synList);
    }

    // Context section — populated later by setContext().
    frag.appendChild(this.buildContextSection());

    return frag;
  }

  /**
   * Builds an empty context section placeholder.
   * Populated by setContext() once the API responds, or removed silently
   * if no context is available.
   */
  private buildContextSection(): HTMLDivElement {
    const section = document.createElement("div");
    section.id = CONTEXT_SECTION_ID;
    return section;
  }

  private position(anchor: HTMLElement): void {
    const rect = anchor.getBoundingClientRect();
    const tipW = this.el.offsetWidth;
    const tipH = this.el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = rect.top - tipH - TOOLTIP_OFFSET;
    if (top < VIEWPORT_PADDING) top = rect.bottom + TOOLTIP_OFFSET;
    top = Math.min(top, vh - tipH - VIEWPORT_PADDING);
    top = Math.max(top, VIEWPORT_PADDING);

    let left = rect.left;
    left = Math.min(left, vw - tipW - VIEWPORT_PADDING);
    left = Math.max(left, VIEWPORT_PADDING);

    this.el.style.top = `${top}px`;
    this.el.style.left = `${left}px`;
  }
}
