import type { PlatformAdapter, ShowContext } from "./PlatformAdapter";

/**
 * Disney+ subtitle selectors.
 * Disney+ renders subtitles in a React-managed container. Class names are
 * stable enough to rely on; data-testid attributes are preferred when present.
 */
const CONTAINER_SELECTORS: readonly string[] = [
  "[data-testid='subtitles-container']",
  "[data-testid='text-track-container']",
  ".subtitle-renderer",
  "[class*='SubtitleTextRenderer']",
  "[class*='subtitle']",
];

const LINE_SELECTORS: readonly string[] = [
  "[data-testid='text-track-line']",
  "[class*='TextLine']",
  "[class*='subtitleLine']",
];

export class DisneyPlusAdapter implements PlatformAdapter {
  readonly name = "Disney+";
  readonly observationStrategy = "mutation" as const;
  readonly lineSelector = this.detectLineSelector();
  readonly hideSelector = [
    "[data-testid='subtitles-container']",
    "[data-testid='text-track-container']",
    ".subtitle-renderer",
    "[class*='SubtitleTextRenderer']",
  ].join(", ");

  findSubtitleContainer(): Element | null {
    for (const sel of CONTAINER_SELECTORS) {
      const el = document.querySelector(sel);
      if (el !== null) return el;
    }
    return null;
  }

  extractText(container: Element): string {
    return extractTextFromNodes(container);
  }

  getShowContext(): ShowContext {
    // Disney+ sets document.title to "Episode Title | Disney+" or "Movie | Disney+"
    const withoutSuffix = document.title
      .replace(/\s*\|\s*Disney\+?\s*$/i, "")
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

    // DOM fallback
    const domTitle = queryFirst([
      "[data-testid='details-title']",
      "[class*='title']",
      "h1",
    ]);
    return { showTitle: domTitle ?? "this show", episodeTitle: null };
  }

  private detectLineSelector(): string | null {
    for (const sel of LINE_SELECTORS) {
      if (document.querySelector(sel) !== null) return sel;
    }
    return LINE_SELECTORS[0] ?? null;
  }
}

function queryFirst(selectors: string[]): string | null {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el?.textContent) return el.textContent.trim();
  }
  return null;
}

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
