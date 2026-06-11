/**
 * Structured word information returned by the DictionaryService.
 */
export interface WordInfo {
  word: string;
  partOfSpeech: string;
  definition: string;
  synonyms: readonly string[];
}

/**
 * Typed error from the DictionaryService.
 */
export type DictionaryError =
  | { kind: "not_found"; word: string }
  | { kind: "network_error"; message: string };

/**
 * Result type — either a successful lookup or a typed error.
 */
export type DictionaryResult =
  | { ok: true; data: WordInfo }
  | { ok: false; error: DictionaryError };

// ─── API Response Shape ──────────────────────────────────────────────────────
// These types mirror the api.dictionaryapi.dev JSON response.
// Only the fields we use are declared.

interface ApiDefinition {
  definition: string;
  synonyms: string[];
}

interface ApiMeaning {
  partOfSpeech: string;
  definitions: ApiDefinition[];
  synonyms: string[];
}

export interface ApiEntry {
  word: string;
  meanings: ApiMeaning[];
}

/**
 * Extracts a flat WordInfo from the raw API response array.
 * Takes the first meaning and first definition.
 */
export function extractWordInfo(entries: ApiEntry[]): WordInfo | null {
  const entry = entries[0];
  if (entry === undefined) return null;

  const meaning = entry.meanings[0];
  if (meaning === undefined) return null;

  const definition = meaning.definitions[0];
  if (definition === undefined) return null;

  // Synonyms can live on the meaning or on the individual definition.
  const synonyms = [
    ...meaning.synonyms,
    ...definition.synonyms,
  ].slice(0, 5);

  return {
    word: entry.word,
    partOfSpeech: meaning.partOfSpeech,
    definition: definition.definition,
    synonyms,
  };
}
