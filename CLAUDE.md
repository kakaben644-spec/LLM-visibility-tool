@AGENTS.md

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

```
/app/(marketing)/page.tsx            → Landing page
/app/(onboarding)/step-1/page.tsx    → Étape 1 onboarding
/app/(onboarding)/step-2/page.tsx    → Étape 2 onboarding
/app/(onboarding)/step-3/page.tsx    → Étape 3 onboarding
/app/(onboarding)/scanning/page.tsx  → Page de scan
/app/(dashboard)/page.tsx            → Dashboard principal

/app/api/onboarding/session/route.ts
/app/api/scrape/route.ts
/app/api/generate-prompts/route.ts
/app/api/detect-competitors/route.ts
/app/api/audit/start/route.ts
/app/api/audit/run-llm/route.ts
/app/api/audit/[id]/status/route.ts
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

/supabase/migrations/001_init.sql
/supabase/migrations/002_complements.sql
```

## Contraintes Strictes
- TypeScript strict, **zéro `any`**
- Zod validation côté client ET serveur sur toutes les routes API
- `export const maxDuration = 8` sur toutes les routes API qui appellent des LLMs
- Toutes les clés API depuis `process.env` uniquement (jamais hardcodées)
- **Langue : 100% français dans l'UI**
- Pas de compte utilisateur pour le MVP — session via `session_token` en localStorage
- Clerk V2 uniquement (pas V1)

## Variables d'Environnement Requises
Voir `.env.example` à la racine.

## Notes d'implémentation
- Utiliser `next/font/google` pour Sora et DM Sans
- Images externes : `logo.clearbit.com` autorisé via `remotePatterns`
- Headers de sécurité définis dans `next.config.ts`
Bonne idée. Je mets à jour `CLAUDE.md` directement via Claude Code — donne ce prompt :

```
Ajoute cette section à la fin du fichier CLAUDE.md existant.
Ne réécris pas le fichier entier — ajoute uniquement ce bloc à la fin.

---

## Plan de travail immédiat

### Statut global Sprint 1
✅ US-20 — Setup projet (CLAUDE.md, .env, next.config, structure)
✅ US-00 — Schéma DB Supabase (10 tables, migrations 001 + 002)
✅ US-22 — Compléments SQL (triggers, migrate_session, CHECK)
✅ US-16 — Persistance onboarding (route session POST/PATCH/GET, lib/session.ts)
✅ US-23 — Architecture async LLM (routes audit/start, run-llm, status, rerun + lib/llm/*)
✅ US-01 — Saisie marque (Step 1 onboarding)
✅  US-02 — Génération prompts IA (Step 2) 
✅  US-03 — Sélection prompts (Step 2 suite)
✅  US-04 — Détection concurrents (Step 3)
✅  US-18 — Relancer un audit


### Règles de travail
- Attendre "Go XX" avant chaque micro-étape
- Ne modifier que les fichiers listés à chaque étape
- Si modification d'un fichier existant : diff uniquement, pas réécriture
- tsc --noEmit à la fin de chaque étape
- Mettre à jour cette section à chaque étape complétée
- MVP sans auth : ne jamais insérer user_id dans onboarding_sessions
  ni dans brands — ce champ reste NULL jusqu'à l'activation de Clerk
  en V2. Ne pas importer ni référencer @clerk/nextjs dans le code MVP.
- migrate_session() existe en DB mais n'est pas appelée dans le MVP.
```
## Règles de génération des prompts Claude Code

### Format selon la position de la sous-tâche
- **1ère sous-tâche d'une US** → prompt complet : stack, contraintes globales, contexte projet, comportement attendu, when done
- **Sous-tâches suivantes dans la même session Claude Code** → prompt allégé : comportement attendu + when done uniquement (Claude Code a déjà le contexte en session)

### Langue
- Tous les prompts Claude Code sont rédigés en anglais
- Les chaînes UI dans le code restent en français

## Points techniques importants
- `app/(dashboard)/dashboard/page.tsx` — dashboard page (attention : pas `app/(dashboard)/page.tsx`)
- Route `POST /api/audit/[id]/rerun` — rerun existant, complété en 18A : retourne `{ audit_id, brand_name, prompts[], competitors[] }`, triggered_by = 'manual'
- Modale shadcn/ui Dialog pour confirmation avant relancement d'audit