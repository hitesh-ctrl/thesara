/**
 * Common English function words that carry no interesting contextual meaning.
 * Looking these up in context adds no value for a vocabulary learner.
 *
 * Covers: pronouns, articles, prepositions, conjunctions, auxiliary verbs,
 * basic demonstratives, and high-frequency words with no learnable nuance.
 */
const COMMON_WORDS = new Set([
  // Pronouns
  "i","me","my","myself","we","our","ours","ourselves",
  "you","your","yours","yourself","yourselves",
  "he","him","his","himself","she","her","hers","herself",
  "it","its","itself","they","them","their","theirs","themselves",
  "who","whom","whose","which","what",

  // Articles & determiners
  "a","an","the","this","that","these","those","some","any","all","both",
  "each","every","few","more","most","other","such","no","own","same",

  // Prepositions
  "at","by","in","of","on","to","up","as","is","be","for","or","and",
  "nor","but","yet","so","from","into","with","about","above","after",
  "along","among","around","before","behind","below","between","beyond",
  "during","except","inside","near","off","out","outside","over","past",
  "since","through","throughout","till","under","until","upon","via",
  "within","without","per","versus","versus","regarding",

  // Conjunctions
  "although","because","if","since","though","unless","until","when",
  "whenever","where","wherever","whether","while","than","then","else",

  // Auxiliary & common verbs
  "am","are","was","were","been","being","have","has","had","having",
  "do","does","did","doing","will","would","shall","should","may",
  "might","must","can","could","need","dare","ought","used",
  "get","got","go","going","come","came","say","said","know","think",
  "see","look","want","give","make","take","let","put","keep","seem",
  "feel","try","ask","use","find","tell","become","show","leave","call",

  // Very common words with no learnable nuance
  "yes","no","not","also","just","very","so","too","only","now","then",
  "here","there","way","time","year","day","thing","man","woman","people",
  "child","world","life","hand","part","place","case","week","company",
  "really","actually","anyway","okay","ok","well","right","even","still",
  "back","down","how","why","when","where","who","much","many","never",
  "always","often","again","once","twice","already","almost","around",
  "away","something","nothing","everything","anything","someone","anyone",
  "everyone","nobody","somebody","everybody","another","others",
]);

/**
 * Returns true if the word is too common to benefit from a contextual explanation.
 * Case-insensitive.
 */
export function isCommonWord(word: string): boolean {
  return COMMON_WORDS.has(word.toLowerCase());
}
