-- =============================================================================
-- LLM Visibility Tool — Migration 002 : Compléments (triggers, contraintes, fonctions)
-- US-00 / US-22
-- Doit être exécuté APRÈS 001_init.sql
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Fonction générique updated_at + triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger : users
CREATE OR REPLACE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Trigger : brands
CREATE OR REPLACE TRIGGER trg_brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Trigger : onboarding_sessions
CREATE OR REPLACE TRIGGER trg_onboarding_sessions_updated_at
  BEFORE UPDATE ON onboarding_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();


-- ---------------------------------------------------------------------------
-- 2. Contraintes CHECK
-- ---------------------------------------------------------------------------

-- users.plan
ALTER TABLE users
  ADD CONSTRAINT chk_users_plan
  CHECK (plan IN ('free', 'essential', 'starter', 'growth'));

-- audits.status
ALTER TABLE audits
  ADD CONSTRAINT chk_audits_status
  CHECK (status IN ('pending', 'running', 'completed', 'failed'));

-- scores.total_score
ALTER TABLE scores
  ADD CONSTRAINT chk_scores_total_score
  CHECK (total_score BETWEEN 0 AND 100);

-- onboarding_sessions.current_step
ALTER TABLE onboarding_sessions
  ADD CONSTRAINT chk_onboarding_step
  CHECK (current_step BETWEEN 1 AND 4);

-- brands.account_type
ALTER TABLE brands
  ADD CONSTRAINT chk_brands_account_type
  CHECK (account_type IN ('brand', 'agency'));


-- ---------------------------------------------------------------------------
-- 3. Fonction : migrate_session(p_session_token, p_user_id)
--    Transaction atomique : session -> brand + prompts + competitors
--    RETURNS : brand_id cree (UUID)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION migrate_session(
  p_session_token TEXT,
  p_user_id       UUID
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_session   onboarding_sessions%ROWTYPE;
  v_brand_id  UUID;
  v_prompt    JSONB;
  v_comp      JSONB;
BEGIN
  -- 3.1 Recuperer la session par token (erreur si not found)
  SELECT *
  INTO   v_session
  FROM   onboarding_sessions
  WHERE  session_token = p_session_token
  LIMIT  1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session introuvable : %', p_session_token;
  END IF;

  -- 3.2 INSERT dans brands depuis les donnees de session
  INSERT INTO brands (
    user_id,
    name,
    url,
    country,
    account_type,
    scraped_content
  )
  VALUES (
    p_user_id,
    COALESCE(v_session.brand_name, ''),
    COALESCE(v_session.brand_url,  ''),
    COALESCE(v_session.brand_country, 'France'),
    COALESCE(v_session.account_type,  'brand'),
    v_session.scraped_content
  )
  RETURNING id INTO v_brand_id;

  -- 3.3 INSERT dans prompts depuis session.selected_prompts (JSONB array)
  --     Format attendu : [{ "text": "...", "category": "..." }, ...]
  FOR v_prompt IN
    SELECT jsonb_array_elements(v_session.selected_prompts)
  LOOP
    INSERT INTO prompts (brand_id, text, category, is_custom)
    VALUES (
      v_brand_id,
      v_prompt->>'text',
      NULLIF(v_prompt->>'category', ''),
      FALSE
    );
  END LOOP;

  -- 3.4 INSERT dans competitors depuis session.competitors (JSONB array)
  --     Format attendu : [{ "name": "...", "domain": "..." }, ...]
  FOR v_comp IN
    SELECT jsonb_array_elements(v_session.competitors)
  LOOP
    INSERT INTO competitors (brand_id, name, domain, auto_detected)
    VALUES (
      v_brand_id,
      v_comp->>'name',
      v_comp->>'domain',
      TRUE
    );
  END LOOP;

  -- 3.5 UPDATE onboarding_sessions SET completed = TRUE, user_id = p_user_id
  UPDATE onboarding_sessions
  SET
    completed = TRUE,
    user_id   = p_user_id
  WHERE session_token = p_session_token;

  -- 3.6 RETURNS brand_id cree
  RETURN v_brand_id;

EXCEPTION
  WHEN OTHERS THEN
    -- PostgreSQL rollback automatique la transaction en cas d'erreur
    RAISE;
END;
$$;


-- ---------------------------------------------------------------------------
-- 4. Job de nettoyage des sessions expirees
--    A activer via pg_cron (Supabase dashboard) ou Vercel Cron en V2
-- ---------------------------------------------------------------------------

-- Option A — pg_cron (activer l'extension dans Supabase dashboard d'abord) :
-- SELECT cron.schedule(
--   'cleanup-expired-sessions',
--   '0 3 * * *',
--   $$
--     DELETE FROM onboarding_sessions
--     WHERE expires_at < NOW()
--       AND completed = FALSE;
--   $$
-- );

-- Option B — Vercel Cron + route API /api/cron/cleanup (vercel.json) :
-- DELETE FROM onboarding_sessions WHERE expires_at < NOW();
