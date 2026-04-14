-- =============================================================================
-- LLM Visibility Tool — Migration 004 : scores table adjustments
-- US-07 7B
-- =============================================================================
-- The `scores` table was created in 001_init.sql.
-- This migration aligns it with the final ScoreResult shape from lib/utils/score.ts:
--   score_by_llm keys: "gpt-4o" → score_gpt4o, "claude-sonnet" → score_claude,
--                      "gemini-pro" → score_gemini
-- All statements are idempotent (safe to run multiple times).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Drop columns that no longer exist in the required schema
-- ---------------------------------------------------------------------------

ALTER TABLE scores DROP COLUMN IF EXISTS summary_text;

-- ---------------------------------------------------------------------------
-- 2. Ensure all required columns exist (ADD COLUMN IF NOT EXISTS)
--    Most columns were already created in 001_init.sql; these are safety guards.
-- ---------------------------------------------------------------------------

ALTER TABLE scores ADD COLUMN IF NOT EXISTS entity_name     TEXT;
ALTER TABLE scores ADD COLUMN IF NOT EXISTS entity_type     TEXT;
ALTER TABLE scores ADD COLUMN IF NOT EXISTS total_score     FLOAT;
ALTER TABLE scores ADD COLUMN IF NOT EXISTS mention_rate    FLOAT;
ALTER TABLE scores ADD COLUMN IF NOT EXISTS avg_position    FLOAT;
ALTER TABLE scores ADD COLUMN IF NOT EXISTS sentiment_score FLOAT;
ALTER TABLE scores ADD COLUMN IF NOT EXISTS score_gpt4o     FLOAT;
ALTER TABLE scores ADD COLUMN IF NOT EXISTS score_claude    FLOAT;
ALTER TABLE scores ADD COLUMN IF NOT EXISTS score_gemini    FLOAT;

-- ---------------------------------------------------------------------------
-- 3. Performance index (idempotent)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_scores_audit ON scores(audit_id);
