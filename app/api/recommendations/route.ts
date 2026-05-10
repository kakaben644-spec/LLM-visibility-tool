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
  category: z.enum(["content", "technical", "positioning", "competitors", "seo"]),
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
    .map((r) => Number(r.position))
    .filter((p) => !isNaN(p));
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

    absentTexts = (responseRows ?? [])
      .filter((r) => r.response_text !== null && r.llm_name !== null)
      .map((r) => ({
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
    "category": "content" | "technical" | "positioning" | "competitors" | "seo",
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
  const { error: deleteErr } = await supabase
    .from("recommendations")
    .delete()
    .eq("audit_id", audit_id);
  if (deleteErr) return databaseError(deleteErr.message);

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

  if (insertErr) return databaseError(insertErr.message);
  if (!inserted || inserted.length === 0) {
    return errorResponse("Aucune recommandation insérée", "DATABASE_ERROR", 500);
  }

  const postPriorityOrder: Record<string, number> = { high: 1, medium: 2, low: 3 };
  const sorted = inserted.sort(
    (a, b) => (postPriorityOrder[a.priority] ?? 4) - (postPriorityOrder[b.priority] ?? 4)
  );

  return successResponse({ recommendations: sorted });
}
