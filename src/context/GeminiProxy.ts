/**
 * AIProxy
 *
 * Single source of truth for all AI API calls in the extension.
 *
 * Routing logic:
 *   1. Try the shared Cloudflare Worker proxy (developer's Groq key, free for users).
 *   2. If the shared quota is exhausted for the day, check if the user has set
 *      their own Groq API key.
 *   3. If the user has their own key, call Groq directly.
 *   4. If the user has no key, fire a "quota_exceeded" event so the UI can show
 *      the full disclosure screen.
 *
 * Neither the developer nor the user is ever charged without explicit consent:
 *   - The proxy hard-cuts at 13,000/day (below Groq's free limit of 14,400).
 *   - Users are shown a full disclosure screen before they are asked to enter
 *     their own key. Groq's free tier is completely free with no billing required.
 */

export const PROXY_BASE_URL = "https://thesara-proxy.thesara.workers.dev";
const GROQ_DIRECT_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

export const USER_KEY_STORAGE_KEY = "nva_user_groq_api_key";
const QUOTA_EXHAUSTED_KEY = "nva_quota_exhausted_date";

export type ProxyResult =
  | { ok: true; data: unknown }
  | { ok: false; reason: "quota_exceeded" | "api_error" | "network_error" | "invalid_user_key" };

/**
 * Dispatched on `document` when the shared quota is exhausted and the user
 * has not yet set their own key. The disclosure UI listens for this.
 */
export const QUOTA_EXCEEDED_EVENT = "nva:quota_exceeded";
export const INVALID_USER_KEY_EVENT = "nva:invalid_user_key";

export class GeminiProxy {
  public async call(path: "/context" | "/phrases", body: unknown): Promise<ProxyResult> {
    // ── 1. Check if quota was already exhausted today (skip proxy entirely) ───
    const alreadyExhausted = await this.isQuotaExhaustedToday();

    if (!alreadyExhausted) {
      const proxyResult = await this.callProxy(path, body);

      if (proxyResult.ok) return proxyResult;

      if (proxyResult.reason === "quota_exceeded") {
        await this.markQuotaExhaustedToday();
        // Fall through to user-key path below.
      } else {
        return proxyResult;
      }
    }

    // ── 2. Quota exhausted — try the user's own key ───────────────────────────
    const userKey = await this.readUserKey();

    if (userKey !== null) {
      return this.callGroqDirect(body, userKey);
    }

    // ── 3. No user key — fire event so the UI shows the disclosure screen ─────
    document.dispatchEvent(new CustomEvent(QUOTA_EXCEEDED_EVENT));
    return { ok: false, reason: "quota_exceeded" };
  }

  // ─── Proxy call ──────────────────────────────────────────────────────────────

  private async callProxy(path: string, body: unknown): Promise<ProxyResult> {
    let response: Response;
    try {
      response = await fetch(`${PROXY_BASE_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      return { ok: false, reason: "network_error" };
    }

    if (response.status === 429) {
      let json: { error?: string } = {};
      try {
        json = (await response.json()) as { error?: string };
      } catch { /* ignore */ }
      if (json.error === "quota_exceeded") {
        return { ok: false, reason: "quota_exceeded" };
      }
    }

    if (!response.ok) return { ok: false, reason: "api_error" };

    try {
      const data = await response.json();
      return { ok: true, data };
    } catch {
      return { ok: false, reason: "api_error" };
    }
  }

  // ─── Direct Groq call (user's own key) ───────────────────────────────────────

  private async callGroqDirect(body: unknown, apiKey: string): Promise<ProxyResult> {
    // body is already in Groq/OpenAI format — pass it straight through.
    const response$ = body as { model?: string };
    const groqBody = { ...response$, model: GROQ_MODEL };

    let response: Response;
    try {
      response = await fetch(GROQ_DIRECT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(groqBody),
      });
    } catch {
      return { ok: false, reason: "network_error" };
    }

    if (response.status === 401 || response.status === 403) {
      // Key is wrong or revoked — clear it and notify the user.
      await this.clearUserKey();
      document.dispatchEvent(new CustomEvent(INVALID_USER_KEY_EVENT));
      return { ok: false, reason: "invalid_user_key" };
    }

    if (!response.ok) return { ok: false, reason: "api_error" };

    try {
      const data = await response.json();
      return { ok: true, data };
    } catch {
      return { ok: false, reason: "api_error" };
    }
  }

  // ─── Storage helpers ─────────────────────────────────────────────────────────

  private async readUserKey(): Promise<string | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get(USER_KEY_STORAGE_KEY, (result) => {
        const key = result[USER_KEY_STORAGE_KEY];
        resolve(typeof key === "string" && key.length > 0 ? key : null);
      });
    });
  }

  private async isQuotaExhaustedToday(): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.storage.local.get(QUOTA_EXHAUSTED_KEY, (result) => {
        const stored = result[QUOTA_EXHAUSTED_KEY];
        resolve(stored === todayKey());
      });
    });
  }

  private async markQuotaExhaustedToday(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [QUOTA_EXHAUSTED_KEY]: todayKey() }, resolve);
    });
  }

  private async clearUserKey(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.remove(USER_KEY_STORAGE_KEY, resolve);
    });
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
