# US-09 — Recommandations IA (Claude Haiku)

**Date :** 2026-05-10
**Statut :** Approuvé
**Stack :** Next.js 16 App Router + Clerk V2 + Supabase + Claude Haiku (`claude-haiku-4-5-20251001`)

---

## Objectif

Remplacer la logique `deriveRecommendations()` côté client (if/else statique) par des recommandations générées par Claude Haiku à partir des scores et des réponses LLM réelles, stockées en base de données, consultables et marquables comme "fait".

---

## Architecture

### Fichiers modifiés / créés

```
app/api/recommendations/route.ts          ← Remplacé : GET (fetch) + POST (generate)
app/api/recommendations/[id]/route.ts     ← Créé : PATCH (toggle is_done)
app/(dashboard)/recommandations/page.tsx  ← Réécrit : UI complète avec états
```

### Table Supabase utilisée

```sql
recommendations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id     UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  brand_id     UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,          -- max ~60 chars
  description  TEXT NOT NULL,          -- max ~200 chars
  priority     TEXT NOT NULL,          -- 'high' | 'medium' | 'low'
  llm_target   TEXT,                   -- 'claude-haiku' | 'mistral' | 'all'
  category     TEXT,                   -- 'content' | 'technical' | 'reputation' | 'seo'
  is_done      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

---

## Section 1 — API : GET + POST `/api/recommendations`

### GET `/api/recommendations?audit_id=<uuid>`

Récupère les recommandations existantes pour un audit, triées par priorité (high → medium → low).

```typescript
// Réponse success
{ ok: true, data: { recommendations: Recommendation[] } }

// Réponse si audit_id absent/invalide
{ ok: false, error: "...", code: "VALIDATION_ERROR" }  // 400
```

**Tri côté DB :** `ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, created_at`

### POST `/api/recommendations`

**Auth :** Clerk `auth()` — 401 si non authentifié.

**Body :**
```typescript
{ audit_id: string }  // UUID validé avec Zod
```

**Pipeline :**

1. Valider `audit_id` (Zod `.uuid()`)
2. Confirmer que l'utilisateur est authentifié (`auth()` → 401 si pas de `userId`). Pas de vérification de propriété complète en MVP — `proxy.ts` + le layout garantissent déjà que seuls les utilisateurs authentifiés atteignent cet endpoint.
3. Fetcher le score brand depuis `scores` WHERE `audit_id = $1 AND entity_type = 'brand'`
4. Fetcher le `brand_name` et `brand_id` depuis `brands` via `audits.brand_id` (SELECT audits JOIN brands)
5. Fetcher jusqu'à 5 réponses LLM WHERE `is_mentioned = false` pour cet `audit_id` depuis `llm_responses` (jointure avec `mention_results` sur `llm_response_id`)
6. Construire le prompt Claude (voir Section 2)
7. Appeler `callClaude(prompt)` depuis `lib/llm/claude.ts`
8. Stripper les fences markdown (`` ```json ... ``` ``) — même pattern que `generate-prompts/route.ts`
9. Parser avec `JSON.parse()` — si échec → 500
10. Valider le JSON parsé avec Zod (4 items, champs requis, valeurs enum correctes) — si invalide → 500
11. Supprimer les recommandations existantes pour cet `audit_id` (support régénération)
12. Insérer les 4 nouvelles recommandations avec `brand_id` récupéré à l'étape 4
13. Retourner `{ ok: true, data: { recommendations: [...] } }`

**`export const maxDuration = 8`** (obligatoire pour tous les routes qui appellent des LLMs).

**Réponse success :**
```typescript
{ ok: true, data: { recommendations: Recommendation[] } }
```

---

## Section 2 — Prompt Claude Haiku

```
Tu es un expert en visibilité des marques dans les LLMs (grands modèles de langage).

Voici les résultats d'un audit de visibilité pour la marque "{brand_name}" :

Score global : {total_score}/100
Taux de mention : {Math.round(mention_rate * 100)}%
Position moyenne : {avg_position !== null ? avg_position : "non disponible"}
Score Claude Haiku : {score_claude_haiku !== null ? score_claude_haiku : "—"}
Score Mistral : {score_mistral !== null ? score_mistral : "—"}

Extraits de réponses LLM où la marque N'EST PAS mentionnée :
{responses.map(r => `[${r.llm_name}] "${r.response_text.slice(0, 300)}"`).join("\n\n")}

Génère exactement 4 recommandations concrètes et actionnables pour améliorer la visibilité de cette marque dans les LLMs.
Réponds UNIQUEMENT avec un tableau JSON valide, sans markdown ni texte autour :
[
  {
    "title": "string court (max 60 chars)",
    "description": "string actionnable (max 200 chars)",
    "priority": "high" | "medium" | "low",
    "category": "content" | "technical" | "reputation" | "seo",
    "llm_target": "claude-haiku" | "mistral" | "all"
  }
]
```

**`max_tokens` :** 500 (suffisant pour 4 items JSON structurés).

**Validation de la réponse parsée :** Zod schema pour vérifier que chaque item a les bons champs et les valeurs attendues pour `priority`, `category`, `llm_target`. Si validation échoue → 500.

---

## Section 3 — API : PATCH `/api/recommendations/[id]`

Toggle `is_done` pour une recommandation individuelle.

**Auth :** Clerk `auth()` — 401 si non authentifié.

**Body :**
```typescript
{ is_done: boolean }  // validé avec Zod
```

**Pipeline :**
1. Valider `id` (UUID depuis le path) et body
2. `UPDATE recommendations SET is_done = $1 WHERE id = $2`
3. Vérifier que la row existe (`count === 1`) — 404 sinon
4. Retourner `{ ok: true, data: { id, is_done } }`

---

## Section 4 — Page `/recommandations`

**Fichier :** `app/(dashboard)/recommandations/page.tsx` — Client Component complet (remplace le fichier existant).

### Types

```typescript
interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  category: "content" | "technical" | "reputation" | "seo";
  llm_target: string;
  is_done: boolean;
}
```

### État de la page

```typescript
const [auditId, setAuditId] = useState<string | null>(null);
const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
const [loading, setLoading] = useState(true);       // chargement initial
const [generating, setGenerating] = useState(false); // génération en cours
const [error, setError] = useState<string | null>(null);
```

### Cycle de vie

1. `useEffect` → lire `llmv_current_audit` depuis localStorage → `setAuditId`
2. Si pas d'`auditId` → `router.push("/step-1")`
3. `GET /api/recommendations?audit_id=xxx` → `setRecommendations(data.recommendations)`
4. `setLoading(false)`

### Générer / Régénérer

```typescript
async function handleGenerate() {
  setGenerating(true);
  const res = await fetch("/api/recommendations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audit_id: auditId }),
  });
  const json = await res.json();
  if (json.ok) setRecommendations(json.data.recommendations);
  else setError(json.error);
  setGenerating(false);
}
```

### Toggle is_done

```typescript
async function handleToggle(id: string, current: boolean) {
  // Optimistic update
  setRecommendations((prev) =>
    prev.map((r) => (r.id === id ? { ...r, is_done: !current } : r))
  );
  await fetch(`/api/recommendations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_done: !current }),
  });
}
```

### Rendu — État vide (aucune recommandation)

```tsx
<Card className="border-white/10 bg-white/5">
  <CardContent className="flex flex-col items-center gap-4 py-12">
    <div className="w-10 h-10 rounded-xl bg-[#6B54FA]/20 flex items-center justify-center">
      <Lightbulb className="text-[#6B54FA]" size={20} />
    </div>
    <p className="text-white font-semibold">Aucune recommandation générée</p>
    <p className="text-white/50 text-sm text-center max-w-xs">
      Cliquez pour analyser vos résultats et obtenir des conseils personnalisés.
    </p>
    <Button onClick={handleGenerate} disabled={generating}>
      {generating ? "Génération en cours…" : "✨ Générer mes recommandations"}
    </Button>
  </CardContent>
</Card>
```

### Rendu — État généré (liste de recommandations)

Header avec compteur + bouton "Régénérer". Liste de cards, une par recommandation, triée par priorité.

**Badges de priorité :**
- `high` → `border-red-500/30 bg-red-500/20 text-red-400`
- `medium` → `border-orange-500/30 bg-orange-500/20 text-orange-400`
- `low` → `border-green-500/30 bg-green-500/20 text-green-400`

**Carte recommandation :**
```tsx
<div className={`border rounded-lg p-4 flex gap-3 transition-opacity ${rec.is_done ? "opacity-50" : ""} border-white/10 bg-white/5`}>
  <input
    type="checkbox"
    checked={rec.is_done}
    onChange={() => handleToggle(rec.id, rec.is_done)}
    className="mt-0.5 accent-[#6B54FA] flex-shrink-0"
  />
  <div className="flex-1">
    {/* Badges : priority + category + llm_target */}
    <p className={`text-sm font-semibold ${rec.is_done ? "line-through text-white/40" : "text-white"}`}>
      {rec.title}
    </p>
    <p className="text-xs text-white/60 mt-1">{rec.description}</p>
  </div>
</div>
```

---

## Critères de succès

- [ ] `GET /api/recommendations?audit_id=xxx` retourne `[]` si aucune reco, ou la liste triée
- [ ] `POST /api/recommendations` génère 4 recommandations via Claude Haiku et les stocke en DB
- [ ] La régénération supprime les anciennes recos avant d'insérer les nouvelles
- [ ] `PATCH /api/recommendations/[id]` toggle `is_done` correctement
- [ ] Page : état vide → bouton "Générer" visible
- [ ] Page : état généré → 4 cards avec priority/category/llm_target, checkbox fonctionnelle
- [ ] Optimistic update sur le toggle (pas d'attente réseau pour le tick)
- [ ] `tsc --noEmit` sans erreur
- [ ] `npm run build` propre
