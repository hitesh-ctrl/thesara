/**
 * PlatformAdapter
 *
 * Encapsulates everything that differs between streaming platforms:
 *   - How to find the subtitle container
 *   - How to extract clean text from it
 *   - What kind of observation strategy to use (MutationObserver vs cue events)
 *   - How to read the show/episode title
 *   - Which CSS selector to hide the original subtitles while the overlay is active
 *
 * The rest of the codebase (overlay, tooltip, AI proxy) is platform-agnostic.
 */

export interface ShowContext {
  showTitle: string;
  episodeTitle: string | null;
}

export type ObservationStrategy = "mutation" | "cue";

export interface PlatformAdapter {
  /** Human-readable name for logging. */
  readonly name: string;

  /**
   * Strategy used by SubtitleObserver.
   *   "mutation" — attaches a MutationObserver to a container element.
   *   "cue"      — listens to <track> cuechange events (Apple TV+).
   */
  readonly observationStrategy: ObservationStrategy;

  /**
   * Finds the subtitle container element.
   * For "mutation" strategy: the persistent element whose children change.
   * For "cue" strategy: not used — may return null.
   */
  findSubtitleContainer(): Element | null;

  /**
   * Extracts clean, whitespace-normalised text from the subtitle container.
   * Called on every mutation by SubtitleObserver.
   */
  extractText(container: Element): string;

  /**
   * Selector for individual line wrapper elements inside the container.
   * OverlayRenderer iterates these to build one overlay line per subtitle line.
   * Return null to fall back to treating the container itself as one line.
   */
  readonly lineSelector: string | null;

  /**
   * CSS selector(s) to hide the platform's original subtitle element while
   * the interactive overlay is active. Applied via a body class rule.
   */
  readonly hideSelector: string;

  /**
   * Reads the current show and episode title from the page.
   * Used to give the AI model context for its explanations.
   */
  getShowContext(): ShowContext;
}
