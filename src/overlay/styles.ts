const STYLE_TAG_ID = "nva-styles";

const CSS = `
  /* Interactive word span — lives inside the fixed overlay outside Netflix's React tree */
  .nva-word {
    cursor: pointer;
    pointer-events: auto;
    border-bottom: 2px solid transparent;
    transition: border-bottom-color 0.15s ease;
    border-radius: 2px;
    padding-bottom: 1px;
    display: inline;
  }

  /* Hover state — Netflix red underline */
  .nva-word:hover {
    border-bottom-color: #e50914;
  }

  /* Phrase/idiom spans — dotted amber underline to signal they are multi-word units */
  .nva-word[data-nva-phrase="true"] {
    border-bottom: 2px dotted #f5a623;
  }

  .nva-word[data-nva-phrase="true"]:hover {
    border-bottom-color: #f5a623;
  }

  /*
   * Hide Netflix's original subtitle container while our overlay is active.
   * We toggle this class on document.body rather than setting inline styles on
   * Netflix's elements — React reconciles inline style changes on its own nodes
   * but cannot affect document.body's class list.
   */
  body.nva-overlay-active .player-timedtext {
    opacity: 0 !important;
  }
`;

/**
 * Injects the extension's CSS into the document <head> once.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function injectStyles(): void {
  if (document.getElementById(STYLE_TAG_ID) !== null) return;

  const style = document.createElement("style");
  style.id = STYLE_TAG_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}
