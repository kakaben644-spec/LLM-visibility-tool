import type { MentionAnalysis } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LlmName = "gpt-4o" | "claude-sonnet" | "gemini-pro";

export interface ScoreEntry {
  response_text: string;
  mention: MentionAnalysis;
  llm_name: LlmName;
}

export interface ScoreResult {
  total_score: number;
  mention_rate: number;
  avg_position: number | null;
  sentiment_score: number;
  score_by_llm: Record<LlmName, number>;
}

// ─── Sentiment heuristic ──────────────────────────────────────────────────────

const POSITIVE_KEYWORDS = [
  "best",
  "leading",
  "top",
  "recommended",
  "excellent",
  "trusted",
  "popular",
  "innovative",
];

const NEGATIVE_KEYWORDS = [
  "worst",
  "bad",
  "poor",
  "unreliable",
  "avoid",
  "slow",
  "expensive",
  "scam",
];

function sentimentScore(text: string): number {
  const lower = text.toLowerCase();
  if (POSITIVE_KEYWORDS.some((kw) => lower.includes(kw))) return 100;
  if (NEGATIVE_KEYWORDS.some((kw) => lower.includes(kw))) return 0;
  return 50;
}

// ─── Position score ───────────────────────────────────────────────────────────

function positionScore(position: number | null): number {
  if (position === null) return 0;
  if (position === 1) return 100;
  if (position === 2) return 75;
  if (position === 3) return 50;
  return 25;
}

// ─── Core formula ─────────────────────────────────────────────────────────────

function computeScoreForEntries(entries: ScoreEntry[]): number {
  if (entries.length === 0) return 0;

  const mentionRate =
    (entries.filter((e) => e.mention.is_mentioned).length / entries.length) *
    100;

  const avgPositionScore =
    entries.reduce((sum, e) => sum + positionScore(e.mention.position), 0) /
    entries.length;

  const avgSentimentScore =
    entries.reduce((sum, e) => sum + sentimentScore(e.response_text), 0) /
    entries.length;

  const total =
    mentionRate * 0.5 + avgPositionScore * 0.3 + avgSentimentScore * 0.2;

  return Math.round(total);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function calculateScore(entries: ScoreEntry[]): ScoreResult {
  if (entries.length === 0) {
    return {
      total_score: 0,
      mention_rate: 0,
      avg_position: null,
      sentiment_score: 0,
      score_by_llm: {
        "gpt-4o": 0,
        "claude-sonnet": 0,
        "gemini-pro": 0,
      },
    };
  }

  // mention_rate
  const mentionedEntries = entries.filter((e) => e.mention.is_mentioned);
  const mention_rate = (mentionedEntries.length / entries.length) * 100;

  // avg_position (only over responses where entity was mentioned)
  const positions = mentionedEntries
    .map((e) => e.mention.position)
    .filter((p): p is number => p !== null);
  const avg_position =
    positions.length > 0
      ? positions.reduce((sum, p) => sum + p, 0) / positions.length
      : null;

  // sentiment_score (all responses)
  const sentiment_score =
    entries.reduce((sum, e) => sum + sentimentScore(e.response_text), 0) /
    entries.length;

  // total_score
  const avgPositionScore =
    entries.reduce((sum, e) => sum + positionScore(e.mention.position), 0) /
    entries.length;
  const total_score = Math.round(
    mention_rate * 0.5 + avgPositionScore * 0.3 + sentiment_score * 0.2
  );

  // score_by_llm
  const llmNames: LlmName[] = ["gpt-4o", "claude-sonnet", "gemini-pro"];
  const score_by_llm = Object.fromEntries(
    llmNames.map((name) => [
      name,
      computeScoreForEntries(entries.filter((e) => e.llm_name === name)),
    ])
  ) as Record<LlmName, number>;

  return {
    total_score,
    mention_rate,
    avg_position,
    sentiment_score,
    score_by_llm,
  };
}
