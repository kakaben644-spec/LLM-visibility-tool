-- =============================================================================
-- LLM Visibility Tool — Migration 001 : Schéma initial
-- US-00 / US-22
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ---------------------------------------------------------------------------
-- 1. Table : users
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id    TEXT        UNIQUE NOT NULL,
  email       TEXT        UNIQUE NOT NULL,
  full_name   TEXT,
  avatar_url  TEXT,
  plan        TEXT        NOT NULL DEFAULT 'free',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------------
-- 2. Table : onboarding_sessions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS onboarding_sessions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token     TEXT        UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  user_id           UUID        REFERENCES users(id) ON DELETE SET NULL,
  current_step      INTEGER     NOT NULL DEFAULT 1,
  brand_name        TEXT,
  brand_url         TEXT,
  brand_country     TEXT        NOT NULL DEFAULT 'France',
  account_type      TEXT        NOT NULL DEFAULT 'brand',
  scraped_content   TEXT,
  generated_prompts JSONB       NOT NULL DEFAULT '[]',
  selected_prompts  JSONB       NOT NULL DEFAULT '[]',
  competitors       JSONB       NOT NULL DEFAULT '[]',
  completed         BOOLEAN     NOT NULL DEFAULT FALSE,
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------------
-- 3. Table : brands
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS brands (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        REFERENCES users(id) ON DELETE CASCADE,  -- nullable pour MVP sans auth
  name             TEXT        NOT NULL,
  url              TEXT        NOT NULL,
  country          TEXT        NOT NULL DEFAULT 'France',
  account_type     TEXT        NOT NULL DEFAULT 'brand',
  logo_url         TEXT,
  scraped_content  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------------
-- 4. Table : competitors
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS competitors (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id       UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  domain         TEXT        NOT NULL,
  logo_url       TEXT,
  auto_detected  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------------
-- 5. Table : prompts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS prompts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  text        TEXT        NOT NULL,
  category    TEXT,  -- Découverte | Comparatif | Réputation | Éducatif | Autre
  is_custom   BOOLEAN     NOT NULL DEFAULT FALSE,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------------
-- 6. Table : audits
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audits (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  status        TEXT        NOT NULL DEFAULT 'pending',  -- pending | running | completed | failed
  triggered_by  TEXT        NOT NULL DEFAULT 'manual',
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------------
-- 7. Table : llm_responses
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS llm_responses (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id       UUID        NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  prompt_id      UUID        NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  llm_name       TEXT        NOT NULL,  -- gpt-4o | claude-sonnet | gemini-pro
  response_text  TEXT        NOT NULL,
  tokens_used    INTEGER,
  latency_ms     INTEGER,
  error          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------------
-- 8. Table : mention_results
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS mention_results (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  llm_response_id   UUID        NOT NULL REFERENCES llm_responses(id) ON DELETE CASCADE,
  entity_name       TEXT        NOT NULL,
  entity_type       TEXT        NOT NULL,  -- brand | competitor
  is_mentioned      BOOLEAN     NOT NULL DEFAULT FALSE,
  position          INTEGER,
  sentiment         TEXT,  -- positive | neutral | negative
  sentiment_score   FLOAT,
  mention_count     INTEGER     NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------------
-- 9. Table : scores
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS scores (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id        UUID        NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  brand_id        UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  entity_name     TEXT        NOT NULL,
  entity_type     TEXT        NOT NULL,
  total_score     FLOAT       NOT NULL,
  mention_rate    FLOAT       NOT NULL,
  avg_position    FLOAT,
  sentiment_score FLOAT,
  score_gpt4o     FLOAT,
  score_claude    FLOAT,
  score_gemini    FLOAT,
  summary_text    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------------
-- 10. Table : recommendations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS recommendations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id     UUID        NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  brand_id     UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  description  TEXT        NOT NULL,
  priority     TEXT        NOT NULL,  -- high | medium | low
  llm_target   TEXT,  -- gpt-4o | claude-sonnet | gemini-pro | all
  category     TEXT,  -- content | technical | reputation | seo
  is_done      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------------
-- 11. Index de performance
-- ---------------------------------------------------------------------------

-- onboarding_sessions
CREATE INDEX IF NOT EXISTS idx_onboarding_token ON onboarding_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_onboarding_user   ON onboarding_sessions(user_id);

-- brands
CREATE INDEX IF NOT EXISTS idx_brands_user       ON brands(user_id);

-- competitors
CREATE INDEX IF NOT EXISTS idx_competitors_brand ON competitors(brand_id);

-- prompts
CREATE INDEX IF NOT EXISTS idx_prompts_brand     ON prompts(brand_id);

-- audits
CREATE INDEX IF NOT EXISTS idx_audits_brand      ON audits(brand_id);

-- llm_responses
CREATE INDEX IF NOT EXISTS idx_llm_audit         ON llm_responses(audit_id);
CREATE INDEX IF NOT EXISTS idx_llm_prompt        ON llm_responses(prompt_id);

-- mention_results
CREATE INDEX IF NOT EXISTS idx_mention_response  ON mention_results(llm_response_id);

-- scores
CREATE INDEX IF NOT EXISTS idx_scores_audit      ON scores(audit_id);

-- recommendations
CREATE INDEX IF NOT EXISTS idx_reco_audit        ON recommendations(audit_id);


-- TODO V2 : activer RLS (Row Level Security) sur toutes les tables
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE onboarding_sessions ENABLE ROW LEVEL SECURITY;
-- etc.
