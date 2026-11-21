import { injectTooltipStyles } from "./styles";
import type { DictionaryResult } from "../dictionary/types";
import type { ContextResult } from "../context/ContextExplanationService";

const TOOLTIP_ID = "nva-tooltip";
const DICT_SECTION_ID = "nva-tooltip-dict";
const CONTEXT_SECTION_ID = "nva-tooltip-context";
const VISIBLE_CLASS = "nva-tooltip--visible";
const VIEWPORT_PADDING = 12;
const TOOLTIP_OFFSET = 20;

/**
 * Manages a single reusable tooltip element.
 *
 * Three-phase rendering:
 * 1. show()       — renders immediately on hover: word title + loading skeletons.
 * 2. updateDict() — fills the definition section when the dictionary API responds.
 * 3. setContext() — fills the AI explanation when Groq responds.
 *
 * skipDict flag: set for common words and phrases — suppresses the dictionary
 * skeleton and lookup entirely since neither would be useful.
 */
export class TooltipRenderer {
  private readonly el: HTMLDivElement;
  private readonly onHide: (() => void) | null;
  private currentWord: string | null = null;
  private getSubtitleContainer: (() => Element | null) = () => null;

  constructor(onHide: (() => void) | null = null) {
    this.onHide = onHide;
    injectTooltipStyles();
    this.el = this.createElement();
    document.body.appendChild(this.el);
  }

  public setContainerFinder(fn: () => Element | null): void {
    this.getSubtitleContainer = fn;
  }

  public show(anchor: HTMLElement, word: string, skipDict = false): void {
    this.currentWord = word;
    this.el.innerHTML = "";
    this.el.appendChild(this.buildShell(word, skipDict));
    document.body.appendChild(this.el);

    this.el.style.visibility = "hidden";
    this.el.classList.add(VISIBLE_CLASS);
    this.position(anchor);
    this.el.style.visibility = "";
  }

  public updateDict(word: string, result: DictionaryResult): void {
    if (word !== this.currentWord) return;
    const section = document.getElementById(DICT_SECTION_ID);
    if (section === null) return;

    section.innerHTML = "";

    if (!result.ok) {
      if (result.error.kind !== "not_found") {
        const p = document.createElement("p");
        p.className = "nva-tooltip__not-found";
        p.textContent = "Dictionary unavailable.";
        section.appendChild(p);
      }
      this.repositionAfterReflow();
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

    this.repositionAfterReflow();
  }

  public setContext(word: string, result: ContextResult | null): void {
    if (word !== this.currentWord) return;
    const section = document.getElementById(CONTEXT_SECTION_ID);
    if (section === null) return;

    section.innerHTML = "";

    if (result === null || !result.ok) {
      return; // leave section empty — no error noise
    }

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

  // ─── Private ─────────────────────────────────────────────────────────────────

  private createElement(): HTMLDivElement {
    const existing = document.getElementById(TOOLTIP_ID);
    if (existing instanceof HTMLDivElement) return existing;
    const el = document.createElement("div");
    el.id = TOOLTIP_ID;
    return el;
  }

  private addDivider(parent: HTMLElement): void {
    const hr = document.createElement("div");
    hr.className = "nva-tooltip__divider";
    parent.appendChild(hr);
  }

  private buildShell(word: string, skipDict: boolean): DocumentFragment {
    const frag = document.createDocumentFragment();

    // ── Word title ──
    const wordEl = document.createElement("p");
    wordEl.className = "nva-tooltip__word";
    wordEl.textContent = word;
    frag.appendChild(wordEl);

    // ── Dictionary section ──
    const dictSection = document.createElement("div");
    dictSection.id = DICT_SECTION_ID;
    if (!skipDict) {
      const skel = document.createElement("div");
      skel.className = "nva-tooltip__skeleton";
      dictSection.appendChild(skel);
    }
    frag.appendChild(dictSection);

    // ── Context section — always starts with a loading skeleton ──
    const ctxSection = document.createElement("div");
    ctxSection.id = CONTEXT_SECTION_ID;

    const ctxDivider = document.createElement("div");
    ctxDivider.className = "nva-tooltip__divider nva-tooltip__divider--ctx";
    ctxSection.appendChild(ctxDivider);

    const ctxSkel = document.createElement("div");
    ctxSkel.className = "nva-tooltip__skeleton nva-tooltip__skeleton--ctx";
    ctxSection.appendChild(ctxSkel);

    frag.appendChild(ctxSection);

    return frag;
  }

  private position(anchor: HTMLElement): void {
    const tipW = this.el.offsetWidth;
    const tipH = this.el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // ── Vertical: above the subtitle container ──
    const subtitleContainer = this.getSubtitleContainer();
    let top: number;

    if (subtitleContainer !== null) {
      const subRect = subtitleContainer.getBoundingClientRect();
      top = subRect.top - tipH - TOOLTIP_OFFSET;
    } else {
      const anchorRect = anchor.getBoundingClientRect();
      top = anchorRect.top - tipH - TOOLTIP_OFFSET;
    }

    top = Math.max(VIEWPORT_PADDING, Math.min(top, vh - tipH - VIEWPORT_PADDING));

    // ── Horizontal: centred on the hovered word ──
    const anchorRect = anchor.getBoundingClientRect();
    let left = anchorRect.left + anchorRect.width / 2 - tipW / 2;
    left = Math.max(VIEWPORT_PADDING, Math.min(left, vw - tipW - VIEWPORT_PADDING));

    this.el.style.top = `${String(top)}px`;
    this.el.style.left = `${String(left)}px`;
  }

  private repositionAfterReflow(): void {
    requestAnimationFrame(() => {
      const wordSpan = document.querySelector<HTMLElement>(".nva-word:hover");
      if (wordSpan !== null) this.position(wordSpan);
    });
  }
}
