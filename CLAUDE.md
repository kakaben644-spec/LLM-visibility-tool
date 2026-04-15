# LLM Visibility Tool — Contexte Projet

## Description
SaaS B2B qui aide les marques à mesurer leur visibilité dans les LLMs (GPT-4o, Claude, Gemini).

## Stack Technique
- **Framework**: Next.js 16 App Router + TypeScript strict
- **UI**: shadcn/ui + Tailwind CSS v4
- **Base de données**: Supabase (PostgreSQL)
- **Auth**: Clerk V2 uniquement
- **Déploiement**: Vercel Free

## Architecture des dossiers

/app/(marketing)/page.tsx
/app/(onboarding)/step-1/page.tsx
/app/(onboarding)/step-2/page.tsx
/app/(onboarding)/step-3/page.tsx
/app/(onboarding)/scanning/page.tsx
/app/(dashboard)/dashboard/page.tsx

/app/api/onboarding/session/route.ts
/app/api/scrape/route.ts
/app/api/generate-prompts/route.ts
/app/api/detect-competitors/route.ts
/app/api/audit/start/route.ts
/app/api/audit/run-llm/route.ts
/app/api/audit/[id]/status/route.ts
/app/api/audit/[id]/score/route.ts
/app/api/audit/[id]/responses/route.ts
/app/api/audit/[id]/rerun/route.ts
/app/api/recommendations/route.ts
/app/api/export/pdf/route.ts

/lib/supabase/client.ts
/lib/supabase/server.ts
/lib/llm/openai.ts
/lib/llm/claude.ts
/lib/llm/gemini.ts
/lib/llm/prompts.ts
/lib/types.ts
/lib/utils/score.ts
/lib/utils/mentions.ts
/lib/utils/api-error.ts
/lib/session.ts

/supabase/migrations/001_init.sql
/supabase/migrations/002_complements.sql
/supabase/migrations/004_scores.sql

/components/features/dashboard/ScoreCard.tsx
/components/features/dashboard/ResponseAccordion.tsx
/components/features/dashboard/HighlightedText.tsx

## Contraintes Strictes
- TypeScript strict, zéro `any`
- Zod validation côté client ET serveur sur toutes les routes API
- `export const maxDuration = 8` sur toutes les routes API qui appellent des LLMs
- Toutes les clés API depuis `process.env` uniquement (jamais hardcodées)
- Langue : 100% français dans l'UI
- Pas de compte utilisateur pour le MVP — session via `session_token` en localStorage
- Clerk V2 uniquement (pas V1)
- MVP sans auth : ne jamais insérer user_id dans onboarding_sessions ni dans brands
- migrate_session() existe en DB mais n'est pas appelée dans le MVP
- Ne pas importer ni référencer @clerk/nextjs dans le code MVP

## Démarrage du serveur de dev
⚠️ Claude Desktop injecte `ANTHROPIC_API_KEY=""` dans l'environnement macOS.
Ne jamais lancer `npm run dev` directement — utiliser :
```bash
npm run dev:local
```
Ce script (`start-dev.sh`) lit les clés depuis `.env.local` et les exporte avant de démarrer Next.js.

## Supabase — tables existantes
- onboarding_sessions, brands, competitors, prompts
- audits, llm_responses, mention_results
- scores — colonnes : id, audit_id, brand_id, entity_name, entity_type,
  total_score, mention_rate, avg_position, sentiment_score,
  score_gpt4o, score_claude, score_gemini, created_at
- recommendations

## Migrations appliquées
- 001_init.sql ✅
- 002_complements.sql ✅
- 004_scores.sql ✅
Note : il n'existe pas de 003 — la numérotation saute de 002 à 004.

## Statut Sprint 1 ✅ terminé
- US-20 Setup projet ✅
- US-00 Schéma DB ✅
- US-22 Compléments SQL ✅
- US-16 Persistance onboarding ✅
- US-23 Architecture async LLM ✅
- US-01 Saisie marque ✅
- US-02 Génération prompts ✅
- US-03 Sélection prompts ✅
- US-04 Détection concurrents ✅

## Statut Sprint 2
- US-17 Page /scanning ✅
- US-06 Détection mentions ✅
- US-07 Score de visibilité ✅
- US-08 Dashboard résultats ✅
- US-19 Erreurs et toasts ✅ 
- US-21 Sécurité API / rate limiting  ✅ 
- US-18 Relancer un audit ← prochaine

## Points techniques importants (bugs résolus)
- `selected_prompts` doit être écrit dans step-2 en même temps que `generated_prompts`
- Schema mismatch corrigé : competitors stockés `{ name, url }` mais audit/start attendait `{ name, domain }` — aligné sur `url` dans le Zod schema, mappé vers `domain` à l'insert
- `app/(dashboard)/dashboard/page.tsx` (et non `/dashboard/page.tsx`)
- Route `GET /api/audit/[id]/score` créée en US-08 (n'existait pas avant)
- Route `GET /api/audit/[id]/responses` — colonne DB est `text` (pas `prompt_text`)
- Hydration crash corrigé : ne jamais appeler getBrandName() dans le render body, uniquement dans useEffect

## localStorage keys
- `llmv_session` → session_token UUID
- `llmv_brand_name` → nom de la marque
- `llmv_brand_url` → URL de la marque
- `llmv_current_audit` → audit_id en cours

## Règles de travail Claude Code
- Ne modifier que les fichiers listés à chaque étape
- Si modification d'un fichier existant : diff uniquement, pas réécriture complète
- tsc --noEmit à la fin de chaque étape
- Attendre validation avant chaque micro-étape suivante
- Tous les prompts Claude Code en anglais
- Commit message format : feat: [US-XX étape] — description courte

## When done (à inclure dans chaque prompt Claude Code)
- Run `tsc --noEmit` and fix any type errors before finishing.
- Commit with message: "feat: [étape ID] — description courte"
- Do not push, do not create a PR.