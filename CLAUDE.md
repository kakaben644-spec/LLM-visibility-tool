# LLM Visibility Tool — Contexte Projet

## Description
SaaS B2B (nom UI : GEO Doctor) qui aide les marques à mesurer leur visibilité dans les LLMs (Claude Haiku, Mistral).
Nom technique du repo : LLM-visibility-tool (inchangé).

## Stack Technique
- **Framework**: Next.js 16 App Router + TypeScript strict
- **UI**: shadcn/ui + Tailwind CSS v4
- **Base de données**: Supabase (PostgreSQL)
- **Auth**: Clerk V2 (configuré mais NON ACTIVÉ pour l'instant — Sprint 3)
- **Déploiement**: Vercel Free

## Architecture des dossiers

/app/(marketing)/page.tsx           ← stub redirect → /step-1 (landing page à construire en US-15)
/app/(onboarding)/step-1/page.tsx
/app/(onboarding)/step-2/page.tsx
/app/(onboarding)/step-3/page.tsx
/app/(onboarding)/scanning/page.tsx
/app/(dashboard)/dashboard/page.tsx
/app/recommendations/page.tsx       ← page créée en US-B1, masquée derrière /sign-up pour l'instant

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
/lib/llm/claude.ts          ← claude-haiku-4-5-20251001 uniquement
/lib/llm/mistral.ts         ← mistral-small-latest via native fetch
/lib/llm/prompts.ts
/lib/types.ts               ← LlmName = "claude-haiku" | "mistral" uniquement
/lib/utils/score.ts
/lib/utils/mentions.ts
/lib/utils/api-error.ts
/lib/utils/serper.ts
/lib/utils/rate-limit.ts    ← conservé mais non utilisé (Upstash Redis retiré)
/lib/session.ts

/supabase/migrations/001_init.sql
/supabase/migrations/002_complements.sql
/supabase/migrations/003_mention_results.sql
/supabase/migrations/004_scores.sql

/components/features/dashboard/ScoreCard.tsx
/components/features/dashboard/ResponseAccordion.tsx  ← groupement par prompt_id, LLM_ORDER = 5 LLMs
/components/features/dashboard/HighlightedText.tsx

## Contraintes Strictes
- TypeScript strict, zéro `any`
- Zod validation côté client ET serveur sur toutes les routes API
- `export const maxDuration = 8` sur toutes les routes API qui appellent des LLMs
- Toutes les clés API depuis `process.env` uniquement (jamais hardcodées)
- Langue : 100% français dans l'UI (nom produit affiché : "GEO Doctor")
- Pas de compte utilisateur pour le MVP Sprint 3 — session via `session_token` en localStorage
- Clerk V2 installé mais NON configuré — ne pas importer `@clerk/nextjs` avant US-12
- MVP sans auth : ne jamais insérer user_id dans onboarding_sessions ni dans brands
- migrate_session() existe en DB mais n'est pas appelée avant US-12
- Ne pas importer ni référencer @clerk/nextjs dans le code avant US-12

## Démarrage du serveur de dev
⚠️ Claude Desktop injecte `ANTHROPIC_API_KEY=""` dans l'environnement macOS.
Ne jamais lancer `npm run dev` directement — utiliser :
```bash
npm run dev:local
```
Ce script (`start-dev.sh`) lit les clés depuis `.env.local` et les exporte avant de démarrer Next.js.

## Supabase — tables existantes
- onboarding_sessions, brands, competitors, prompts
- audits, llm_responses
- mention_results — colonnes : audit_id, prompt_id, llm_name, llm_response_id, is_mentioned, position, entity_type
- scores — colonnes : id, audit_id, brand_id, entity_name, entity_type,
  total_score, mention_rate, avg_position, sentiment_score,
  score_gpt4o, score_claude, score_gemini, created_at
  ⚠️ score_gpt4o/score_claude/score_gemini hérités du schéma initial — pipeline actuel utilise claude-haiku + mistral
- recommendations — table existante (créée avant Sprint 3)

## Migrations appliquées
- 001_init.sql ✅
- 002_complements.sql ✅
- 003_mention_results.sql ✅
- 004_scores.sql ✅

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

## Statut Sprint 2 ✅ terminé
- US-17 Page /scanning ✅
- US-06 Détection mentions ✅
- US-07 Score de visibilité ✅
- US-08 Dashboard résultats ✅
- US-19 Erreurs et toasts ✅
- US-21 Sécurité API / rate limiting ✅
- US-18 Relancer un audit ✅

## Statut Sprint 3 🔄 en cours
- Pipeline LLM fonctionnel end-to-end (claude-haiku + mistral) ✅
- Dashboard affiche score et benchmark ✅
- Upstash Redis retiré, rate-limit.ts conservé mais inactif ✅
- US-11 Déploiement Vercel ✅ (live sur project-n1zex.vercel.app)
- US-B1 Bugs critiques dashboard ✅ terminé (PR #2 mergé)
- US-15 Landing page publique GEO Doctor — À faire
- US-12 Authentification Clerk + blocage emails jetables — À faire

## US-B1 — Ce qui a été corrigé (PR #2, mergé sur main)
### Bug 1 ✅ — LLM_ORDER corrigé
- `dashboard/page.tsx` et `ResponseAccordion.tsx` : LLM_ORDER étendu à 5 LLMs
- Valeurs réelles en DB : "gpt-4o", "claude-sonnet", "claude-haiku", "gemini-pro", "mistral"
- LLM_LABELS mis à jour dans les deux fichiers

### Bug 2 ✅ — Bouton "Voir les recommandations"
- Bouton rendu cliquable, redirige vers `/sign-up`
- La page `/sign-up` n'existe pas encore — affiche 404 jusqu'à US-12

### Bug 3 ✅ — Page recommandations
- `app/recommendations/page.tsx` créée (recs dérivées du score brand)
- Accessible mais masquée derrière `/sign-up` pour l'instant
- ⚠️ Page à retravailler quand auth + vrais scores LLM disponibles

### Bug 4 ✅ — Bouton "Relancer un audit"
- Appelle POST `/api/audit/[id]/rerun` avec `{ session_token }` depuis localStorage
- Met à jour `llmv_current_audit` avec le nouvel `audit_id` retourné
- Redirige vers `/step-1` après rerun

## Bugs connus post-US-B1 (backlog)
### Bug pipeline — Concurrents tous à 0 dans le benchmark
- Symptôme : scores brand OK, tous les concurrents affichent 0
- Cause suspectée : `mention_results` non créés pour `entity_type = "competitor"`
  ou calcul de score qui ignore les concurrents
- À investiguer : `lib/utils/score.ts` + `lib/utils/mentions.ts` + pipeline `run-llm`
- Priorité haute — bloque la valeur produit du benchmark

### Bug UI — Bouton "Retour au dashboard" invisible sur /recommendations
- Cause : `variant="outline"` → texte blanc sur fond blanc
- Fix trivial à inclure dans la prochaine PR touchant `/recommendations`

### Page /recommendations — logique reco insuffisante
- Avec score = 100/100, aucune condition n'est vraie → seule reco "30 jours" affichée
- À retravailler quand vrais scores LLM par modèle disponibles en DB

## Points techniques importants (bugs résolus)
- `selected_prompts` doit être écrit dans step-2 en même temps que `generated_prompts`
- Schema mismatch corrigé : competitors stockés `{ name, url }` mais audit/start attendait `{ name, domain }`
- `app/(dashboard)/dashboard/page.tsx` (et non `/dashboard/page.tsx`)
- Route `GET /api/audit/[id]/score` créée en US-08
- Route `GET /api/audit/[id]/responses` — colonne DB est `text` (pas `prompt_text`)
- Hydration crash corrigé : ne jamais appeler getBrandName() dans le render body
- `generate-prompts` : stripping des fences JSON + system prompt amélioré + troncature 4000 chars
- `run-llm` : `success: boolean` ajouté à `LLMCallResult`
- `scanning/page.tsx` : LLMs = ["claude-haiku", "mistral"]
- `step-2/page.tsx` : brandUrl normalisé avec préfixe `https://`
- `scrape/route.ts` : ZodError géré explicitement → retourne 400 (pas 422)
- `handleRerun` : body POST doit inclure `{ session_token }` depuis localStorage "llmv_session"
- `dashboard/page.tsx` : auditId stocké en state React (pas seulement en variable locale useEffect)

## localStorage keys
- `llmv_session` → session_token UUID
- `llmv_brand_name` → nom de la marque
- `llmv_brand_url` → URL de la marque
- `llmv_current_audit` → audit_id en cours (mis à jour après chaque rerun)

## Architecture produit — Vision complète
### Flow utilisateur
Landing page (/) → Onboarding (/step-1/2/3) → Scanning → Mini-dashboard public
→ "Voir les recommandations" → Sign-up Clerk (/sign-up) → Dashboard authentifié

### Backlog Sprint 3 (actuel, par priorité)
1. Bug pipeline — concurrents à 0 (priorité haute)
2. US-15 Landing page GEO Doctor (Figma : vsBnGWjzxetlcoaCQiihk9)
3. US-12 Clerk auth + page /sign-up + blocage emails jetables

### Backlog V2 (post-MVP, dans l'ordre)
- US-13 Layout dashboard authentifié + navigation (sidebar 5 sections)
- US-14 Historique des audits utilisateur
- US-09 Recommandations IA (Claude Haiku, table recommendations existante)
- US-08b Dashboard principal enrichi (graphiques recharts)
- US-16b Analyse Concurrentielle
- US-10 Export PDF (client-side jsPDF + html2canvas)
- US-17b Prompt Intelligence Grid
- US-18b Tester un prompt en temps réel
- US-19b Page Paramètres utilisateur

## Règles de travail Claude Code
- Ne modifier que les fichiers listés à chaque étape
- Si modification d'un fichier existant : diff uniquement, pas réécriture complète
- tsc --noEmit à la fin de chaque étape
- Attendre validation PO avant chaque micro-étape suivante
- Tous les prompts Claude Code en anglais
- Force-check obligatoire : lire les fichiers réels avant toute modification
- Si l'état du disque contredit CLAUDE.md → notifier le PO immédiatement
- Commit message format : feat: [US-XX étape] — description courte

## When done (à inclure dans chaque prompt Claude Code)
- Run `tsc --noEmit` and fix any type errors before finishing.
- Commit with message: "feat: [étape ID] — description courte"
- Do not push, do not create a PR.

## Visualisation & Architecture
- **Mermaid**: Use Mermaid syntax to explain complex logic or database schemas.
- If a visual is needed, generate a `diagram.mmd` file and suggest the PO to preview it.