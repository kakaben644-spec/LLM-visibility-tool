# US-14 — Historique des audits

**Date :** 2026-05-11
**Statut :** Approuvé
**Stack :** Next.js 16 App Router + Clerk V2 + Supabase

---

## Objectif

Remplacer le stub "Bientôt disponible" de la page `/historique` par une liste paginée de tous les audits de l'utilisateur authentifié (toutes marques confondues), avec filtre par marque et une page de détail allégée accessible depuis la liste.

---

## Architecture

### Fichiers modifiés / créés

```
app/api/history/route.ts                      ← Créé : GET (liste audits user)
app/(dashboard)/historique/page.tsx           ← Réécrit : liste + filtre marque
app/(dashboard)/historique/[id]/page.tsx      ← Créé : détail allégé + bouton Charger
```

### Fichiers existants réutilisés (aucune modification)

- `app/api/audit/[id]/score/route.ts` — page de détail fetche le score depuis cette route
- `lib/supabase/server.ts` — `getSupabaseAdmin()`
- `lib/utils/api-error.ts` — `errorResponse` / `successResponse`
- `lib/supabase/server.ts` — client service role

---

## Section 1 — API : GET `/api/history`

### Authentification

`auth()` depuis `@clerk/nextjs/server` — 401 si pas de `userId`.

### Pipeline

1. `await auth()` → récupérer `userId` (Clerk ID)
2. Lookup internal user : `SELECT id FROM users WHERE clerk_id = $1` → 404 si absent
3. Requête principale :
```sql
SELECT
  a.id,
  a.status,
  a.created_at,
  b.id   AS brand_id,
  b.name AS brand_name,
  s.total_score,
  s.mention_rate
FROM audits a
JOIN brands b ON a.brand_id = b.id
LEFT JOIN scores s
  ON s.audit_id = a.id AND s.entity_type = 'brand'
WHERE b.user_id = <internal_user_id>
ORDER BY a.created_at DESC
```
4. Retourner `{ ok: true, data: { audits: AuditRow[] } }`

### Type `AuditRow`

```typescript
interface AuditRow {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  created_at: string;
  brand_id: string;
  brand_name: string;
  total_score: number | null;
  mention_rate: number | null;
}
```

### Réponses d'erreur

| Cas | Code HTTP | code |
|-----|-----------|------|
| Non authentifié | 401 | `UNAUTHORIZED` |
| User introuvable en DB | 404 | `NOT_FOUND` |
| Erreur Supabase | 500 | `DATABASE_ERROR` |

**Pas de `export const maxDuration`** — aucun appel LLM.

---

## Section 2 — Page `/historique`

**Fichier :** `app/(dashboard)/historique/page.tsx` — Client Component complet.

### Types

```typescript
interface AuditRow {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  created_at: string;
  brand_id: string;
  brand_name: string;
  total_score: number | null;
  mention_rate: number | null;
}
```

### État

```typescript
const [audits, setAudits] = useState<AuditRow[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [brandFilter, setBrandFilter] = useState<string>("all");
```

### Cycle de vie

1. `useEffect` → `GET /api/history` → `setAudits(data.audits)` → `setLoading(false)`
2. Dériver la liste de marques uniques depuis les audits pour le dropdown
3. Filtrer `audits` par `brandFilter` (côté client, pas de re-fetch)

### Filtre marque

```typescript
const brands = Array.from(new Set(audits.map((a) => a.brand_name))).sort();
const filtered = brandFilter === "all"
  ? audits
  : audits.filter((a) => a.brand_name === brandFilter);
```

### Colonne Score

- `status === "completed"` et `total_score !== null` → afficher le score en violet `text-[#6B54FA]`
- Sinon → afficher `—` en `text-white/20`

### Colonne Statut — badges

| Statut | Classes |
|--------|---------|
| `completed` | `bg-green-500/20 text-green-400` — "Terminé" |
| `running` | `bg-orange-500/20 text-orange-400` — "En cours…" |
| `pending` | `bg-white/10 text-white/50` — "En attente" |
| `failed` | `bg-red-500/20 text-red-400` — "Échoué" |

### Colonne Action (→)

- `status === "completed"` → `<Link href={/historique/${a.id}}>→</Link>` en `text-white/50 hover:text-white`
- Sinon → `—` en `text-white/20` (non cliquable)

### Colonne Date

Formater `created_at` avec `new Date(a.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })`.

### États vides / loading / erreur

- Loading : spinner centré `h-full`
- Erreur : `<p className="text-red-400 text-sm">{error}</p>`
- Aucun audit : `<p className="text-white/50 text-sm">Aucun audit trouvé. Lancez votre premier audit depuis le dashboard.</p>`

### Structure du tableau

```
Grid columns : 1.2fr 1fr 100px 60px 36px
Headers      : Marque | Date | Statut | Score | (vide)
```

### Pas de `min-h-screen` ni `bg-[#0F0F1A]`

Le layout `app/(dashboard)/layout.tsx` fournit ces styles — ne pas les ajouter aux wrappers de la page.

---

## Section 3 — Page `/historique/[id]`

**Fichier :** `app/(dashboard)/historique/[id]/page.tsx` — Client Component.

### Types

```typescript
// Entrée brand extraite de la réponse /api/audit/[id]/score
interface ScoreEntry {
  entity_name: string;
  entity_type: "brand" | "competitor";
  total_score: number;
  mention_rate: number;
  avg_position: number | null;
  score_claude_haiku: number | null;
  score_mistral: number | null;
}

// Données combinées affichées dans la page
interface DetailData {
  brand_name: string;
  created_at: string;
  status: string;
  total_score: number;
  mention_rate: number;
  avg_position: number | null;
  score_claude_haiku: number | null;
  score_mistral: number | null;
}
```

### État

```typescript
const [detail, setDetail] = useState<DetailData | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```

### Cycle de vie

1. Récupérer `id` depuis `useParams()` — `const { id } = useParams<{ id: string }>()`
2. `useEffect` → deux fetches en parallèle via `Promise.all` :
   - `GET /api/audit/${id}/score` → `{ data: { scores: ScoreEntry[] } }`
   - `GET /api/history` → `{ data: { audits: AuditRow[] } }`
3. Combiner les résultats :
   - `brandScore` = `scores.find(s => s.entity_type === "brand")` → 404 si absent
   - `auditMeta` = `audits.find(a => a.id === id)` → 404 si absent
   - Construire `DetailData` depuis `brandScore` + `auditMeta`
4. `setDetail(...)` → `setLoading(false)`
5. Si erreur ou données manquantes → `setError("Audit introuvable")`

### Réponses des routes existantes

`GET /api/audit/[id]/score` retourne :
```typescript
{ ok: true, data: { scores: ScoreEntry[] } }
// scores trié : brand en premier, puis competitors
// entity_name du premier élément brand = nom de la marque
```

`GET /api/history` retourne :
```typescript
{ ok: true, data: { audits: AuditRow[] } }
// AuditRow : { id, status, created_at, brand_id, brand_name, total_score, mention_rate }
```

### Bouton "Charger dans le dashboard"

```typescript
function handleLoad() {
  localStorage.setItem("llmv_current_audit", id);
  router.push("/dashboard");
}
```

### Structure de la page

1. Lien retour : `← Retour à l'historique` → `router.back()`
2. En-tête : `brand_name` (titre) + date formatée + statut "Terminé"
3. Score card : score global (grand, violet) + taux de mention + position moyenne
4. Benchmark table :
   - En-têtes : LLM | Score
   - Lignes : Claude Haiku / Mistral → score ou `—` si null
5. Bouton `Charger dans le dashboard →` (bg `#6B54FA`)

### Pas de `min-h-screen` ni `bg-[#0F0F1A]`

---

## Critères de succès

- [ ] `GET /api/history` retourne la liste des audits triés par date décroissante pour l'utilisateur authentifié
- [ ] Filtre par marque côté client — sans re-fetch
- [ ] Badges de statut corrects (Terminé / En cours / En attente / Échoué)
- [ ] Lien `→` uniquement pour les audits `completed`
- [ ] Page `/historique/[id]` affiche score + benchmark depuis `/api/audit/[id]/score`
- [ ] Bouton "Charger" met à jour `llmv_current_audit` et redirige vers `/dashboard`
- [ ] `tsc --noEmit` sans erreur
- [ ] Aucun `min-h-screen` / `bg-[#0F0F1A]` sur les wrappers de page
