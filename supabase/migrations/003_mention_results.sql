-- =============================================================================
-- LLM Visibility Tool — Migration 003 : mention_results schema update
-- US-06 6C
-- Doit être exécuté APRÈS 001_init.sql et 002_complements.sql
-- =============================================================================

-- Add audit_id, prompt_id, llm_name columns (nullable for migration safety —
-- existing rows do not have these values yet; new inserts will populate them).

ALTER TABLE mention_results
  ADD COLUMN IF NOT EXISTS audit_id  uuid REFERENCES audits(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS prompt_id uuid,
  ADD COLUMN IF NOT EXISTS llm_name  text;

-- Add CHECK constraint on entity_type (may already be missing from 001)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'chk_mention_entity_type'
  ) THEN
    ALTER TABLE mention_results
      ADD CONSTRAINT chk_mention_entity_type
      CHECK (entity_type IN ('brand', 'competitor'));
  END IF;
END;
$$;

-- Performance index on audit_id
CREATE INDEX IF NOT EXISTS mention_results_audit_id_idx ON mention_results(audit_id);
