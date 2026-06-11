const STYLE_TAG_ID = "nva-tooltip-styles";

const CSS = `
  #nva-tooltip {
    position: fixed;
    z-index: 2147483647;
    max-width: 300px;
    min-width: 200px;
    background: #141414;
    border: 1px solid #333;
    border-radius: 8px;
    padding: 14px 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.8);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    pointer-events: auto;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  #nva-tooltip.nva-tooltip--visible {
    opacity: 1;
  }

  .nva-tooltip__word {
    font-size: 18px;
    font-weight: 700;
    color: #ffffff;
    margin: 0 0 2px 0;
    line-height: 1.2;
  }

  .nva-tooltip__pos {
    font-size: 12px;
    color: #e50914;
    font-style: italic;
    margin: 0 0 10px 0;
    text-transform: lowercase;
  }

  .nva-tooltip__label {
    font-size: 11px;
    color: #808080;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 0 0 4px 0;
  }

  .nva-tooltip__definition {
    font-size: 14px;
    color: #e5e5e5;
    line-height: 1.5;
    margin: 0 0 12px 0;
  }

  .nva-tooltip__synonyms {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .nva-tooltip__synonym {
    font-size: 12px;
    color: #b3b3b3;
    background: #2a2a2a;
    border-radius: 4px;
    padding: 3px 8px;
  }

  .nva-tooltip__not-found {
    font-size: 13px;
    color: #808080;
    font-style: italic;
    margin: 0;
  }

  .nva-tooltip__context {
    font-size: 13px;
    color: #e5e5e5;
    line-height: 1.5;
    margin: 0;
    font-style: italic;
  }

  .nva-tooltip__context-loading {
    font-size: 12px;
    color: #555;
    margin: 0;
    font-style: italic;
  }
`;

export function injectTooltipStyles(): void {
  if (document.getElementById(STYLE_TAG_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_TAG_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}
