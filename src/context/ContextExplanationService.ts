import type { NetflixContext } from "../player/NetflixContextDetector";
import { GeminiProxy } from "./GeminiProxy";

export type ContextResult =
  | { ok: true; explanation: string }
  | { ok: false; reason: "no_api_key" | "api_error" | "network_error" | "quota_exceeded" };

/**
 * Generates a contextual explanation of a word or phrase within its subtitle
 * sentence. Routes through the shared Groq proxy; falls back to the user's
 * own Groq key if the shared quota is exhausted.
 */
export class ContextExplanationService {
  private readonly cache = new Map<string, string>();
  private readonly proxy = new GeminiProxy();

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
    const speaker = detectSpeaker(sentence);
    const body = buildGroqBody(wordOrPhrase, sentence, recentLines, speaker, netflixContext, isPhrase);
    const result = await this.proxy.call("/context", body);

    if (!result.ok) return result as ContextResult;

    const text = extractGroqText(result.data);
    if (!text) return { ok: false, reason: "api_error" };

    this.cache.set(cacheKey, text);
    return { ok: true, explanation: text };
  }
}

// ─── Speaker detection ────────────────────────────────────────────────────────

/**
 * Detects a speaker name from common subtitle patterns:
 *   "WALTER: I am the danger."       → "Walter"
 *   "- Jesse: Watch out!"            → "Jesse"
 *   "[Narrator] Long ago..."         → "Narrator"
 */
function detectSpeaker(text: string): string | null {
  const patterns = [
    /^-?\s*([A-Z][A-Za-z\s]{1,20}):\s/,     // "WALTER: " or "- Jesse: "
    /^\[([A-Z][A-Za-z\s]{1,20})\]/,          // "[Narrator]"
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text.trim());
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return null;
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert English language tutor embedded in a Netflix subtitle assistant.

Your job: when a viewer hovers over a word or phrase while watching a TV show or movie, explain exactly what it means in THAT moment — not its dictionary definition, but its actual meaning given the scene, the show, the characters, and everything said before it.

You will be given:
- The show name and episode (if known)
- Recent subtitle lines leading up to the current line (for scene context)
- The current subtitle line
- The speaker (if detectable)
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
- When a speaker is identified, use their name to add character context

EXAMPLES:

Show: Breaking Bad | Speaker: Walter | Recent: ["Jesse, you asked me if I was in the meth business or the money business."] | Line: "I'm the danger." | Word: "danger"
Answer: Walter isn't describing a hazard — he's declaring himself a powerful, threatening force, in one of his most iconic acts of self-mythologising.

Show: Modern Family | Speaker: Claire | Recent: ["We need to think about Grandma's future."] | Line: "Are you still putting Aunt Edie in a home?" | Word: "home"
Answer: "A home" here means a care home or nursing facility — a place for elderly people who need full-time assistance, not just a house.

Show: Succession | Speaker: Logan | Recent: ["The board is getting nervous.", "They want assurances."] | Line: "I'll take care of it." | Word: "take care of"
Answer: From Logan Roy this is not reassurance — it's a quiet threat that he will neutralise whoever is causing the problem.

Show: The Office | Speaker: Michael | Recent: ["We've hit our sales targets three months running!"] | Line: "That's what she said." | Phrase: "That's what she said"
Answer: Michael's running joke — he uses this phrase to turn any innocent statement into an innuendo, a staple of his cringe humour throughout the show.

Show: Fleabag | Speaker: Fleabag | Recent: ["I don't know what I'm doing.", "I just keep messing everything up."] | Line: "I'm fine." | Word: "fine"
Answer: Fleabag's "fine" almost always means the opposite — this is her default deflection when she is anything but fine, a pattern the whole show is built on.`;

function buildGroqBody(
  wordOrPhrase: string,
  sentence: string,
  recentLines: string[],
  speaker: string | null,
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

  const speakerLine = speaker ? `Speaker: ${speaker}\n` : "";
  const label = isPhrase ? "Phrase" : "Word";

  const userText =
    `Show: ${netflixContext.showTitle}${episode}\n` +
    recentContext +
    speakerLine +
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
