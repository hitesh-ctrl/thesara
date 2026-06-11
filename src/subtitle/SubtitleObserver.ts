import { findSubtitleContainer, extractTextFromContainer } from "./netflixSelectors";
import type { SubtitleCallback, SubtitleUpdate } from "./types";

const CONTAINER_POLL_INTERVAL_MS = 500;
const CONTAINER_POLL_MAX_ATTEMPTS = 60; // 30 seconds before giving up

/**
 * Observes Netflix subtitle changes and emits typed events to a consumer callback.
 *
 * Lifecycle:
 *   1. Call `start()` to begin. The observer polls for the subtitle container,
 *      then attaches a MutationObserver once the container is available.
 *   2. Call `disconnect()` to clean up all observers and polling timers.
 *   3. Call `start()` again after a Netflix SPA navigation if needed,
 *      or use the built-in URL-change detection which restarts automatically.
 */
export class SubtitleObserver {
  private readonly callback: SubtitleCallback;

  private mutationObserver: MutationObserver | null = null;
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private pollAttempts = 0;

  private lastEmittedText: string | null = null;
  private currentUrl: string = location.href;
  private urlCheckIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(callback: SubtitleCallback) {
    this.callback = callback;
  }

  /**
   * Starts subtitle observation.
   * Safe to call multiple times — cleans up before restarting.
   */
  public start(): void {
    this.disconnect();
    this.currentUrl = location.href;
    this.startUrlWatcher();
    this.startContainerSearch();
  }

  /**
   * Stops all observation and cleans up resources.
   */
  public disconnect(): void {
    this.stopContainerSearch();
    this.detachMutationObserver();
    this.stopUrlWatcher();
    this.lastEmittedText = null;
  }

  // ─── Container Discovery ────────────────────────────────────────────────────

  private startContainerSearch(): void {
    this.pollAttempts = 0;

    // Check immediately before starting the interval.
    if (this.tryAttachToContainer()) return;

    this.pollIntervalId = setInterval(() => {
      this.pollAttempts++;

      if (this.tryAttachToContainer()) {
        this.stopContainerSearch();
        return;
      }

      if (this.pollAttempts >= CONTAINER_POLL_MAX_ATTEMPTS) {
        this.stopContainerSearch();
        console.warn(
          "[SubtitleObserver] Subtitle container not found after maximum attempts. " +
            "Netflix DOM structure may have changed.",
        );
      }
    }, CONTAINER_POLL_INTERVAL_MS);
  }

  private stopContainerSearch(): void {
    if (this.pollIntervalId !== null) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
    this.pollAttempts = 0;
  }

  /**
   * Attempts to find the subtitle container and attach the MutationObserver.
   * Returns true if successful.
   */
  private tryAttachToContainer(): boolean {
    const container = findSubtitleContainer();
    if (container === null) return false;

    this.attachMutationObserver(container);
    return true;
  }

  // ─── MutationObserver ───────────────────────────────────────────────────────

  private attachMutationObserver(container: Element): void {
    this.detachMutationObserver();

    this.mutationObserver = new MutationObserver(() => {
      this.handleContainerMutation(container);
    });

    this.mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Emit current state immediately in case subtitles are already showing.
    this.handleContainerMutation(container);
  }

  private detachMutationObserver(): void {
    if (this.mutationObserver !== null) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
  }

  private handleContainerMutation(container: Element): void {
    const text = extractTextFromContainer(container);

    if (text === "") {
      // Subtitle cleared — only emit if we previously had text.
      if (this.lastEmittedText !== null && this.lastEmittedText !== "") {
        this.lastEmittedText = "";
        this.emit({ kind: "cleared", event: { timestamp: Date.now() } });
      }
      return;
    }

    // Deduplicate: don't re-emit the same subtitle line.
    if (text === this.lastEmittedText) return;

    this.lastEmittedText = text;
    this.emit({ kind: "subtitle", event: { text, timestamp: Date.now() } });
  }

  // ─── SPA Navigation Handling ────────────────────────────────────────────────

  /**
   * Netflix is a SPA. When the user navigates to a new episode, the URL changes
   * but the page does not reload. We watch for URL changes and restart the
   * observer so it finds the fresh subtitle container.
   */
  private startUrlWatcher(): void {
    this.urlCheckIntervalId = setInterval(() => {
      if (location.href !== this.currentUrl) {
        this.currentUrl = location.href;
        this.handleNavigation();
      }
    }, 1000);
  }

  private stopUrlWatcher(): void {
    if (this.urlCheckIntervalId !== null) {
      clearInterval(this.urlCheckIntervalId);
      this.urlCheckIntervalId = null;
    }
  }

  private handleNavigation(): void {
    this.detachMutationObserver();
    this.stopContainerSearch();
    this.lastEmittedText = null;
    this.startContainerSearch();
  }

  // ─── Event Emission ─────────────────────────────────────────────────────────

  private emit(update: SubtitleUpdate): void {
    try {
      this.callback(update);
    } catch (err) {
      // Prevent consumer errors from crashing the observer.
      console.error("[SubtitleObserver] Error in subtitle callback:", err);
    }
  }
}
