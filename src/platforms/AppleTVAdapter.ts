import type { PlatformAdapter, ShowContext } from "./PlatformAdapter";

/**
 * Apple TV+ subtitle adapter.
 *
 * Apple TV+ uses native WebVTT — subtitles are delivered as cues on a <track>
 * element and never appear as visible DOM text nodes. We therefore use the
 * "cue" observation strategy: SubtitleObserver attaches a `cuechange` listener
 * to the active <track> rather than a MutationObserver on a container.
 *
 * findSubtitleContainer() is not used by the cue strategy; it returns null.
 * extractText() is called by SubtitleObserver with a synthetic element
 * containing the cue text, so it just returns its textContent.
 */
export class AppleTVAdapter implements PlatformAdapter {
  readonly name = "Apple TV+";
  readonly observationStrategy = "cue" as const;
  readonly lineSelector = null;
  readonly hideSelector = "::cue"; // injected via style sheet — see SubtitleObserver

  findSubtitleContainer(): Element | null {
    return null;
  }

  extractText(container: Element): string {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    return (container.textContent ?? "").replace(/\s+/g, " ").trim();
  }

  getShowContext(): ShowContext {
    // Apple TV+ title: "Episode Title | Apple TV+"
    const withoutSuffix = document.title
      .replace(/\s*\|\s*Apple\s*TV\+?\s*$/i, "")
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
      "[data-testid='uts-shelfTitle']",
      "[class*='title']",
      "h1",
    ]);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
