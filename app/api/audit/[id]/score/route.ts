import { z } from "zod";
import { NextRequest } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  calculateScore,
  type ScoreEntry,
  type LlmName,
} from "@/lib/utils/score";
import {
  AppError,
  API_ERROR_CODES,
  errorResponse,
  successResponse,
  notFound,
  databaseError,
} from "@/lib/utils/api-error";
import type { MentionAnalysis } from "@/lib/types";

export const maxDuration = 8;

// ─── Validation ───────────────────────────────────────────────────────────────

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

// ─── Local types ──────────────────────────────────────────────────────────────

interface AuditRow {
  id: string;
  brand_id: string;
  status: string;
}

interface MentionResultRow {
  entity_name: string;
  entity_type: string;
  is_mentioned: boolean;
  position: number | null;
  mention_count: number;
}

interface LlmResponseRow {
  llm_name: string;
  response_text: string;
  mention_results: MentionResultRow[];
}

interface EntityScore {
  entity_name: string;
  entity_type: string;
  total_score: number;
  mention_rate: number;
  avg_position: number | null;
  sentiment_score: number;
  score_by_llm: Record<LlmName, number>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_LLM_NAMES: LlmName[] = ["gpt-4o", "claude-sonnet", "gemini-pro"];

// ─── GET /api/audit/[id]/score ────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Step 1 — Validate params
    const { id: auditId } = ParamsSchema.parse(await params);

    const supabase = getSupabaseAdmin();

    // Step 2 — Fetch audit
    const { data: audit, error: auditError } = await supabase
      .from("audits")
      .select("id, brand_id, status")
      .eq("id", auditId)
      .single<AuditRow>();

    if (auditError || !audit) {
      throw notFound("Audit introuvable.");
    }

    if (audit.status !== "completed") {
      throw new AppError(
        "L'audit n'est pas encore terminé.",
        API_ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }

    // Step 3 — Fetch llm_responses + nested mention_results for this audit
    const { data: llmRows, error: llmError } = await supabase
      .from("llm_responses")
      .select(
        `
        llm_name,
        response_text,
        mention_results (
          entity_name,
          entity_type,
          is_mentioned,
          position,
          mention_count
        )
      `
      )
      .eq("audit_id", auditId);

    if (llmError) {
      throw databaseError("Impossible de récupérer les résultats de mention.");
    }

    const rows = (llmRows ?? []) as LlmResponseRow[];

    // Step 4 — Group by entity, build ScoreEntry[], call calculateScore()
    const entityMap = new Map<
      string,
      { entity_type: string; entries: ScoreEntry[] }
    >();

    for (const row of rows) {
      if (!VALID_LLM_NAMES.includes(row.llm_name as LlmName)) continue;
      const llmName = row.llm_name as LlmName;

      for (const mr of row.mention_results) {
        let entityEntry = entityMap.get(mr.entity_name);
        if (!entityEntry) {
          entityEntry = { entity_type: mr.entity_type, entries: [] };
          entityMap.set(mr.entity_name, entityEntry);
        }

        const mention: MentionAnalysis = {
          entity_name: mr.entity_name,
          entity_type: mr.entity_type as "brand" | "competitor",
          is_mentioned: mr.is_mentioned,
          position: mr.position,
          mention_count: mr.mention_count,
        };

        entityEntry.entries.push({
          response_text: row.response_text,
          mention,
          llm_name: llmName,
        });
      }
    }

    const entityScores: EntityScore[] = [];

    for (const [entity_name, { entity_type, entries }] of entityMap) {
      const result = calculateScore(entries);
      entityScores.push({ entity_name, entity_type, ...result });
    }

    // Step 5 — Delete existing scores for this audit, then insert fresh rows
    const { error: deleteError } = await supabase
      .from("scores")
      .delete()
      .eq("audit_id", auditId);

    if (deleteError) {
      throw databaseError("Impossible de supprimer les scores existants.");
    }

    if (entityScores.length > 0) {
      const scoresToInsert = entityScores.map((es) => ({
        audit_id: auditId,
        brand_id: audit.brand_id,
        entity_name: es.entity_name,
        entity_type: es.entity_type,
        total_score: es.total_score,
        mention_rate: es.mention_rate,
        avg_position: es.avg_position,
        sentiment_score: es.sentiment_score,
        score_gpt4o: es.score_by_llm["gpt-4o"],
        score_claude: es.score_by_llm["claude-sonnet"],
        score_gemini: es.score_by_llm["gemini-pro"],
      }));

      const { error: insertError } = await supabase
        .from("scores")
        .insert(scoresToInsert);

      if (insertError) {
        throw databaseError("Impossible d'enregistrer les scores.");
      }
    }

    // Step 6 — Build and return response
    const brandScore = entityScores.find((es) => es.entity_type === "brand") ?? null;
    const competitorScores = entityScores.filter(
      (es) => es.entity_type === "competitor"
    );

    const ranking = [...entityScores]
      .sort((a, b) => b.total_score - a.total_score)
      .map((es) => ({
        entity_name: es.entity_name,
        entity_type: es.entity_type,
        total_score: es.total_score,
      }));

    return successResponse({ brand_score: brandScore, competitor_scores: competitorScores, ranking });
  } catch (err) {
    return errorResponse(err);
  }
}
