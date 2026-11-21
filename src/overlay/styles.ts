const STYLE_TAG_ID = "nva-styles";

const BASE_CSS = `
  /* Interactive word span — lives inside the fixed overlay */
  .nva-word {
    cursor: pointer;
    pointer-events: auto;
    border-bottom: 2px solid transparent;
    transition: border-bottom-color 0.15s ease;
    border-radius: 2px;
    padding-bottom: 1px;
    display: inline;
  }

  .nva-word:hover {
    border-bottom-color: #e50914;
  }

  /* Phrase/idiom spans — dotted amber underline */
  .nva-word[data-nva-phrase="true"] {
    border-bottom: 2px dotted #f5a623;
  }

  .nva-word[data-nva-phrase="true"]:hover {
    border-bottom-color: #f5a623;
  }
`;

/**
 * Builds the platform-specific hide rule.
 * While the overlay is active, we hide the platform's original subtitle element
 * so only our interactive overlay is visible.
 */
function buildHideRule(hideSelector: string): string {
  // The ::cue selector cannot be scoped to a body class — it must be global.
  if (hideSelector.trim() === "::cue") {
    return `
  body.nva-overlay-active ::cue {
    color: transparent !important;
    text-shadow: none !important;
  }`;
  }
  return `
  body.nva-overlay-active ${hideSelector} {
    opacity: 0 !important;
  }`;
}

/**
 * Injects the extension's CSS once per page, parameterised by the platform's
 * subtitle hide selector. Safe to call multiple times — subsequent calls are
 * no-ops if the style tag already exists.
 */
export function injectStyles(hideSelector: string): void {
  if (document.getElementById(STYLE_TAG_ID) !== null) return;

  const style = document.createElement("style");
  style.id = STYLE_TAG_ID;
  style.textContent = BASE_CSS + buildHideRule(hideSelector);
  document.head.appendChild(style);
}
