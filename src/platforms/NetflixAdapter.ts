import type { PlatformAdapter, ShowContext } from "./PlatformAdapter";
import { extractSubtitleText } from "../subtitle/extractText";

const SUBTITLE_CONTAINER_SELECTORS: readonly string[] = [
  ".player-timedtext",
  "[data-uia='player-timedtext']",
  ".watch-video--player-view .player-timedtext",
];

export class NetflixAdapter implements PlatformAdapter {
  readonly name = "Netflix";
  readonly observationStrategy = "mutation" as const;
  readonly lineSelector = ".player-timedtext-text-container";
  readonly hideSelector = ".player-timedtext";

  findSubtitleContainer(): Element | null {
    for (const sel of SUBTITLE_CONTAINER_SELECTORS) {
      const el = document.querySelector(sel);
      if (el !== null) return el;
    }
    return null;
  }

  extractText(container: Element): string {
    return extractSubtitleText(container);
  }

  getShowContext(): ShowContext {
    const fromTitle = parseNetflixTitle(document.title);
    if (fromTitle !== null) return fromTitle;

    const domTitle = queryFirst([
      "[data-uia='video-title'] h4",
      "[data-uia='video-title']",
      ".watch-title",
      ".ellipsize-text",
    ]);

    return { showTitle: domTitle ?? "this show", episodeTitle: null };
  }
}

function parseNetflixTitle(title: string): ShowContext | null {
  const withoutNetflix = title.replace(/\s*\|\s*Netflix\s*$/i, "").trim();
  if (withoutNetflix === "") return null;

  const parts = withoutNetflix.split(/\s*\|\s*/);
  if (parts.length >= 2) {
    return {
      showTitle: parts[parts.length - 1] ?? withoutNetflix,
      episodeTitle: parts[0] ?? null,
    };
  }
  return { showTitle: withoutNetflix, episodeTitle: null };
}

function queryFirst(selectors: string[]): string | null {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el?.textContent) return el.textContent.trim();
  }
  return null;
}

