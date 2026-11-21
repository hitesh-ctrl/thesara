const STYLE_TAG_ID = "nva-styles";

const BASE_CSS = `
  /* ── Position-based word spans (DOM platforms) ── */

  /* Transparent hit target placed over each original subtitle word */
  .nva-word {
    cursor: pointer;
    pointer-events: auto;
    border-bottom: 2px solid transparent;
    transition: border-bottom-color 0.12s ease;
    border-radius: 1px;
    box-sizing: border-box;
    display: inline;        /* inline for text-recreation path */
  }

  .nva-word:hover {
    border-bottom-color: rgba(229, 9, 20, 0.85);
  }

  /* Phrase / idiom spans — persistent amber dotted underline */
  .nva-word[data-nva-phrase="true"] {
    border-bottom: 2px dotted rgba(245, 166, 35, 0.9);
  }

  .nva-word[data-nva-phrase="true"]:hover {
    border-bottom-color: rgba(245, 166, 35, 1);
  }
`;

/**
 * Platform-specific hide rule.
 *
 * DOM platforms (Netflix, Disney+, Prime Video, Max): original subtitle stays
 * visible — the position-based overlay never hides it, so no hide rule is
 * emitted for them.
 *
 * Apple TV+ (cue strategy): the native ::cue render is suppressed by
 * SubtitleObserver.injectCueSuppressor() independently. We emit a secondary
 * body-class rule here as a belt-and-suspenders fallback for the text-recreation
 * overlay mode (nva-overlay-active is set only when renderTextBased() runs).
 */
function buildHideRule(hideSelector: string): string {
  if (hideSelector.trim() === "::cue") {
    return `
  body.nva-overlay-active ::cue {
    color: transparent !important;
    text-shadow: none !important;
  }`;
  }
  // DOM-based platforms: return empty — original subtitle is never hidden.
  return "";
}

export function injectStyles(hideSelector: string): void {
  if (document.getElementById(STYLE_TAG_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_TAG_ID;
  style.textContent = BASE_CSS + buildHideRule(hideSelector);
  document.head.appendChild(style);
}
