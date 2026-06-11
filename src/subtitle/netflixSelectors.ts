/**
 * Centralized Netflix DOM selectors.
 *
 * Netflix updates its DOM periodically. All selectors live here so that a
 * single-file change is sufficient to adapt to platform updates.
 *
 * Selectors are ordered from most specific / most stable to least specific.
 */

/**
 * Candidate selectors for the persistent subtitle container.
 * The observer attaches to whichever element is found first.
 *
 * This element persists across subtitle changes — only its children are swapped.
 */
export const SUBTITLE_CONTAINER_SELECTORS: readonly string[] = [
  ".player-timedtext",
  "[data-uia='player-timedtext']",
  ".watch-video--player-view .player-timedtext",
] as const;

/**
 * Selector for individual subtitle text wrapper elements inside the container.
 * Each line of a subtitle block is typically one of these.
 */
export const SUBTITLE_TEXT_CONTAINER_SELECTOR =
  ".player-timedtext-text-container";

/**
 * Finds the first matching Netflix subtitle container element in the document.
 * Returns null if none are present yet (Netflix hasn't rendered the player).
 */
export function findSubtitleContainer(): Element | null {
  for (const selector of SUBTITLE_CONTAINER_SELECTORS) {
    const el = document.querySelector(selector);
    if (el !== null) return el;
  }
  return null;
}

/**
 * Extracts clean subtitle text from a container element.
 *
 * Netflix splits subtitle lines across multiple <span> elements for styling.
 * This joins all descendant text nodes, collapsing internal whitespace.
 */
export function extractTextFromContainer(container: Element): string {
  return (container.textContent ?? "").replace(/\s+/g, " ").trim();
}
