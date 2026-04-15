import { NextRequest } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  errorResponse,
  successResponse,
  notFound,
  databaseError,
} from "@/lib/utils/api-error";
import type { AuditScoreApiData, ScoreRankingEntry } from "@/lib/types";

export const maxDuration = 8;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const ParamsSchema = z.object({
  id: z.string().min(1, "audit_id est requis"),
});

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

interface AuditRow {
  id: string;
  brand_id: string;
  brands: {
    name: string;
  };
}

interface LlmResponseRow {
  id: string;
  llm_name: string;
  mention_results: MentionResultRow[];
}

interface MentionResultRow {
  entity_name: string;
  entity_type: string;
  is_mentioned: boolean;
  position: number | null;
  sentiment_score: number | null;
  mention_count: number;
}

// ---------------------------------------------------------------------------
// Score computation helpers
// ---------------------------------------------------------------------------

const LLM_NAME_TO_FIELD: Record<string, "score_gpt4o" | "score_claude" | "score_gemini"> = {
  "gpt-4o": "score_gpt4o",
  "claude-sonnet": "score_claude",
  "gemini-pro": "score_gemini",
};

type PerLlmCounts = {
  mentioned: number;
  total: number;
};

interface EntityAccumulator {
  entity_name: string;
  entity_type: "brand" | "competitor";
  byLlm: Record<string, PerLlmCounts>;
}

function computeScores(
  responses: LlmResponseRow[]
): Map<string, EntityAccumulator> {
  const map = new Map<string, EntityAccumulator>();

  for (const response of responses) {
    const llm = response.llm_name;

    for (const mr of response.mention_results) {
      const key = mr.entity_name.toLowerCase();

      if (!map.has(key)) {
        map.set(key, {
          entity_name: mr.entity_name,
          entity_type: mr.entity_type === "brand" ? "brand" : "competitor",
          byLlm: {},
        });
      }

      const acc = map.get(key)!;

      if (!acc.byLlm[llm]) {
        acc.byLlm[llm] = { mentioned: 0, total: 0 };
      }

      acc.byLlm[llm].total += 1;
      if (mr.is_mentioned) {
        acc.byLlm[llm].mentioned += 1;
      }
    }
  }

  return map;
}

function mentionRate(counts: PerLlmCounts | undefined): number {
  if (!counts || counts.total === 0) return 0;
  return (counts.mentioned / counts.total) * 100;
}

// ---------------------------------------------------------------------------
// GET /api/audit/[id]/score
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const raw = await params;
    const { id: auditId } = ParamsSchema.parse(raw);

    const supabase = getSupabaseAdmin();

    // ── 1. Fetch audit + brand name ──────────────────────────────────────────
    const { data: auditData, error: auditError } = await supabase
      .from("audits")
      .select(`id, brand_id, brands!inner ( name )`)
      .eq("id", auditId)
      .single<AuditRow>();

    if (auditError || !auditData) {
      throw notFound("Audit introuvable.");
    }

    const brandId = auditData.brand_id;
    const brandName = auditData.brands.name;

    // ── 2. Fetch llm_responses + mention_results ─────────────────────────────
    const { data: responseData, error: responseError } = await supabase
      .from("llm_responses")
      .select(
        `id,
         llm_name,
         mention_results ( entity_name, entity_type, is_mentioned, position, sentiment_score, mention_count )`
      )
      .eq("audit_id", auditId);

    if (responseError) {
      throw databaseError("Impossible de récupérer les réponses LLM.");
    }

    const responses = (responseData ?? []) as unknown as LlmResponseRow[];

    // ── 3. Compute per-entity per-LLM mention rates ──────────────────────────
    const entityMap = computeScores(responses);

    const ranking: ScoreRankingEntry[] = [];

    for (const acc of entityMap.values()) {
      const score_gpt4o = Math.round(mentionRate(acc.byLlm["gpt-4o"]));
      const score_claude = Math.round(mentionRate(acc.byLlm["claude-sonnet"]));
      const score_gemini = Math.round(mentionRate(acc.byLlm["gemini-pro"]));
      const total_score = Math.round((score_gpt4o + score_claude + score_gemini) / 3);

      ranking.push({
        entity_name: acc.entity_name,
        entity_type: acc.entity_type,
        total_score,
        score_gpt4o,
        score_claude,
        score_gemini,
      });
    }

    // Sort ranking: brand first, then competitors by total_score desc
    ranking.sort((a, b) => {
      if (a.entity_type === "brand" && b.entity_type !== "brand") return -1;
      if (a.entity_type !== "brand" && b.entity_type === "brand") return 1;
      return b.total_score - a.total_score;
    });

    const brandEntry = ranking.find((r) => r.entity_type === "brand");
    const brand_score = brandEntry?.total_score ?? 0;

    // ── 4. Upsert scores into DB ─────────────────────────────────────────────
    // Delete existing scores for this audit, then re-insert
    await supabase.from("scores").delete().eq("audit_id", auditId);

    if (ranking.length > 0) {
      const scoreRows = ranking.map((r) => ({
        audit_id: auditId,
        brand_id: brandId,
        entity_name: r.entity_name,
        entity_type: r.entity_type,
        total_score: r.total_score,
        mention_rate: r.total_score / 100,
        score_gpt4o: r.score_gpt4o,
        score_claude: r.score_claude,
        score_gemini: r.score_gemini,
      }));

      const { error: insertError } = await supabase
        .from("scores")
        .insert(scoreRows);

      if (insertError) {
        // Non-fatal: log but still return computed scores
        console.error("[GET /api/audit/[id]/score] scores insert error:", insertError);
      }
    }

    // ── 5. Return result ─────────────────────────────────────────────────────
    const result: AuditScoreApiData = {
      brand_name: brandName,
      brand_score,
      ranking,
    };

    return successResponse(result);
  } catch (err) {
    return errorResponse(err);
  }
}
