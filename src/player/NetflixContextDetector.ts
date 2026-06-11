/**
 * Information about the currently playing Netflix title.
 */
export interface NetflixContext {
  /** Show or movie title, e.g. "Breaking Bad" */
  showTitle: string;
  /** Episode title if available, e.g. "Ozymandias" */
  episodeTitle: string | null;
}

/**
 * Extracts the show title and episode name from the Netflix watch page.
 *
 * Detection strategy (in order of reliability):
 *   1. document.title — Netflix sets this to "Episode Title | Show Title | Netflix"
 *      or "Show Title | Netflix" for movies. Always present, always current.
 *   2. DOM selector fallback for the in-player title element.
 *
 * Examples of document.title formats observed:
 *   "Ozymandias | Breaking Bad | Netflix"       → show: Breaking Bad, episode: Ozymandias
 *   "Breaking Bad | Netflix"                    → show: Breaking Bad, episode: null
 *   "The Dark Knight | Netflix"                 → show: The Dark Knight, episode: null
 */
export function detectNetflixContext(): NetflixContext {
  const fromTitle = parseDocumentTitle(document.title);
  if (fromTitle !== null) return fromTitle;

  // Fallback: try known Netflix DOM selectors for the player title.
  const domTitle = extractFromDom();
  return {
    showTitle: domTitle ?? "this show",
    episodeTitle: null,
  };
}

// ─── Private ────────────────────────────────────────────────────────────────

function parseDocumentTitle(title: string): NetflixContext | null {
  // Strip the trailing " | Netflix" suffix.
  const withoutNetflix = title.replace(/\s*\|\s*Netflix\s*$/i, "").trim();
  if (withoutNetflix === "") return null;

  // Check for "Episode Title | Show Title" format (series with episode).
  const parts = withoutNetflix.split(/\s*\|\s*/);
  if (parts.length >= 2) {
    return {
      showTitle: parts[parts.length - 1] ?? withoutNetflix,
      episodeTitle: parts[0] ?? null,
    };
  }

  // Movie or series without episode in title.
  return {
    showTitle: withoutNetflix,
    episodeTitle: null,
  };
}

/**
 * DOM fallback selectors for the Netflix player title overlay.
 * These may change with Netflix updates — document.title is preferred.
 */
const TITLE_SELECTORS = [
  "[data-uia='video-title'] h4",
  "[data-uia='video-title']",
  ".watch-title",
  ".ellipsize-text",
] as const;

function extractFromDom(): string | null {
  for (const selector of TITLE_SELECTORS) {
    const el = document.querySelector(selector);
    if (el?.textContent) return el.textContent.trim();
  }
  return null;
}
