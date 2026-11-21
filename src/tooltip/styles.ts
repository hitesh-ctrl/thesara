const STYLE_TAG_ID = "nva-tooltip-styles";

const CSS = `
  #nva-tooltip {
    position: fixed;
    z-index: 2147483647;
    max-width: 340px;
    min-width: 230px;
    background: #0f1012;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    padding: 18px 20px 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.9), 0 1px 0 rgba(255,255,255,0.05) inset;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    pointer-events: auto;
    opacity: 0;
    transition: opacity 0.1s ease;
    will-change: opacity, top, left;
  }

  #nva-tooltip.nva-tooltip--visible {
    opacity: 1;
  }

  /* ── Word title ── */
  .nva-tooltip__word {
    font-size: 18px;
    font-weight: 700;
    color: #fff;
    margin: 0 0 2px;
    line-height: 1.2;
    letter-spacing: -0.4px;
  }

  /* ── Part of speech tag ── */
  .nva-tooltip__pos {
    font-size: 10px;
    font-weight: 700;
    color: #4d8ef0;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 12px;
  }

  /* ── Dividers ── */
  .nva-tooltip__divider {
    height: 1px;
    background: rgba(255,255,255,0.07);
    margin: 10px 0;
  }

  /* ── Section labels ── */
  .nva-tooltip__label {
    font-size: 10px;
    font-weight: 600;
    color: #444;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin: 0 0 5px;
  }

  /* ── Definition ── */
  .nva-tooltip__definition {
    font-size: 13.5px;
    color: #ccc;
    line-height: 1.6;
    margin: 0 0 12px;
  }

  /* ── Synonyms ── */
  .nva-tooltip__synonyms {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin: 0 0 2px;
    padding: 0;
    list-style: none;
  }

  .nva-tooltip__synonym {
    font-size: 11px;
    font-weight: 500;
    color: #888;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 4px;
    padding: 3px 8px;
  }

  /* ── Not found ── */
  .nva-tooltip__not-found {
    font-size: 13px;
    color: #444;
    font-style: italic;
    margin: 0;
  }

  /* ── "In this scene" label ── */
  .nva-tooltip__label--scene {
    font-size: 10px;
    font-weight: 700;
    color: #3ecf5e;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin: 0 0 6px;
  }

  /* ── Context / scene explanation ── */
  .nva-tooltip__context {
    font-size: 13px;
    color: #b8b8c0;
    line-height: 1.65;
    margin: 0;
    font-style: italic;
  }

  /* ── Loading skeletons ── */
  .nva-tooltip__skeleton {
    height: 28px;
    background: linear-gradient(90deg, #18191c 25%, #22232a 50%, #18191c 75%);
    background-size: 200% 100%;
    animation: nva-shimmer 1.5s ease-in-out infinite;
    border-radius: 5px;
    margin: 4px 0;
  }

  /* Context skeleton is slightly narrower to feel distinct */
  .nva-tooltip__skeleton--ctx {
    height: 20px;
    width: 90%;
  }

  /* The context divider + skeleton shown while Groq is loading */
  .nva-tooltip__divider--ctx {
    margin-top: 10px;
    opacity: 0.5;
  }

  @keyframes nva-shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`;

export function injectTooltipStyles(): void {
  if (document.getElementById(STYLE_TAG_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_TAG_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}
