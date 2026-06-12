import { USER_KEY_STORAGE_KEY, QUOTA_EXCEEDED_EVENT, INVALID_USER_KEY_EVENT } from "../context/AIProxy";

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
  private readonly onKeydown: (e: KeyboardEvent) => void;

  constructor() {
    this.onKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") this.hide();
    };
  }

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
    document.addEventListener("keydown", this.onKeydown);
  }

  public showWithError(message: string): void {
    this.hide();
    this.panel = this.buildPanel(message);
    document.body.appendChild(this.panel);
    document.addEventListener("keydown", this.onKeydown);
  }

  public hide(): void {
    this.panel?.remove();
    this.panel = null;
    document.removeEventListener("keydown", this.onKeydown);
  }

  // ─── Panel builder ───────────────────────────────────────────────────────────

  private buildPanel(errorMessage?: string): HTMLElement {
    const overlay = document.createElement("div");
    overlay.id = PANEL_ID;
    applyStyles(overlay, {
      position: "fixed",
      inset: "0",
      background: "rgba(0,0,0,0.82)",
      zIndex: "2147483647",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    });

    const card = document.createElement("div");
    applyStyles(card, {
      background: "#1a1a1a",
      border: "1px solid #333",
      borderRadius: "12px",
      padding: "28px 32px",
      maxWidth: "480px",
      width: "90%",
      color: "#f0f0f0",
      lineHeight: "1.6",
    });

    // ── Error banner (safe — uses textContent only) ───────────────────────────
    if (errorMessage !== undefined) {
      const banner = document.createElement("div");
      applyStyles(banner, {
        background: "#3a0000",
        border: "1px solid #a00",
        borderRadius: "8px",
        padding: "10px 14px",
        fontSize: "13px",
        marginBottom: "16px",
        color: "#ff9999",
      });
      banner.textContent = `⛔ ${errorMessage}`;
      card.appendChild(banner);
    }

    // ── Title ─────────────────────────────────────────────────────────────────
    const title = document.createElement("div");
    applyStyles(title, { fontSize: "22px", fontWeight: "700", marginBottom: "8px" });
    title.textContent = "📖 Thesara — Action Required";
    card.appendChild(title);

    // ── Subtitle ──────────────────────────────────────────────────────────────
    const subtitle = document.createElement("div");
    applyStyles(subtitle, {
      fontSize: "13px",
      color: "#aaa",
      marginBottom: "20px",
      borderBottom: "1px solid #333",
      paddingBottom: "16px",
    });
    subtitle.textContent =
      "The shared daily quota has been used up for today. It resets at midnight UTC.";
    card.appendChild(subtitle);

    // ── What is happening ─────────────────────────────────────────────────────
    card.appendChild(this.buildParagraph(
      "What is happening?",
      "Thesara uses Groq AI to explain words and detect idioms. The developer provides " +
      "a shared API key for free, but Groq limits it to 14,400 requests per day " +
      "across all users. That limit has been reached today.",
    ));

    // ── Options list ──────────────────────────────────────────────────────────
    const optLabel = document.createElement("div");
    applyStyles(optLabel, { fontSize: "14px", marginBottom: "8px" });
    const optStrong = document.createElement("strong");
    optStrong.textContent = "Your options";
    optLabel.appendChild(optStrong);
    card.appendChild(optLabel);

    const ol = document.createElement("ol");
    applyStyles(ol, { margin: "0 0 16px 18px", padding: "0", fontSize: "14px" });

    const li1 = document.createElement("li");
    applyStyles(li1, { marginBottom: "8px" });
    li1.textContent = "Wait until tomorrow — the shared quota resets automatically. No action needed.";
    ol.appendChild(li1);

    const li2 = document.createElement("li");
    const li2Text = document.createTextNode(
      "Use your own free Groq key — Groq offers a free tier (14,400 requests/day at zero cost, " +
      "no credit card required). Get one in under 2 minutes at ",
    );
    li2.appendChild(li2Text);
    const link = document.createElement("a");
    link.href = "https://console.groq.com/keys";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "console.groq.com/keys";
    applyStyles(link, { color: "#f5a623", textDecoration: "underline" });
    li2.appendChild(link);
    li2.appendChild(document.createTextNode("."));
    ol.appendChild(li2);
    card.appendChild(ol);

    // ── Warning box ───────────────────────────────────────────────────────────
    const warn = document.createElement("div");
    applyStyles(warn, {
      background: "#2a2000",
      border: "1px solid #5a3e00",
      borderRadius: "8px",
      padding: "12px 14px",
      fontSize: "13px",
      marginBottom: "20px",
    });

    const warnTitle = document.createElement("p");
    applyStyles(warnTitle, { marginBottom: "8px" });
    const warnStrong = document.createElement("strong");
    warnStrong.textContent = "⚠️ Important — please read before adding your own key:";
    warnTitle.appendChild(warnStrong);
    warn.appendChild(warnTitle);

    const warnItems = [
      "Groq's free tier gives you 14,400 requests/day at zero cost — no billing required.",
      "If Groq changes their pricing in the future, usage beyond any free limits may incur charges on your account.",
      "Your key is stored only on your device — it is never sent to the developer or anyone else, only to Groq.",
    ];
    const warnUl = document.createElement("ul");
    applyStyles(warnUl, { margin: "0 0 0 18px", padding: "0" });
    for (const item of warnItems) {
      const li = document.createElement("li");
      li.textContent = item;
      warnUl.appendChild(li);
    }
    warn.appendChild(warnUl);

    const pricingLi = document.createElement("li");
    pricingLi.appendChild(document.createTextNode("You can check Groq's current pricing at "));
    const pricingLink = document.createElement("a");
    pricingLink.href = "https://groq.com/pricing";
    pricingLink.target = "_blank";
    pricingLink.rel = "noopener noreferrer";
    pricingLink.textContent = "groq.com/pricing";
    applyStyles(pricingLink, { color: "#f5a623", textDecoration: "underline" });
    pricingLi.appendChild(pricingLink);
    pricingLi.appendChild(document.createTextNode("."));
    warnUl.appendChild(pricingLi);
    card.appendChild(warn);

    // ── Acknowledgement checkbox ──────────────────────────────────────────────
    const ackLabel = document.createElement("label");
    applyStyles(ackLabel, {
      display: "flex",
      alignItems: "flex-start",
      gap: "10px",
      fontSize: "13px",
      marginBottom: "16px",
      cursor: "pointer",
    });

    const ackBox = document.createElement("input");
    ackBox.type = "checkbox";
    ackBox.id = "nva-ack";
    applyStyles(ackBox, { marginTop: "3px", width: "16px", height: "16px", flexShrink: "0" });

    const ackText = document.createElement("span");
    ackText.textContent =
      "I understand that my Groq key will be used to make AI requests on my behalf, " +
      "and I have read the information above.";

    ackLabel.appendChild(ackBox);
    ackLabel.appendChild(ackText);
    card.appendChild(ackLabel);

    // ── Key input ─────────────────────────────────────────────────────────────
    const keyWrap = document.createElement("div");
    applyStyles(keyWrap, { marginBottom: "12px" });

    const keyInput = document.createElement("input");
    keyInput.type = "password";
    keyInput.id = "nva-user-key";
    keyInput.placeholder = "Paste your Groq API key here (starts with gsk_...)";
    keyInput.disabled = true;
    keyInput.autocomplete = "off";
    applyStyles(keyInput, {
      width: "100%",
      boxSizing: "border-box",
      padding: "10px 12px",
      background: "#111",
      border: "1px solid #444",
      borderRadius: "6px",
      color: "#f0f0f0",
      fontSize: "13px",
      outline: "none",
    });
    keyWrap.appendChild(keyInput);
    card.appendChild(keyWrap);

    // ── Action buttons ────────────────────────────────────────────────────────
    const btnRow = document.createElement("div");
    applyStyles(btnRow, { display: "flex", gap: "10px" });

    const saveBtn = document.createElement("button");
    saveBtn.id = "nva-save-key";
    saveBtn.disabled = true;
    saveBtn.textContent = "Save my key & continue";
    applyStyles(saveBtn, {
      flex: "1",
      padding: "10px",
      background: "#f5a623",
      border: "none",
      borderRadius: "6px",
      color: "#000",
      fontSize: "14px",
      fontWeight: "700",
      cursor: "not-allowed",
      opacity: "0.4",
    });

    const dismissBtn = document.createElement("button");
    dismissBtn.id = "nva-dismiss";
    dismissBtn.textContent = "Wait until tomorrow";
    applyStyles(dismissBtn, {
      padding: "10px 16px",
      background: "#333",
      border: "none",
      borderRadius: "6px",
      color: "#ccc",
      fontSize: "14px",
      cursor: "pointer",
    });

    btnRow.appendChild(saveBtn);
    btnRow.appendChild(dismissBtn);
    card.appendChild(btnRow);

    // ── Footer ────────────────────────────────────────────────────────────────
    const footer = document.createElement("div");
    applyStyles(footer, {
      fontSize: "11px",
      color: "#666",
      marginTop: "14px",
      textAlign: "center",
      lineHeight: "1.5",
    });
    footer.textContent =
      "Thesara is open source and independent. The developer earns nothing from this extension. " +
      "🔒 Privacy: when you hover a word, the subtitle text and show name are sent to " +
      "Groq's AI servers to generate an explanation. No personal data is collected. " +
      "Your API key (if added) is stored only on your device and sent only to Groq.";
    card.appendChild(footer);

    // ── Wire up interactivity ─────────────────────────────────────────────────
    const updateState = (): void => {
      const checked = ackBox.checked;
      keyInput.disabled = !checked;
      saveBtn.disabled = !checked;
      saveBtn.style.opacity = checked ? "1" : "0.4";
      saveBtn.style.cursor = checked ? "pointer" : "not-allowed";
    };

    ackBox.addEventListener("change", updateState);

    saveBtn.addEventListener("click", () => {
      const key = keyInput.value.trim();
      if (!key.startsWith("gsk_") || key.length < 20) {
        keyInput.style.border = "1px solid #e50914";
        keyInput.placeholder = "Key should start with gsk_ — please check it";
        return;
      }
      chrome.storage.local.set({ [USER_KEY_STORAGE_KEY]: key }, () => {
        this.hide();
      });
    });

    dismissBtn.addEventListener("click", () => {
      this.hide();
    });

    // Focus the dismiss button so Escape/Enter works immediately.
    requestAnimationFrame(() => dismissBtn.focus());

    overlay.appendChild(card);
    return overlay;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private buildParagraph(heading: string, body: string): HTMLElement {
    const wrap = document.createElement("div");
    applyStyles(wrap, { fontSize: "14px", marginBottom: "16px" });
    const strong = document.createElement("strong");
    strong.textContent = heading;
    const br = document.createElement("br");
    const text = document.createTextNode(body);
    wrap.appendChild(strong);
    wrap.appendChild(br);
    wrap.appendChild(text);
    return wrap;
  }
}

function applyStyles(el: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
  Object.assign(el.style, styles);
}
