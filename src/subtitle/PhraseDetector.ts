import { GeminiProxy } from "../context/GeminiProxy";

const SYSTEM_PROMPT = `You are a phrase detector for an English vocabulary learning app used while watching TV shows and movies.

Given a subtitle line, identify multi-word expressions that should be understood as a single unit:
- Idioms (e.g. "kick the bucket", "spill the beans")
- Phrasal verbs (e.g. "give up", "look into", "come across")
- Fixed expressions (e.g. "by the way", "of course", "on the other hand")
- Culturally specific phrases a non-native speaker might not recognise

Rules:
- Return ONLY a valid JSON array of strings.
- Each string must be an exact substring of the input sentence (preserve original casing and spacing).
- Only include genuinely idiomatic or non-compositional phrases — not plain noun/verb phrases like "the man ran".
- If no such phrases exist, return [].
- No explanation, no markdown, just the JSON array.

Examples:
Input: "He kicked the bucket last night."
Output: ["kicked the bucket"]

Input: "By the way, she finally came across the letter."
Output: ["By the way", "came across"]

Input: "I want a coffee."
Output: []`;

/**
 * Uses Groq (via GeminiProxy) to detect multi-word idioms and phrases in a
 * subtitle sentence. Results are cached per sentence.
 */
export class PhraseDetector {
  private readonly cache = new Map<string, string[]>();
  private readonly proxy = new GeminiProxy();

  public async detect(sentence: string): Promise<string[]> {
    const cached = this.cache.get(sentence);
    if (cached !== undefined) return cached;

    const body = {
      model: "llama-3.3-70b-versatile",
      max_tokens: 150,
      temperature: 0.1,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: sentence },
      ],
    };

    const result = await this.proxy.call("/phrases", body);
    if (!result.ok) {
      this.cache.set(sentence, []);
      return [];
    }

    const text =
      (result.data as { choices?: Array<{ message?: { content?: string } }> })
        .choices?.[0]?.message?.content?.trim() ?? "";

    let phrases: string[] = [];
    try {
      const parsed: unknown = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.every((i) => typeof i === "string")) {
        const lower = sentence.toLowerCase();
        phrases = (parsed as string[]).filter(
          (p) => p.trim().includes(" ") && lower.includes(p.toLowerCase()),
        );
      }
    } catch {
      // Malformed JSON — no phrases.
    }

    this.cache.set(sentence, phrases);
    return phrases;
  }
}
