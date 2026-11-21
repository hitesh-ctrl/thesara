import type { PlatformAdapter, ShowContext } from "./PlatformAdapter";
import { extractSubtitleText } from "../subtitle/extractText";

/**
 * Max (HBO Max) subtitle selectors.
 * Max renders subtitles in a fixed-position overlay.
 */
const CONTAINER_SELECTORS: readonly string[] = [
  "[data-testid='player-subtitles']",
  "[class*='SubtitleContainer']",
  "[class*='subtitle-container']",
  ".vp-subtitle",
  "[class*='CaptionContainer']",
  "[class*='caption']",
];

export class HBOMaxAdapter implements PlatformAdapter {
  readonly name = "Max";
  readonly observationStrategy = "mutation" as const;
  readonly lineSelector = "[class*='SubtitleLine'], [class*='CaptionLine'], p";
  readonly hideSelector = [
    "[data-testid='player-subtitles']",
    "[class*='SubtitleContainer']",
    "[class*='CaptionContainer']",
    ".vp-subtitle",
  ].join(", ");

  findSubtitleContainer(): Element | null {
    for (const sel of CONTAINER_SELECTORS) {
      const el = document.querySelector(sel);
      if (el !== null) return el;
    }
    return null;
  }

  extractText(container: Element): string {
    return extractSubtitleText(container);
  }

  getShowContext(): ShowContext {
    // Max sets title to "Episode Title | Show | Max" or "Movie | Max"
    const withoutSuffix = document.title
      .replace(/\s*\|\s*Max\s*$/i, "")
      .replace(/\s*\|\s*HBO\s*Max\s*$/i, "")
      .trim();

    if (withoutSuffix) {
      const parts = withoutSuffix.split(/\s*\|\s*/);
      if (parts.length >= 2) {
        return {
          showTitle: parts[parts.length - 1] ?? withoutSuffix,
          episodeTitle: parts[0] ?? null,
        };
      }
      return { showTitle: withoutSuffix, episodeTitle: null };
    }

    const domTitle = queryFirst([
      "[data-testid='hero-title']",
      "[class*='title']",
      "h1",
    ]);
    return { showTitle: domTitle ?? "this show", episodeTitle: null };
  }
}

function queryFirst(selectors: string[]): string | null {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el?.textContent) return el.textContent.trim();
  }
  return null;
}

