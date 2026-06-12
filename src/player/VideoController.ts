/**
 * Controls the Netflix video element for vocabulary interactions.
 *
 * Safety rule: we only resume the video if WE paused it.
 * If the user manually paused before hovering, we leave it paused on mouse-leave.
 *
 * A counter (not a boolean) tracks nested pause/resume cycles so rapid word
 * hovers never leave the video stuck in a paused state.
 */
export class VideoController {
  /** Number of outstanding extension-initiated pauses. */
  private pauseDepth = 0;

  /**
   * Pauses the video if it is currently playing.
   * Increments the pause counter so resume() can balance it correctly.
   */
  public pause(): void {
    const video = this.getVideo();
    if (video === null) return;

    if (!video.paused) {
      video.pause();
    }
    // Always increment — even if already paused by us — so every pause()
    // caller must call resume() to release.
    this.pauseDepth++;
  }

  /**
   * Decrements the pause counter. Resumes the video only when the counter
   * reaches zero, meaning all extension-initiated pauses have been released.
   * No-ops if the extension never paused (counter is already 0).
   */
  public resume(): void {
    if (this.pauseDepth <= 0) return;
    this.pauseDepth--;

    if (this.pauseDepth === 0) {
      const video = this.getVideo();
      if (video !== null) {
        void video.play();
      }
    }
  }

  /**
   * Resets internal state without touching the video.
   * Call when the extension tears down or navigates away.
   */
  public reset(): void {
    this.pauseDepth = 0;
  }

  private getVideo(): HTMLVideoElement | null {
    return document.querySelector<HTMLVideoElement>("video");
  }
}
