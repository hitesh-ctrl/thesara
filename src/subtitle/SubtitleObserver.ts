import type { PlatformAdapter } from "../platforms/PlatformAdapter";
import type { SubtitleCallback, SubtitleUpdate } from "./types";

const CONTAINER_POLL_INTERVAL_MS = 500;
const CONTAINER_POLL_MAX_ATTEMPTS = 60; // 30 seconds

/**
 * Observes subtitle changes on any supported platform and emits typed events.
 *
 * Two observation strategies:
 *   "mutation" — MutationObserver on a subtitle container element (Netflix,
 *                Disney+, Prime Video, Max). Polls until the container appears.
 *   "cue"      — HTMLTrackElement.cuechange events (Apple TV+). Polls for the
 *                active <track> element instead of a container.
 *
 * URL-change detection (SPA navigation) is shared by both strategies.
 */
export class SubtitleObserver {
  private readonly callback: SubtitleCallback;
  private readonly adapter: PlatformAdapter;

  // Mutation strategy state
  private mutationObserver: MutationObserver | null = null;

  // Cue strategy state
  private activeTrack: HTMLTrackElement | null = null;
  private readonly boundCueChange: () => void;

  // Shared polling
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private pollAttempts = 0;

  private lastEmittedText: string | null = null;
  private currentUrl: string = location.href;
  private urlCheckIntervalId: ReturnType<typeof setInterval> | null = null;
  private readonly boundHandleNavigation: () => void;

  // ResizeObserver to keep the overlay in sync when the player resizes
  private resizeObserver: ResizeObserver | null = null;
  private onContainerReady: ((container: Element) => void) | null = null;

  constructor(adapter: PlatformAdapter, callback: SubtitleCallback) {
    this.adapter = adapter;
    this.callback = callback;
    this.boundHandleNavigation = (): void => {
      if (location.href !== this.currentUrl) {
        this.currentUrl = location.href;
        this.handleNavigation();
      }
    };
    this.boundCueChange = (): void => { this.handleCueChange(); };
  }

  /**
   * Registers a callback fired whenever the observed subtitle container resizes.
   * OverlayRenderer uses this to re-position word spans after layout changes.
   */
  public setOnContainerReady(fn: (container: Element) => void): void {
    this.onContainerReady = fn;
  }

  public start(): void {
    this.disconnect();
    this.currentUrl = location.href;
    this.startUrlWatcher();

    if (this.adapter.observationStrategy === "cue") {
      this.startCueSearch();
    } else {
      this.startContainerSearch();
    }
  }

  public disconnect(): void {
    this.stopContainerSearch();
    this.detachMutationObserver();
    this.detachCueListener();
    this.stopUrlWatcher();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.lastEmittedText = null;
  }

  // ─── Mutation strategy ───────────────────────────────────────────────────────

  private startContainerSearch(): void {
    this.pollAttempts = 0;
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
          `[SubtitleObserver] ${this.adapter.name}: subtitle container not found after max attempts.`,
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

  private tryAttachToContainer(): boolean {
    const container = this.adapter.findSubtitleContainer();
    if (container === null) return false;
    this.attachMutationObserver(container);
    this.attachResizeObserver(container);
    this.onContainerReady?.(container);
    return true;
  }

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
    this.handleContainerMutation(container);
  }

  private detachMutationObserver(): void {
    if (this.mutationObserver !== null) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
  }

  private handleContainerMutation(container: Element): void {
    const text = this.adapter.extractText(container);

    if (text === "") {
      if (this.lastEmittedText !== null && this.lastEmittedText !== "") {
        this.lastEmittedText = "";
        this.emit({ kind: "cleared", event: { timestamp: Date.now() } });
      }
      return;
    }

    if (text === this.lastEmittedText) return;
    this.lastEmittedText = text;
    this.emit({ kind: "subtitle", event: { text, timestamp: Date.now() } });
  }

  // ─── ResizeObserver ──────────────────────────────────────────────────────────

  private attachResizeObserver(container: Element): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => {
      this.onContainerReady?.(container);
    });
    this.resizeObserver.observe(container);
    // Also watch the video element for full-screen / window resize events.
    const video = document.querySelector("video");
    if (video !== null) this.resizeObserver.observe(video);
  }

  // ─── Cue strategy (Apple TV+) ────────────────────────────────────────────────

  private startCueSearch(): void {
    this.pollAttempts = 0;
    if (this.tryAttachToTrack()) return;

    this.pollIntervalId = setInterval(() => {
      this.pollAttempts++;
      if (this.tryAttachToTrack()) {
        this.stopContainerSearch();
        return;
      }
      if (this.pollAttempts >= CONTAINER_POLL_MAX_ATTEMPTS) {
        this.stopContainerSearch();
        console.warn(
          `[SubtitleObserver] ${this.adapter.name}: subtitle <track> not found after max attempts.`,
        );
      }
    }, CONTAINER_POLL_INTERVAL_MS);
  }

  private tryAttachToTrack(): boolean {
    const track = this.findActiveTextTrack();
    if (track === null) return false;
    this.attachCueListener(track);
    return true;
  }

  private findActiveTextTrack(): HTMLTrackElement | null {
    const video = document.querySelector<HTMLVideoElement>("video");
    if (video === null) return null;

    const tracks = Array.from(video.querySelectorAll<HTMLTrackElement>("track"));
    // Prefer the first showing track; fall back to first captions/subtitles track.
    return (
      tracks.find((t) => t.track.mode === "showing") ??
      tracks.find((t) => t.kind === "subtitles" || t.kind === "captions") ??
      null
    );
  }

  private attachCueListener(track: HTMLTrackElement): void {
    this.detachCueListener();
    this.activeTrack = track;
    track.track.mode = "showing";
    track.addEventListener("cuechange", this.boundCueChange);
    // Inject a ::cue style that makes the native render transparent so our
    // overlay is the only visible text.
    this.injectCueSuppressor();
  }

  private detachCueListener(): void {
    if (this.activeTrack !== null) {
      this.activeTrack.removeEventListener("cuechange", this.boundCueChange);
      this.activeTrack = null;
    }
  }

  private handleCueChange(): void {
    if (this.activeTrack === null) return;
    const cues = this.activeTrack.track.activeCues;

    if (cues === null || cues.length === 0) {
      if (this.lastEmittedText !== null && this.lastEmittedText !== "") {
        this.lastEmittedText = "";
        this.emit({ kind: "cleared", event: { timestamp: Date.now() } });
      }
      return;
    }

    const lines: string[] = [];
    for (let i = 0; i < cues.length; i++) {
      const cue = cues[i];
      if (cue instanceof VTTCue) {
        // VTTCue.text may contain HTML tags — strip them.
        const text = cue.text.replace(/<[^>]+>/g, "").trim();
        if (text) lines.push(text);
      }
    }

    const text = lines.join(" ").replace(/\s+/g, " ").trim();
    if (text === "" || text === this.lastEmittedText) return;
    this.lastEmittedText = text;
    this.emit({ kind: "subtitle", event: { text, timestamp: Date.now() } });
  }

  /**
   * Injects a one-time style that makes the browser's native VTT rendering
   * fully transparent so the Thesara overlay is the only visible text.
   */
  private injectCueSuppressor(): void {
    const id = "nva-cue-suppressor";
    if (document.getElementById(id) !== null) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = "::cue { color: transparent !important; text-shadow: none !important; }";
    document.head.appendChild(style);
  }

  // ─── SPA Navigation ──────────────────────────────────────────────────────────

  private startUrlWatcher(): void {
    const nav = getNavigationApi();
    if (nav !== null) {
      nav.addEventListener("navigate", this.boundHandleNavigation);
    } else {
      window.addEventListener("popstate", this.boundHandleNavigation);
      this.urlCheckIntervalId = setInterval(this.boundHandleNavigation, 5000);
    }
  }

  private stopUrlWatcher(): void {
    const nav = getNavigationApi();
    if (nav !== null) {
      nav.removeEventListener("navigate", this.boundHandleNavigation);
    } else {
      window.removeEventListener("popstate", this.boundHandleNavigation);
    }
    if (this.urlCheckIntervalId !== null) {
      clearInterval(this.urlCheckIntervalId);
      this.urlCheckIntervalId = null;
    }
  }

  private handleNavigation(): void {
    this.detachMutationObserver();
    this.detachCueListener();
    this.stopContainerSearch();
    this.lastEmittedText = null;

    if (this.adapter.observationStrategy === "cue") {
      this.startCueSearch();
    } else {
      this.startContainerSearch();
    }
  }

  // ─── Teardown on page unload ─────────────────────────────────────────────────

  /**
   * Registers a beforeunload listener so all observers are cleaned up when the
   * user navigates away from the page entirely.
   */
  public registerUnloadCleanup(): void {
    window.addEventListener("beforeunload", (): void => { this.disconnect(); }, { once: true });
  }

  // ─── Emit ─────────────────────────────────────────────────────────────────────

  private emit(update: SubtitleUpdate): void {
    try {
      this.callback(update);
    } catch (err) {
      console.error("[SubtitleObserver] Error in subtitle callback:", err);
    }
  }
}

// Navigation API (Chrome 102+) — fires on every navigation including pushState.
// Wrapped in a helper to avoid repeated unsafe casts and centralise the check.
function getNavigationApi(): EventTarget | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = (window as Record<string, unknown>)["navigation"] as EventTarget | undefined;
  return nav ?? null;
}
