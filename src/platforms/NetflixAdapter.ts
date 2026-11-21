import type { PlatformAdapter, ShowContext } from "./PlatformAdapter";

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
    return extractTextFromNodes(container);
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

/**
 * Walks child nodes rather than relying on textContent alone.
 * Some subtitle styles wrap each word in its own <span> with no space between
 * them — inserting a space at element boundaries recovers correct word spacing.
 */
function extractTextFromNodes(root: Element): string {
  const parts: string[] = [];
  walkNodes(root, parts);
  return parts.join("").replace(/\s+/g, " ").trim();
}

function walkNodes(node: Node, out: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = node.textContent ?? "";
    if (t) out.push(t);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const el = node as Element;
  const display = getComputedStyle(el).display;
  // Block / flex elements imply a visual line break — treat as a space.
  const isBlock = display === "block" || display === "flex" || display === "grid";
  if (isBlock && out.length > 0 && !out[out.length - 1]?.endsWith(" ")) {
    out.push(" ");
  }

  for (const child of Array.from(node.childNodes)) {
    walkNodes(child, out);
  }

  if (isBlock && out.length > 0 && !out[out.length - 1]?.endsWith(" ")) {
    out.push(" ");
  }
}
