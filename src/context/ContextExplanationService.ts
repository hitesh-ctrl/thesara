import type { NetflixContext } from "../player/NetflixContextDetector";
import { AIProxy } from "./AIProxy";
import { BoundedCache } from "../util/BoundedCache";

export type ContextResult =
  | { ok: true; explanation: string }
  | { ok: false; reason: "api_error" | "network_error" | "quota_exceeded" };

/**
 * Generates a contextual explanation of a word or phrase within its subtitle
 * sentence. Routes through the shared Groq proxy; falls back to the user's
 * own Groq key if the shared quota is exhausted.
 */
export class ContextExplanationService {
  private readonly cache = new BoundedCache<string, string>(500);
  private readonly proxy = new AIProxy();

  public async explain(
    wordOrPhrase: string,
    sentence: string,
    recentLines: string[],
    netflixContext: NetflixContext,
  ): Promise<ContextResult> {
    const cacheKey = `${wordOrPhrase.toLowerCase()}|||${sentence}|||${netflixContext.showTitle}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) return { ok: true, explanation: cached };

    const isPhrase = wordOrPhrase.trim().includes(" ");
    const body = buildGroqBody(wordOrPhrase, sentence, recentLines, netflixContext, isPhrase);
    const result = await this.proxy.call("/context", body);

    if (!result.ok) return result as ContextResult;

    const text = extractGroqText(result.data);
    if (!text) return { ok: false, reason: "api_error" };

    this.cache.set(cacheKey, text);
    return { ok: true, explanation: text };
  }
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert English language tutor embedded in a streaming subtitle assistant.

Your job: when a viewer hovers over a word or phrase while watching a TV show or movie, explain exactly what it means in THAT moment — not its dictionary definition, but its actual meaning given the scene, the show, the characters, and everything said before it.

You will be given:
- The show name and episode (if known)
- Recent subtitle lines leading up to the current line (for scene context)
- The current subtitle line
- The word or phrase the viewer hovered

WHAT TO FOCUS ON:
1. Non-literal and idiomatic meanings — "home" in an eldercare conversation means a care facility, not a house
2. Show-specific language — Breaking Bad's "cook" = making meth, not cooking food
3. Phrasal verbs used figuratively — "give up", "come across", "look into"
4. Emotional subtext — sarcasm, desperation, irony, veiled threats, dark humour
5. Character-specific speech — a villain saying "I'll handle it" carries menace; a parent saying it carries reassurance
6. Cultural references a non-native English speaker would miss
7. Genre conventions — crime dramas use coded language; sitcoms use irony and hyperbole

RULES:
- Write ONE sentence only
- Write for an intermediate English learner
- Prioritise the meaning in THIS scene over any standard meaning
- If the word is being used plainly with no special meaning, say so simply — don't invent nuance
- Never start with "In this context", "This word means", or "The word"
- Never repeat the subtitle line
- Do NOT mention character names unless they are clearly established in the recent subtitle lines provided

EXAMPLES:

Show: Breaking Bad | Recent: ["Jesse, you asked me if I was in the meth business or the money business."] | Line: "I'm the danger." | Word: "danger"
Answer: The speaker isn't describing a hazard — he's declaring himself a powerful, threatening force, in a chilling act of self-mythologising.

Show: Modern Family | Recent: ["We need to think about Grandma's future."] | Line: "Are you still putting Aunt Edie in a home?" | Word: "home"
Answer: "A home" here means a care home or nursing facility — a place for elderly people who need full-time assistance, not just a house.

Show: Succession | Recent: ["The board is getting nervous.", "They want assurances."] | Line: "I'll take care of it." | Word: "take care of"
Answer: Said in this power struggle, "take care of it" is not reassurance — it's a quiet threat to neutralise whoever is causing the problem.

Show: The Office | Recent: ["We've hit our sales targets three months running!"] | Line: "That's what she said." | Phrase: "That's what she said"
Answer: A running joke in the show — this phrase is used to twist any innocent statement into a sexual innuendo, a staple of the character's cringe humour.

Show: Fleabag | Recent: ["I don't know what I'm doing.", "I just keep messing everything up."] | Line: "I'm fine." | Word: "fine"
Answer: In this show "fine" almost always means the opposite — it's a habitual deflection used when the speaker is anything but fine.`;

function buildGroqBody(
  wordOrPhrase: string,
  sentence: string,
  recentLines: string[],
  netflixContext: NetflixContext,
  isPhrase: boolean,
): unknown {
  const episode = netflixContext.episodeTitle
    ? ` (episode: "${netflixContext.episodeTitle}")`
    : "";

  const recentContext =
    recentLines.length > 0
      ? `Recent lines:\n${recentLines.map((l) => `  "${l}"`).join("\n")}\n`
      : "";

  const label = isPhrase ? "Phrase" : "Word";

  const userText =
    `Show: ${netflixContext.showTitle}${episode}\n` +
    recentContext +
    `Current line: "${sentence}"\n` +
    `${label}: "${wordOrPhrase}"`;

  return {
    model: "llama-3.3-70b-versatile",
    max_tokens: 120,
    temperature: 0.3,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userText },
    ],
  };
}

function extractGroqText(data: unknown): string {
  const d = data as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return d.choices?.[0]?.message?.content?.trim() ?? "";
}
