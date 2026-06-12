import type { DictionaryResult, ApiEntry } from "./types";
import { extractWordInfo } from "./types";
import { BoundedCache } from "../util/BoundedCache";

const API_BASE = "https://api.dictionaryapi.dev/api/v2/entries/en";

/**
 * Fetches word definitions, synonyms, and part of speech from the free
 * Dictionary API (api.dictionaryapi.dev). No API key required.
 *
 * Features:
 * - In-memory cache: each word is fetched at most once per page session.
 * - Typed errors: callers always receive a DictionaryResult, never a throw.
 * - Lowercase normalisation: "Hello" and "hello" share a cache entry.
 */
export class DictionaryService {
  private readonly cache = new BoundedCache<string, DictionaryResult>(500);

  /**
   * Looks up a word. Returns cached result immediately on subsequent calls.
   *
   * @param rawWord - The word as it appears in the subtitle (any case).
   * @returns A DictionaryResult — always resolves, never rejects.
   */
  public async lookup(rawWord: string): Promise<DictionaryResult> {
    const word = rawWord.toLowerCase().trim();

    const cached = this.cache.get(word);
    if (cached !== undefined) return cached;

    const result = await this.fetch(word);
    this.cache.set(word, result);
    return result;
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async fetch(word: string): Promise<DictionaryResult> {
    let response: Response;

    try {
      response = await globalThis.fetch(`${API_BASE}/${encodeURIComponent(word)}`);
    } catch (err) {
      return {
        ok: false,
        error: {
          kind: "network_error",
          message: err instanceof Error ? err.message : "Unknown network error",
        },
      };
    }

    if (response.status === 404) {
      return { ok: false, error: { kind: "not_found", word } };
    }

    if (!response.ok) {
      return {
        ok: false,
        error: {
          kind: "network_error",
          message: `API returned ${response.status}`,
        },
      };
    }

    let entries: ApiEntry[];
    try {
      entries = (await response.json()) as ApiEntry[];
    } catch {
      return {
        ok: false,
        error: { kind: "network_error", message: "Failed to parse API response" },
      };
    }

    const info = extractWordInfo(entries);
    if (info === null) {
      return { ok: false, error: { kind: "not_found", word } };
    }

    return { ok: true, data: info };
  }
}
