import type { PlatformAdapter, ShowContext } from "./PlatformAdapter";

/**
 * Amazon Prime Video subtitle selectors.
 * Prime Video renders subtitles in a dedicated overlay div.
 */
const CONTAINER_SELECTORS: readonly string[] = [
  "[data-testid='subtitle-container']",
  "[data-testid='timed-text-view']",
  ".atvwebplayersdk-timedtext-container",
  "[class*='timedText']",
  "[class*='subtitle']",
];

export class PrimeVideoAdapter implements PlatformAdapter {
  readonly name = "Prime Video";
  readonly observationStrategy = "mutation" as const;
  readonly lineSelector = null; // container itself holds one or two text nodes
  readonly hideSelector = [
    "[data-testid='subtitle-container']",
    "[data-testid='timed-text-view']",
    ".atvwebplayersdk-timedtext-container",
    "[class*='timedText']",
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
    // Prime sets document.title to "Show Name - Season X - Amazon Prime Video"
    const withoutSuffix = document.title
      .replace(/\s*[-–]\s*Amazon\s*Prime\s*Video\s*$/i, "")
      .replace(/\s*[-–]\s*Prime\s*Video\s*$/i, "")
      .trim();

    if (withoutSuffix) {
      // "Show Name - Season 1" or "Episode Title - Show Name"
      const parts = withoutSuffix.split(/\s*[-–]\s*/);
      if (parts.length >= 2) {
        return {
          showTitle: parts[0] ?? withoutSuffix,
          episodeTitle: parts[1] ?? null,
        };
      }
      return { showTitle: withoutSuffix, episodeTitle: null };
    }

    const domTitle = queryFirst([
      "[data-automation-id='title']",
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
