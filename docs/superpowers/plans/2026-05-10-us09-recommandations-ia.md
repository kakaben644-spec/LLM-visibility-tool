# US-09 Recommandations IA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace client-side hardcoded `deriveRecommendations()` with AI-generated recommendations from Claude Haiku, stored per-audit in Supabase, with a checkbox UI to mark them done.

**Architecture:** Three API routes handle the lifecycle (GET fetch, POST generate, PATCH toggle). The POST route fetches brand scores + absent LLM responses from Supabase, builds a structured prompt for Claude Haiku, parses the JSON response, and bulk-inserts into the `recommendations` table. The page is a full Client Component rewrite with empty-state → generate → card-list flow.

**Tech Stack:** Next.js 16 App Router, @clerk/nextjs v7.3.3, Supabase (getSupabaseAdmin), @anthropic-ai/sdk (via callClaude), Zod, Tailwind CSS v4, lucide-react

---

## File Map

| Status | Path | Role |
|--------|------|------|
| Rewrite | `app/api/recommendations/route.ts` | GET (fetch) + POST (generate via Claude) |
| Create | `app/api/recommendations/[id]/route.ts` | PATCH (toggle is_done) |
| Rewrite | `app/(dashboard)/recommandations/page.tsx` | Full page UI |

### Key existing files to know

- `lib/llm/claude.ts` — `callClaude(prompt: string): Promise<LLMCallResult>` — uses `claude-haiku-4-5-20251001`, `max_tokens: 500`. Returns `{ response_text, success, latency_ms, error? }`.
- `lib/supabase/server.ts` — `getSupabaseAdmin()` — service role Supabase client (bypasses RLS).
- `lib/utils/api-error.ts` — `errorResponse(msg, code, status)`, `successResponse(data)`, `notFound()`, `databaseError()`.
- `app/api/generate-prompts/route.ts` — reference for JSON fence stripping pattern.

### Database tables used

```sql
-- mention_results (relevant columns after migration 003)
audit_id UUID, entity_type TEXT, is_mentioned BOOLEAN, position INT, llm_name TEXT, llm_response_id UUID

-- llm_responses
id UUID, response_text TEXT, llm_name TEXT

-- audits
id UUID, brand_id UUID

-- brands
id UUID, name TEXT

-- recommendations
id UUID, audit_id UUID, brand_id UUID, title TEXT, description TEXT,
priority TEXT ('high'|'medium'|'low'), llm_target TEXT, category TEXT, is_done BOOLEAN
```

---

## Task 1: GET + POST `/api/recommendations/route.ts`

**Files:**
- Rewrite: `app/api/recommendations/route.ts`

**Context:** The current file is a 4-line stub returning `{ ok: true }`. Replace it entirely with two handlers. No test framework exists — verification is `tsc --noEmit` + manual curl. `export const maxDuration = 8` is required on all routes that call LLMs (project convention). `auth()` from `@clerk/nextjs/server` is async and must be awaited.

**Zod schema for Claude's response:**
```typescript
const recItemSchema = z.object({
  title: z.string().max(80),
  description: z.string().max(300),
  priority: z.enum(["high", "medium", "low"]),
  category: z.enum(["content", "technical", "reputation", "seo"]),
  llm_target: z.enum(["claude-haiku", "mistral", "all"]),
});
const recsSchema = z.array(recItemSchema).min(1).max(6);
```

- [ ] **Step 1: Write the full file**

```typescript
// app/api/recommendations/route.ts
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { callClaude } from "@/lib/llm/claude";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  errorResponse,
  successResponse,
  databaseError,
} from "@/lib/utils/api-error";

export const maxDuration = 8;

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const postBodySchema = z.object({
  audit_id: z.string().uuid("audit_id doit être un UUID valide"),
});

const recItemSchema = z.object({
  title: z.string().max(80),
  description: z.string().max(300),
  priority: z.enum(["high", "medium", "low"]),
  category: z.enum(["content", "technical", "reputation", "seo"]),
  llm_target: z.enum(["claude-haiku", "mistral", "all"]),
});
const recsSchema = z.array(recItemSchema).min(1).max(6);

// ---------------------------------------------------------------------------
// GET /api/recommendations?audit_id=<uuid>
// ---------------------------------------------------------------------------

export async function GET(req: Request) {
  const url = new URL(req.url);
  const audit_id = url.searchParams.get("audit_id");

  if (!audit_id || !z.string().uuid().safeParse(audit_id).success) {
    return errorResponse("audit_id manquant ou invalide", "VALIDATION_ERROR", 400);
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("recommendations")
    .select("id, title, description, priority, category, llm_target, is_done, created_at")
    .eq("audit_id", audit_id);

  if (error) return databaseError(error.message);

  const priorityOrder: Record<string, number> = { high: 1, medium: 2, low: 3 };
  const sorted = (data ?? []).sort(
    (a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4)
  );

  return successResponse({ recommendations: sorted });
}

// ---------------------------------------------------------------------------
// POST /api/recommendations — generate via Claude Haiku
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return errorResponse("Non authentifié", "UNAUTHORIZED", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Corps JSON invalide", "VALIDATION_ERROR", 400);
  }

  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0].message, "VALIDATION_ERROR", 400);
  }
  const { audit_id } = parsed.data;

  const supabase = getSupabaseAdmin();

  // 1. Get audit → brand_id
  const { data: auditRow, error: auditErr } = await supabase
    .from("audits")
    .select("brand_id")
    .eq("id", audit_id)
    .single();

  if (auditErr || !auditRow) {
    return errorResponse("Audit introuvable", "NOT_FOUND", 404);
  }

  // 2. Get brand name
  const { data: brandRow, error: brandErr } = await supabase
    .from("brands")
    .select("name")
    .eq("id", auditRow.brand_id)
    .single();

  if (brandErr || !brandRow) {
    return errorResponse("Marque introuvable", "NOT_FOUND", 404);
  }

  // 3. Compute scores from mention_results
  const { data: mentionRows, error: mentionErr } = await supabase
    .from("mention_results")
    .select("is_mentioned, position, llm_name")
    .eq("audit_id", audit_id)
    .eq("entity_type", "brand");

  if (mentionErr) return databaseError(mentionErr.message);

  const rows = mentionRows ?? [];
  const total = rows.length;
  const mentionedCount = rows.filter((r) => r.is_mentioned).length;
  const mention_rate = total > 0 ? mentionedCount / total : 0;
  const total_score = Math.round(mention_rate * 100);

  const positions = rows
    .filter((r) => r.position !== null)
    .map((r) => r.position as number);
  const avg_position =
    positions.length > 0
      ? Math.round(positions.reduce((a, b) => a + b, 0) / positions.length)
      : null;

  const haikuRows = rows.filter((r) => r.llm_name === "claude-haiku");
  const score_claude_haiku =
    haikuRows.length > 0
      ? Math.round((haikuRows.filter((r) => r.is_mentioned).length / haikuRows.length) * 100)
      : null;

  const mistralRows = rows.filter((r) => r.llm_name === "mistral");
  const score_mistral =
    mistralRows.length > 0
      ? Math.round((mistralRows.filter((r) => r.is_mentioned).length / mistralRows.length) * 100)
      : null;

  // 4. Fetch up to 5 absent LLM responses
  const { data: absentMentions, error: absentErr } = await supabase
    .from("mention_results")
    .select("llm_response_id, llm_name")
    .eq("audit_id", audit_id)
    .eq("entity_type", "brand")
    .eq("is_mentioned", false)
    .limit(5);

  if (absentErr) return databaseError(absentErr.message);

  const responseIds = (absentMentions ?? [])
    .map((m) => m.llm_response_id)
    .filter((id): id is string => id !== null);

  let absentTexts: Array<{ llm_name: string; response_text: string }> = [];
  if (responseIds.length > 0) {
    const { data: responseRows } = await supabase
      .from("llm_responses")
      .select("id, response_text, llm_name")
      .in("id", responseIds);

    absentTexts = (responseRows ?? []).map((r) => ({
      llm_name: r.llm_name as string,
      response_text: r.response_text as string,
    }));
  }

  // 5. Build prompt
  const absentExcerpts =
    absentTexts.length > 0
      ? absentTexts
          .map((r) => `[${r.llm_name}] "${r.response_text.slice(0, 300)}"`)
          .join("\n\n")
      : "Aucune réponse disponible.";

  const prompt = `Tu es un expert en visibilité des marques dans les LLMs (grands modèles de langage).

Voici les résultats d'un audit de visibilité pour la marque "${brandRow.name}" :

Score global : ${total_score}/100
Taux de mention : ${Math.round(mention_rate * 100)}%
Position moyenne : ${avg_position !== null ? avg_position : "non disponible"}
Score Claude Haiku : ${score_claude_haiku !== null ? score_claude_haiku : "—"}
Score Mistral : ${score_mistral !== null ? score_mistral : "—"}

Extraits de réponses LLM où la marque N'EST PAS mentionnée :
${absentExcerpts}

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
]`;

  // 6. Call Claude Haiku
  const result = await callClaude(prompt);
  if (!result.success || !result.response_text) {
    return errorResponse(
      result.error ?? "Erreur Claude Haiku",
      "LLM_ERROR",
      502
    );
  }

  // 7. Strip markdown fences + parse JSON
  const cleaned = result.response_text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  let rawItems: unknown;
  try {
    rawItems = JSON.parse(cleaned);
  } catch {
    console.error("[recommendations] JSON.parse failed:", cleaned);
    return errorResponse("Réponse Claude invalide (JSON)", "LLM_ERROR", 500);
  }

  // 8. Validate with Zod
  const validationResult = recsSchema.safeParse(rawItems);
  if (!validationResult.success) {
    console.error("[recommendations] Zod validation failed:", validationResult.error.issues);
    return errorResponse("Réponse Claude invalide (schéma)", "LLM_ERROR", 500);
  }

  const items = validationResult.data;

  // 9. Delete existing recommendations for this audit (regeneration support)
  await supabase.from("recommendations").delete().eq("audit_id", audit_id);

  // 10. Insert new recommendations
  const toInsert = items.map((item) => ({
    ...item,
    audit_id,
    brand_id: auditRow.brand_id as string,
  }));

  const { data: inserted, error: insertErr } = await supabase
    .from("recommendations")
    .insert(toInsert)
    .select("id, title, description, priority, category, llm_target, is_done");

  if (insertErr || !inserted) {
    return databaseError(insertErr?.message);
  }

  const priorityOrder: Record<string, number> = { high: 1, medium: 2, low: 3 };
  const sorted = inserted.sort(
    (a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4)
  );

  return successResponse({ recommendations: sorted });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. If you see `Property 'X' does not exist on type`, check that the Supabase column names match the migration exactly (`is_mentioned`, `llm_response_id`, `llm_name`, `entity_type`).

- [ ] **Step 3: Commit**

```bash
git add "app/api/recommendations/route.ts"
git commit -m "feat: [US-09 step 1] — GET + POST /api/recommendations (Claude Haiku)"
```

---

## Task 2: PATCH `/api/recommendations/[id]/route.ts`

**Files:**
- Create: `app/api/recommendations/[id]/route.ts`

**Context:** Toggles `is_done` for a single recommendation. Next.js 16 App Router dynamic route params are passed as `{ params: Promise<{ id: string }> }` — must be awaited. Uses `{ count: "exact" }` on the update to detect missing rows (same pattern as the session route fix in US-B2).

- [ ] **Step 1: Create the file**

```typescript
// app/api/recommendations/[id]/route.ts
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { errorResponse, successResponse, notFound } from "@/lib/utils/api-error";

const patchBodySchema = z.object({
  is_done: z.boolean(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return errorResponse("Non authentifié", "UNAUTHORIZED", 401);

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return errorResponse("id invalide", "VALIDATION_ERROR", 400);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Corps JSON invalide", "VALIDATION_ERROR", 400);
  }

  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0].message, "VALIDATION_ERROR", 400);
  }

  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from("recommendations")
    .update({ is_done: parsed.data.is_done })
    .eq("id", id)
    .select("id", { count: "exact", head: true });

  if (error) return errorResponse(error.message, "DATABASE_ERROR", 500);
  if (count === 0) return notFound("Recommandation introuvable");

  return successResponse({ id, is_done: parsed.data.is_done });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/recommendations/[id]/route.ts"
git commit -m "feat: [US-09 step 2] — PATCH /api/recommendations/[id] toggle is_done"
```

---

## Task 3: Rewrite `/app/(dashboard)/recommandations/page.tsx`

**Files:**
- Rewrite: `app/(dashboard)/recommandations/page.tsx`

**Context:** Complete replacement of the existing page (which uses client-side `deriveRecommendations()`). The new page is a "use client" component. `auditId` is read from `localStorage.getItem("llmv_current_audit")` — same pattern as `dashboard/page.tsx`. The page has two visual states: empty (no recs yet) and generated (list of cards). The toggle uses optimistic update — update state immediately, revert on network failure. Do NOT add `min-h-screen` or `bg-[#0F0F1A]` to any wrapper — the parent layout provides these.

- [ ] **Step 1: Write the full file**

```tsx
// app/(dashboard)/recommandations/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  category: "content" | "technical" | "reputation" | "seo";
  llm_target: string;
  is_done: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PRIORITY_BADGE: Record<string, string> = {
  high: "border-red-500/30 bg-red-500/20 text-red-400",
  medium: "border-orange-500/30 bg-orange-500/20 text-orange-400",
  low: "border-green-500/30 bg-green-500/20 text-green-400",
};

const PRIORITY_LABEL: Record<string, string> = {
  high: "HAUTE",
  medium: "MOYENNE",
  low: "FAIBLE",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RecommandationsPage() {
  const router = useRouter();
  const [auditId, setAuditId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("llmv_current_audit");
    if (!id) {
      router.push("/step-1");
      return;
    }
    setAuditId(id);

    const fetchRecs = async () => {
      try {
        const res = await fetch(`/api/recommendations?audit_id=${id}`);
        const json = (await res.json()) as {
          ok: boolean;
          data?: { recommendations: Recommendation[] };
          error?: string;
        };
        if (json.ok && json.data) {
          setRecommendations(json.data.recommendations);
        }
      } catch {
        // silent — empty state shown
      } finally {
        setLoading(false);
      }
    };

    void fetchRecs();
  }, [router]);

  async function handleGenerate() {
    if (!auditId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audit_id: auditId }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: { recommendations: Recommendation[] };
        error?: string;
      };
      if (json.ok && json.data) {
        setRecommendations(json.data.recommendations);
      } else {
        setError(json.error ?? "Erreur lors de la génération");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setGenerating(false);
    }
  }

  async function handleToggle(id: string, current: boolean) {
    // Optimistic update
    setRecommendations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, is_done: !current } : r))
    );
    try {
      const res = await fetch(`/api/recommendations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_done: !current }),
      });
      if (!res.ok) throw new Error("PATCH failed");
    } catch {
      // Revert on failure
      setRecommendations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, is_done: current } : r))
      );
    }
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
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="text-white">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Recommandations IA</h1>
            <p className="mt-1 text-sm text-white/60">
              {recommendations.length > 0
                ? `${recommendations.length} recommandations · Claude Haiku`
                : "Générées par Claude Haiku à partir de votre audit"}
            </p>
          </div>
          {recommendations.length > 0 && (
            <Button
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 hover:text-white text-xs flex-shrink-0"
              onClick={() => void handleGenerate()}
              disabled={generating}
            >
              {generating ? "…" : "↺ Régénérer"}
            </Button>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {/* Empty state */}
        {recommendations.length === 0 && (
          <Card className="border-white/10 bg-white/5">
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <div className="w-10 h-10 rounded-xl bg-[#6B54FA]/20 flex items-center justify-center">
                <Lightbulb className="text-[#6B54FA]" size={20} />
              </div>
              <p className="text-white font-semibold">Aucune recommandation générée</p>
              <p className="text-white/50 text-sm text-center max-w-xs">
                Cliquez pour analyser vos résultats et obtenir des conseils personnalisés.
              </p>
              <Button
                onClick={() => void handleGenerate()}
                disabled={generating}
              >
                {generating ? "Génération en cours…" : "✨ Générer mes recommandations"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Recommendation cards */}
        {recommendations.length > 0 && (
          <div className="space-y-3">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                className={`border rounded-lg p-4 flex gap-3 transition-opacity border-white/10 bg-white/5 ${
                  rec.is_done ? "opacity-50" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={rec.is_done}
                  onChange={() => void handleToggle(rec.id, rec.is_done)}
                  className="mt-0.5 accent-[#6B54FA] flex-shrink-0 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold border ${
                        PRIORITY_BADGE[rec.priority] ?? PRIORITY_BADGE.low
                      }`}
                    >
                      {PRIORITY_LABEL[rec.priority] ?? rec.priority}
                    </span>
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] border border-[#6B54FA]/30 bg-[#6B54FA]/10 text-[#6B54FA]">
                      {rec.category}
                    </span>
                    <span className="text-[10px] text-white/40">{rec.llm_target}</span>
                  </div>
                  <p
                    className={`text-sm font-semibold ${
                      rec.is_done ? "line-through text-white/40" : "text-white"
                    }`}
                  >
                    {rec.title}
                  </p>
                  <p className="text-xs text-white/60 mt-1">{rec.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/recommandations/page.tsx"
git commit -m "feat: [US-09 step 3] — page recommandations IA avec génération + toggle"
```

---

## Final Verification

- [ ] Run `npx tsc --noEmit` — zero errors
- [ ] Start dev server: `npm run dev:local`
- [ ] Navigate to `/recommandations` — empty state shows "Aucune recommandation générée" + button
- [ ] Click "Générer mes recommandations" — loading state, then 4 cards appear with priority/category/llm_target badges
- [ ] Tick a checkbox — card turns translucent, title gets strikethrough (optimistic)
- [ ] Reload page — checkbox state persists (fetched from DB)
- [ ] Click "↺ Régénérer" — new set of recommendations replaces the old ones
- [ ] Check Supabase `recommendations` table — rows present with correct audit_id and brand_id
