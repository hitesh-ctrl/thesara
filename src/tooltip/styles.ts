const STYLE_TAG_ID = "nva-tooltip-styles";

const CSS = `
  #nva-tooltip {
    position: fixed;
    z-index: 2147483647;
    max-width: 320px;
    min-width: 220px;
    background: #111113;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 18px 20px;
    box-shadow: 0 16px 48px rgba(0,0,0,0.85), 0 1px 0 rgba(255,255,255,0.04) inset;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    pointer-events: auto;
    opacity: 0;
    transition: opacity 0.12s ease;
  }

  #nva-tooltip.nva-tooltip--visible {
    opacity: 1;
  }

  /* ── Word title ── */
  .nva-tooltip__word {
    font-size: 17px;
    font-weight: 700;
    color: #ffffff;
    margin: 0 0 4px 0;
    line-height: 1.2;
    letter-spacing: -0.3px;
  }

  /* ── Part of speech ── */
  .nva-tooltip__pos {
    font-size: 11px;
    font-weight: 600;
    color: #5b8dee;
    font-style: normal;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 0 0 14px 0;
  }

  /* ── Divider between sections ── */
  .nva-tooltip__divider {
    height: 1px;
    background: rgba(255,255,255,0.07);
    margin: 12px 0;
  }

  /* ── Section labels ── */
  .nva-tooltip__label {
    font-size: 10px;
    font-weight: 600;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin: 0 0 5px 0;
  }

  /* ── Definition ── */
  .nva-tooltip__definition {
    font-size: 13px;
    color: #d0d0d4;
    line-height: 1.6;
    margin: 0 0 14px 0;
  }

  /* ── Synonyms ── */
  .nva-tooltip__synonyms {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin: 0 0 2px 0;
    padding: 0;
    list-style: none;
  }

  .nva-tooltip__synonym {
    font-size: 11px;
    font-weight: 500;
    color: #999;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 4px;
    padding: 3px 8px;
  }

  /* ── Not found ── */
  .nva-tooltip__not-found {
    font-size: 13px;
    color: #555;
    font-style: italic;
    margin: 0;
  }

  /* ── In this scene ── */
  .nva-tooltip__label--scene {
    font-size: 10px;
    font-weight: 600;
    color: #4ade80;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin: 0 0 5px 0;
  }

  .nva-tooltip__context {
    font-size: 13px;
    color: #c0c0c4;
    line-height: 1.65;
    margin: 0;
    font-style: italic;
  }

  /* ── Loading skeleton ── */
  .nva-tooltip__skeleton {
    height: 32px;
    background: linear-gradient(90deg, #1e1e20 25%, #262628 50%, #1e1e20 75%);
    background-size: 200% 100%;
    animation: nva-shimmer 1.4s ease-in-out infinite;
    border-radius: 5px;
    margin: 4px 0;
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
