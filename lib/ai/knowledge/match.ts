import type { KnowledgeCategory, KnowledgeMatch, KnowledgeRecord, KnowledgeSearchResult } from "@/lib/ai/knowledge/types";

const DEFAULT_LIMIT = 3;
/** A record needs at least this much signal to count as a real match -- below it, we'd rather report a miss (and let the fallback path take over) than hand the model a barely-related record. */
const MIN_SCORE = 1;

/** Lowercase, alphanumeric word tokens -- same style as lib/ai/nlu/rule-based-client.ts's own tokenization, kept consistent across the AI subsystem. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-zà-ÿ0-9]+/)
    .filter(Boolean);
}

/**
 * Deterministic relevance score for one record against a query -- no
 * embeddings, no ranking model. A keyword appearing verbatim as a
 * phrase in the query is a strong signal (+2); an overlapping title
 * word is a weaker one (+1). Pure.
 */
export function scoreRecord(record: KnowledgeRecord, query: string): number {
  const normalizedQuery = query.toLowerCase();
  let score = 0;

  for (const keyword of record.keywords) {
    if (keyword.trim() && normalizedQuery.includes(keyword.toLowerCase())) score += 2;
  }

  const queryTokens = new Set(tokenize(query));
  for (const token of tokenize(record.title)) {
    if (queryTokens.has(token)) score += 1;
  }

  return score;
}

/**
 * Ranks every active record against the query, optionally pre-filtered
 * to one category, and returns the top matches above MIN_SCORE.
 * Deterministic: identical inputs always produce identical output,
 * ties broken by title for stable ordering. Pure -- lib/ai/knowledge/
 * engine.ts is the only caller that fetches the records this needs.
 */
export function searchKnowledge(
  records: KnowledgeRecord[],
  query: string,
  options: { category?: KnowledgeCategory | null; limit?: number } = {},
): KnowledgeSearchResult {
  const candidates = options.category ? records.filter((record) => record.category === options.category) : records;

  const matches: KnowledgeMatch[] = candidates
    .map((record) => ({ record, score: scoreRecord(record, query) }))
    .filter((match) => match.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.record.title.localeCompare(b.record.title))
    .slice(0, options.limit ?? DEFAULT_LIMIT);

  return {
    query,
    category: options.category ?? null,
    matches,
    hit: matches.length > 0,
  };
}
