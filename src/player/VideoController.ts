/**
 * Controls the Netflix video element for vocabulary interactions.
 *
 * Safety rule: we only resume the video if WE paused it.
 * If the user manually paused before hovering, we leave it paused on mouse-leave.
 */
export class VideoController {
  /** True only when this class issued the pause — not a user-initiated pause. */
  private pausedByUs = false;

  /**
   * Pauses the video if it is currently playing.
   * Marks the pause as ours so resume() can undo it.
   */
  public pause(): void {
    const video = this.getVideo();
    if (video === null || video.paused) return;

    video.pause();
    this.pausedByUs = true;
  }

  /**
   * Resumes the video only if this class was responsible for pausing it.
   * No-ops if the user manually paused.
   */
  public resume(): void {
    if (!this.pausedByUs) return;

    const video = this.getVideo();
    if (video === null) return;

    void video.play();
    this.pausedByUs = false;
  }

  /**
   * Resets internal state without touching the video.
   * Call when the extension tears down or navigates away.
   */
  public reset(): void {
    this.pausedByUs = false;
  }

  private getVideo(): HTMLVideoElement | null {
    return document.querySelector<HTMLVideoElement>("video");
  }
}
