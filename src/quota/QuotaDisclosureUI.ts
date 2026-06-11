import { USER_KEY_STORAGE_KEY, QUOTA_EXCEEDED_EVENT, INVALID_USER_KEY_EVENT } from "../context/GeminiProxy";

const PANEL_ID = "nva-quota-panel";

/**
 * QuotaDisclosureUI
 *
 * Shown when the shared daily quota is exhausted and the user has no personal key.
 *
 * Design principles:
 *   - Full disclosure before asking for anything: explains exactly what a Groq
 *     key is, that the free tier is capped at 14,400 requests/day, and that it
 *     is completely free with no billing required.
 *   - User must tick an explicit acknowledgement checkbox before saving.
 *   - No dark patterns. The panel can be dismissed without entering a key.
 *   - Links directly to Groq's official console.
 */
export class QuotaDisclosureUI {
  private panel: HTMLElement | null = null;

  public init(): void {
    document.addEventListener(QUOTA_EXCEEDED_EVENT, () => {
      this.show();
    });

    document.addEventListener(INVALID_USER_KEY_EVENT, () => {
      this.showWithError(
        "Your Groq API key was rejected (401). It may be wrong or revoked. " +
        "Please check it at console.groq.com/keys and enter it again.",
      );
    });
  }

  // ─── Public ──────────────────────────────────────────────────────────────────

  public show(): void {
    if (document.getElementById(PANEL_ID) !== null) return;
    this.panel = this.buildPanel();
    document.body.appendChild(this.panel);
  }

  public showWithError(message: string): void {
    this.hide();
    this.panel = this.buildPanel(message);
    document.body.appendChild(this.panel);
  }

  public hide(): void {
    this.panel?.remove();
    this.panel = null;
  }

  // ─── Panel builder ───────────────────────────────────────────────────────────

  private buildPanel(errorMessage?: string): HTMLElement {
    const overlay = document.createElement("div");
    overlay.id = PANEL_ID;
    overlay.style.cssText = [
      "position: fixed",
      "inset: 0",
      "background: rgba(0,0,0,0.82)",
      "z-index: 2147483647",
      "display: flex",
      "align-items: center",
      "justify-content: center",
      "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    ].join(";");

    const card = document.createElement("div");
    card.style.cssText = [
      "background: #1a1a1a",
      "border: 1px solid #333",
      "border-radius: 12px",
      "padding: 28px 32px",
      "max-width: 480px",
      "width: 90%",
      "color: #f0f0f0",
      "line-height: 1.6",
    ].join(";");

    card.innerHTML = `
      ${errorMessage ? `
      <div style="background:#3a0000;border:1px solid #a00;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:16px;color:#ff9999;">
        ⛔ ${errorMessage}
      </div>` : ""}

      <div style="font-size:22px;font-weight:700;margin-bottom:8px;">
        📖 Thesara — Action Required
      </div>

      <div style="font-size:13px;color:#aaa;margin-bottom:20px;border-bottom:1px solid #333;padding-bottom:16px;">
        The shared daily quota has been used up for today. It resets at midnight UTC.
      </div>

      <div style="font-size:14px;margin-bottom:16px;">
        <strong>What is happening?</strong><br>
        Thesara uses Groq AI to explain words and detect idioms. The developer provides
        a shared API key for free, but Groq limits it to <strong>14,400 requests per day</strong>
        across all users. That limit has been reached today.
      </div>

      <div style="font-size:14px;margin-bottom:16px;">
        <strong>Your options</strong>
        <ol style="margin:8px 0 0 18px;padding:0;">
          <li style="margin-bottom:8px;">
            <strong>Wait until tomorrow</strong> — the shared quota resets automatically.
            No action needed.
          </li>
          <li>
            <strong>Use your own free Groq key</strong> — Groq offers a free tier
            (<strong>14,400 requests/day at zero cost, no credit card required</strong>).
            Get one in under 2 minutes at
            <a href="https://console.groq.com/keys" target="_blank"
               style="color:#f5a623;text-decoration:underline;">
              console.groq.com/keys
            </a>.
          </li>
        </ol>
      </div>

      <div style="background:#2a2000;border:1px solid #5a3e00;border-radius:8px;padding:12px 14px;font-size:13px;margin-bottom:20px;">
        ⚠️ <strong>Important — please read before adding your own key:</strong>
        <ul style="margin:8px 0 0 18px;padding:0;">
          <li>Groq's free tier gives you <strong>14,400 requests/day at zero cost</strong> — no billing required.</li>
          <li>If Groq changes their pricing in the future, usage beyond any free limits may incur charges on your account.</li>
          <li>Your key is stored only on your device — it is never sent to the developer or anyone else, only to Groq.</li>
          <li>You can check Groq's current pricing at
            <a href="https://groq.com/pricing" target="_blank"
               style="color:#f5a623;text-decoration:underline;">
              groq.com/pricing
            </a>.
          </li>
        </ul>
      </div>

      <label style="display:flex;align-items:flex-start;gap:10px;font-size:13px;margin-bottom:16px;cursor:pointer;">
        <input type="checkbox" id="nva-ack" style="margin-top:3px;width:16px;height:16px;flex-shrink:0;" />
        <span>
          I understand that my Groq key will be used to make AI requests on my behalf,
          and I have read the information above.
        </span>
      </label>

      <div style="margin-bottom:12px;">
        <input
          type="password"
          id="nva-user-key"
          placeholder="Paste your Groq API key here (starts with gsk_...)"
          disabled
          style="
            width:100%;box-sizing:border-box;padding:10px 12px;
            background:#111;border:1px solid #444;border-radius:6px;
            color:#f0f0f0;font-size:13px;outline:none;
          "
        />
      </div>

      <div style="display:flex;gap:10px;">
        <button id="nva-save-key" disabled style="
          flex:1;padding:10px;background:#f5a623;border:none;border-radius:6px;
          color:#000;font-size:14px;font-weight:700;cursor:not-allowed;opacity:0.4;
        ">
          Save my key &amp; continue
        </button>
        <button id="nva-dismiss" style="
          padding:10px 16px;background:#333;border:none;border-radius:6px;
          color:#ccc;font-size:14px;cursor:pointer;
        ">
          Wait until tomorrow
        </button>
      </div>

      <div style="font-size:11px;color:#666;margin-top:14px;text-align:center;line-height:1.5;">
        Thesara is open source and independent. The developer earns nothing from this extension.<br>
        <span style="color:#555;">
          🔒 Privacy: when you hover a word, the subtitle text and show name are sent to
          Groq's AI servers to generate an explanation. No personal data is collected.
          Your API key (if added) is stored only on your device and sent only to Groq.
        </span>
      </div>
    `;

    const ackBox = card.querySelector<HTMLInputElement>("#nva-ack");
    const keyInput = card.querySelector<HTMLInputElement>("#nva-user-key");
    const saveBtn = card.querySelector<HTMLButtonElement>("#nva-save-key");
    const dismissBtn = card.querySelector<HTMLButtonElement>("#nva-dismiss");

    const updateState = (): void => {
      const checked = ackBox?.checked ?? false;
      if (keyInput) keyInput.disabled = !checked;
      if (saveBtn) {
        saveBtn.disabled = !checked;
        saveBtn.style.opacity = checked ? "1" : "0.4";
        saveBtn.style.cursor = checked ? "pointer" : "not-allowed";
      }
    };

    ackBox?.addEventListener("change", updateState);

    saveBtn?.addEventListener("click", () => {
      const key = keyInput?.value.trim() ?? "";
      if (!key.startsWith("gsk_") || key.length < 20) {
        if (keyInput) {
          keyInput.style.border = "1px solid #e50914";
          keyInput.placeholder = "Key should start with gsk_ — please check it";
        }
        return;
      }
      chrome.storage.local.set({ [USER_KEY_STORAGE_KEY]: key }, () => {
        this.hide();
      });
    });

    dismissBtn?.addEventListener("click", () => {
      this.hide();
    });

    overlay.appendChild(card);
    return overlay;
  }
}
