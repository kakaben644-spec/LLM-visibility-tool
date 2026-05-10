# US-14 Historique des audits — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Bientôt disponible" stub on `/historique` with a flat audit history list per authenticated user, plus a lightweight detail page at `/historique/[id]`.

**Architecture:** One new API route (`GET /api/history`) fetches all audits + brand names + computed scores for the current Clerk user via three sequential Supabase queries. The list page is a Client Component with a client-side brand filter. The detail page fetches two existing endpoints in parallel and combines their data.

**Tech Stack:** Next.js 16 App Router, @clerk/nextjs v7.3.3, Supabase (getSupabaseAdmin), Zod, Tailwind CSS v4, lucide-react

---

## File Map

| Status | Path | Role |
|--------|------|------|
| Create | `app/api/history/route.ts` | GET — list all audits for current user |
| Rewrite | `app/(dashboard)/historique/page.tsx` | List page with brand filter |
| Create | `app/(dashboard)/historique/[id]/page.tsx` | Detail page (lightweight) |

### Key existing files

- `lib/supabase/server.ts` — `getSupabaseAdmin()` — service-role Supabase client
- `lib/utils/api-error.ts` — `errorResponse(msg, code, status)`, `successResponse(data)`, `notFound(msg?)`, `databaseError(msg?)`
- `app/api/audit/[id]/score/route.ts` — returns `{ data: { scores: ScoreEntry[] } }` where `ScoreEntry = { entity_name, entity_type, total_score, mention_rate, avg_position, score_claude_haiku, score_mistral }`

### DB tables used

```sql
-- users
id UUID PRIMARY KEY, clerk_id TEXT UNIQUE NOT NULL

-- brands
id UUID, user_id UUID REFERENCES users(id), name TEXT, url TEXT

-- audits
id UUID, brand_id UUID REFERENCES brands(id), status TEXT, created_at TIMESTAMPTZ

-- mention_results (migration 003 — already denormalized)
audit_id UUID, entity_type TEXT, is_mentioned BOOLEAN
```

---

## Task 1: GET `/api/history`

**Files:**
- Create: `app/api/history/route.ts`

**Context:** No test framework — verification is `tsc --noEmit`. Auth pattern: `await auth()` from `@clerk/nextjs/server`. No `maxDuration` needed (no LLM call). The `scores` table is unreliable (stale legacy columns) — compute `total_score` from `mention_results` directly with 3 Supabase queries.

- [ ] **Step 1: Create the file**

```typescript
// app/api/history/route.ts
import { auth } from "@clerk/nextjs/server";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { errorResponse, successResponse } from "@/lib/utils/api-error";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditRow {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  created_at: string;
  brand_id: string;
  brand_name: string;
  total_score: number | null;
  mention_rate: number | null;
}

// ---------------------------------------------------------------------------
// GET /api/history
// ---------------------------------------------------------------------------

export async function GET() {
  const { userId } = await auth();
  if (!userId) return errorResponse("Non authentifié", "UNAUTHORIZED", 401);

  const supabase = getSupabaseAdmin();

  // 1. Resolve Clerk ID → internal user
  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (userErr || !userRow) {
    return errorResponse("Utilisateur introuvable", "NOT_FOUND", 404);
  }

  // 2. Get all brands for this user
  const { data: brands, error: brandsErr } = await supabase
    .from("brands")
    .select("id, name")
    .eq("user_id", userRow.id);

  if (brandsErr) return errorResponse(brandsErr.message, "DATABASE_ERROR", 500);
  if (!brands || brands.length === 0) return successResponse({ audits: [] });

  const brandIds = brands.map((b) => b.id as string);
  const brandNameMap = new Map(
    brands.map((b) => [b.id as string, b.name as string])
  );

  // 3. Get all audits for those brands, newest first
  const { data: auditRows, error: auditsErr } = await supabase
    .from("audits")
    .select("id, status, created_at, brand_id")
    .in("brand_id", brandIds)
    .order("created_at", { ascending: false });

  if (auditsErr) return errorResponse(auditsErr.message, "DATABASE_ERROR", 500);
  if (!auditRows || auditRows.length === 0) return successResponse({ audits: [] });

  const auditIds = auditRows.map((a) => a.id as string);

  // 4. Compute brand mention_rate from mention_results (entity_type = 'brand')
  const { data: mentionRows, error: mentionsErr } = await supabase
    .from("mention_results")
    .select("audit_id, is_mentioned")
    .in("audit_id", auditIds)
    .eq("entity_type", "brand");

  if (mentionsErr) return errorResponse(mentionsErr.message, "DATABASE_ERROR", 500);

  const mentionMap = new Map<string, { total: number; mentioned: number }>();
  for (const m of mentionRows ?? []) {
    const key = m.audit_id as string;
    const existing = mentionMap.get(key) ?? { total: 0, mentioned: 0 };
    existing.total++;
    if (m.is_mentioned) existing.mentioned++;
    mentionMap.set(key, existing);
  }

  // 5. Build result
  const audits: AuditRow[] = auditRows.map((a) => {
    const stats = mentionMap.get(a.id as string);
    const mention_rate =
      stats && stats.total > 0 ? stats.mentioned / stats.total : null;
    return {
      id: a.id as string,
      status: a.status as AuditRow["status"],
      created_at: a.created_at as string,
      brand_id: a.brand_id as string,
      brand_name: brandNameMap.get(a.brand_id as string) ?? "",
      total_score: mention_rate !== null ? Math.round(mention_rate * 100) : null,
      mention_rate,
    };
  });

  return successResponse({ audits });
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/karide/llm-visibility-tool && npx tsc --noEmit
```

Expected: no errors. If you see `Property 'X' does not exist`, check column names against the migrations (`users.clerk_id`, `brands.user_id`, `audits.brand_id`, `mention_results.audit_id`, `mention_results.is_mentioned`, `mention_results.entity_type`).

- [ ] **Step 3: Commit**

```bash
git add "app/api/history/route.ts"
git commit -m "feat: [US-14 step 1] — GET /api/history"
```

---

## Task 2: Rewrite `/historique` list page

**Files:**
- Rewrite: `app/(dashboard)/historique/page.tsx`

**Context:** Full Client Component replacing the "Bientôt disponible" stub. Fetches `GET /api/history` on mount. Brand filter is client-side (no re-fetch). `→` links navigate to `/historique/[id]` for `completed` audits only. No `min-h-screen` or `bg-[#0F0F1A]` on wrappers — the dashboard layout provides these.

- [ ] **Step 1: Read the current stub**

```bash
cat "app/(dashboard)/historique/page.tsx"
```

Expected: the 8-line stub with "Bientôt disponible."

- [ ] **Step 2: Write the full page**

```tsx
// app/(dashboard)/historique/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types — mirrors AuditRow from app/api/history/route.ts
// ---------------------------------------------------------------------------

interface AuditRow {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  created_at: string;
  brand_id: string;
  brand_name: string;
  total_score: number | null;
  mention_rate: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<string, string> = {
  completed: "bg-green-500/20 text-green-400",
  running: "bg-orange-500/20 text-orange-400",
  pending: "bg-white/10 text-white/50",
  failed: "bg-red-500/20 text-red-400",
};

const STATUS_LABEL: Record<string, string> = {
  completed: "Terminé",
  running: "En cours…",
  pending: "En attente",
  failed: "Échoué",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HistoriquePage() {
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brandFilter, setBrandFilter] = useState<string>("all");

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch("/api/history");
        const json = (await res.json()) as {
          ok: boolean;
          data?: { audits: AuditRow[] };
          error?: string;
        };
        if (json.ok && json.data) {
          setAudits(json.data.audits);
        } else {
          setError(json.error ?? "Erreur lors du chargement");
        }
      } catch {
        setError("Erreur réseau");
      } finally {
        setLoading(false);
      }
    };
    void fetchHistory();
  }, []);

  const brands = Array.from(new Set(audits.map((a) => a.brand_name))).sort();

  const filtered =
    brandFilter === "all"
      ? audits
      : audits.filter((a) => a.brand_name === brandFilter);

  // --------------------------------------------------------------------------
  // Loading
  // --------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#6B54FA] border-t-transparent" />
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="text-white">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Historique des audits</h1>
            <p className="mt-1 text-sm text-white/60">
              {audits.length} audit{audits.length !== 1 ? "s" : ""} · {brands.length} marque{brands.length !== 1 ? "s" : ""}
            </p>
          </div>
          {brands.length > 1 && (
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 focus:outline-none focus:ring-1 focus:ring-[#6B54FA]"
            >
              <option value="all">Toutes les marques</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Error */}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {/* Empty state */}
        {!error && filtered.length === 0 && (
          <p className="text-sm text-white/50">
            Aucun audit trouvé. Lancez votre premier audit depuis le dashboard.
          </p>
        )}

        {/* Table */}
        {filtered.length > 0 && (
          <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1.2fr_1fr_100px_60px_36px] border-b border-white/10 px-4 py-2.5">
              <span className="text-[10px] uppercase tracking-wide text-white/40">Marque</span>
              <span className="text-[10px] uppercase tracking-wide text-white/40">Date</span>
              <span className="text-[10px] uppercase tracking-wide text-white/40">Statut</span>
              <span className="text-[10px] uppercase tracking-wide text-white/40">Score</span>
              <span />
            </div>

            {/* Rows */}
            {filtered.map((audit) => (
              <div
                key={audit.id}
                className="grid grid-cols-[1.2fr_1fr_100px_60px_36px] items-center border-b border-white/5 px-4 py-3 last:border-b-0"
              >
                <span className="text-sm font-semibold text-white">{audit.brand_name}</span>
                <span className="text-xs text-white/50">{formatDate(audit.created_at)}</span>
                <span
                  className={`inline-flex w-fit items-center rounded px-2 py-0.5 text-[10px] font-semibold ${
                    STATUS_BADGE[audit.status] ?? STATUS_BADGE.pending
                  }`}
                >
                  {STATUS_LABEL[audit.status] ?? audit.status}
                </span>
                <span
                  className={`text-sm font-bold ${
                    audit.total_score !== null ? "text-[#6B54FA]" : "text-white/20"
                  }`}
                >
                  {audit.total_score !== null ? audit.total_score : "—"}
                </span>
                <span className="text-center">
                  {audit.status === "completed" ? (
                    <Link
                      href={`/historique/${audit.id}`}
                      className="text-sm text-white/40 hover:text-white transition-colors"
                    >
                      →
                    </Link>
                  ) : (
                    <span className="text-sm text-white/20">—</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/historique/page.tsx"
git commit -m "feat: [US-14 step 2] — page historique avec filtre marque"
```

---

## Task 3: Create `/historique/[id]` detail page

**Files:**
- Create: `app/(dashboard)/historique/[id]/page.tsx`

**Context:** Client Component. Uses `useParams<{ id: string }>()` from `next/navigation` to get the audit ID. Fetches two endpoints in parallel with `Promise.all`:
1. `GET /api/audit/${id}/score` → `{ data: { scores: ScoreEntry[] } }` — filter for `entity_type === "brand"` to get brand metrics
2. `GET /api/history` → `{ data: { audits: AuditRow[] } }` — find matching audit by id to get `brand_name`, `created_at`, `status`

"Charger dans le dashboard" button writes `llmv_current_audit` to localStorage and redirects to `/dashboard`.

- [ ] **Step 1: Create the file**

```tsx
// app/(dashboard)/historique/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScoreEntry {
  entity_name: string;
  entity_type: "brand" | "competitor";
  total_score: number;
  mention_rate: number;
  avg_position: number | null;
  score_claude_haiku: number | null;
  score_mistral: number | null;
}

interface AuditRow {
  id: string;
  status: string;
  created_at: string;
  brand_id: string;
  brand_name: string;
  total_score: number | null;
  mention_rate: number | null;
}

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HistoriqueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [detail, setDetail] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchDetail = async () => {
      try {
        const [scoreRes, historyRes] = await Promise.all([
          fetch(`/api/audit/${id}/score`),
          fetch("/api/history"),
        ]);

        const scoreJson = (await scoreRes.json()) as {
          ok: boolean;
          data?: { scores: ScoreEntry[] };
          error?: string;
        };
        const historyJson = (await historyRes.json()) as {
          ok: boolean;
          data?: { audits: AuditRow[] };
          error?: string;
        };

        if (!scoreJson.ok || !historyJson.ok) {
          setError(scoreJson.error ?? historyJson.error ?? "Erreur lors du chargement");
          return;
        }

        const brandScore = scoreJson.data?.scores.find(
          (s) => s.entity_type === "brand"
        );
        const auditMeta = historyJson.data?.audits.find((a) => a.id === id);

        if (!brandScore || !auditMeta) {
          setError("Audit introuvable");
          return;
        }

        setDetail({
          brand_name: auditMeta.brand_name,
          created_at: auditMeta.created_at,
          status: auditMeta.status,
          total_score: brandScore.total_score,
          mention_rate: brandScore.mention_rate,
          avg_position: brandScore.avg_position,
          score_claude_haiku: brandScore.score_claude_haiku,
          score_mistral: brandScore.score_mistral,
        });
      } catch {
        setError("Erreur réseau");
      } finally {
        setLoading(false);
      }
    };

    void fetchDetail();
  }, [id]);

  function handleLoad() {
    localStorage.setItem("llmv_current_audit", id);
    router.push("/dashboard");
  }

  // --------------------------------------------------------------------------
  // Loading
  // --------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#6B54FA] border-t-transparent" />
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Error
  // --------------------------------------------------------------------------

  if (error || !detail) {
    return (
      <div className="text-white">
        <div className="mx-auto max-w-2xl px-4 py-10 space-y-4">
          <button
            onClick={() => router.back()}
            className="text-xs text-white/40 hover:text-white transition-colors"
          >
            ← Retour à l'historique
          </button>
          <p className="text-sm text-red-400">{error ?? "Audit introuvable"}</p>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  const BENCHMARK = [
    { label: "Claude Haiku", score: detail.score_claude_haiku },
    { label: "Mistral", score: detail.score_mistral },
  ];

  return (
    <div className="text-white">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">

        {/* Back */}
        <button
          onClick={() => router.back()}
          className="text-xs text-white/40 hover:text-white transition-colors"
        >
          ← Retour à l'historique
        </button>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">{detail.brand_name}</h1>
          <p className="mt-1 text-sm text-white/50">
            Audit du {formatDate(detail.created_at)} · Terminé
          </p>
        </div>

        {/* Score card */}
        <div className="rounded-lg border border-white/10 bg-white/5 p-5 flex items-center gap-8">
          <div className="text-center">
            <div className="text-4xl font-extrabold text-[#6B54FA] leading-none">
              {detail.total_score}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-wide text-white/40">
              Score global
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 flex-1">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-white/40">
                Taux de mention
              </div>
              <div className="mt-0.5 text-sm font-semibold text-white">
                {Math.round(detail.mention_rate * 100)}%
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-white/40">
                Position moyenne
              </div>
              <div className="mt-0.5 text-sm font-semibold text-white">
                {detail.avg_position !== null ? detail.avg_position : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Benchmark */}
        <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
          <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-white/80">
            Benchmark par LLM
          </div>
          {BENCHMARK.map(({ label, score }) => (
            <div
              key={label}
              className="flex items-center justify-between border-b border-white/5 px-4 py-3 last:border-b-0"
            >
              <span className="text-sm text-white/70">{label}</span>
              <span
                className={`text-sm font-bold ${
                  score !== null ? "text-[#6B54FA]" : "text-white/20"
                }`}
              >
                {score !== null ? score : "—"}
              </span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Button onClick={handleLoad} className="bg-[#6B54FA] hover:bg-[#5a45e0] text-white">
          Charger dans le dashboard →
        </Button>

      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. If `useParams` causes a type issue, ensure the import is from `"next/navigation"` (not `"next/router"`).

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/historique/[id]/page.tsx"
git commit -m "feat: [US-14 step 3] — page détail audit /historique/[id]"
```

---

## Final Verification

- [ ] Run `npx tsc --noEmit` — zero errors
- [ ] Navigate to `/historique` — list loads, spinner while fetching, table appears with brand name, date, status badge, score
- [ ] Brand filter dropdown appears when ≥ 2 brands exist — filtering works client-side
- [ ] `→` link only visible on `completed` rows
- [ ] Click `→` → navigates to `/historique/[id]`
- [ ] Detail page shows score card, benchmark table, "Charger" button
- [ ] Click "Charger dans le dashboard" → `llmv_current_audit` updated in localStorage, redirected to `/dashboard`
- [ ] "← Retour à l'historique" → goes back
