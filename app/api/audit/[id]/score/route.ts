import { NextRequest } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  errorResponse,
  successResponse,
  notFound,
  databaseError,
} from "@/lib/utils/api-error";

export const maxDuration = 8;

// ---------------------------------------------------------------------------
// Types locaux
// ---------------------------------------------------------------------------

interface LlmResponseRow {
  id: string;
  llm_name: string;
}

interface MentionRow {
  llm_response_id: string;
  entity_name: string;
  entity_type: string;
  is_mentioned: boolean;
  position: number | null;
}

interface ScoreEntry {
  entity_name: string;
  entity_type: "brand" | "competitor";
  total_score: number;
  mention_rate: number;
  avg_position: number | null;
  sentiment_score: number | null;
  score_claude_haiku: number | null;
  score_mistral: number | null;
}

interface MentionItem {
  llm_name: string;
  is_mentioned: boolean;
  position: number | null;
}

// ---------------------------------------------------------------------------
// GET /api/audit/[id]/score
// Calcule les scores à la volée depuis mention_results
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: auditId } = await params;
    const supabase = getSupabaseAdmin();

    // a) Vérifier que l'audit existe
    const { data: audit, error: auditError } = await supabase
      .from("audits")
      .select("id")
      .eq("id", auditId)
      .single();

    if (auditError || !audit) {
      throw notFound("Audit introuvable.");
    }

    // b) Récupérer toutes les llm_responses de l'audit
    const { data: rawResponses, error: responsesError } = await supabase
      .from("llm_responses")
      .select("id, llm_name")
      .eq("audit_id", auditId);

    if (responsesError) {
      throw databaseError("Impossible de récupérer les réponses LLM.");
    }

    const llmResponses = (rawResponses ?? []) as LlmResponseRow[];

    if (llmResponses.length === 0) {
      return successResponse({ scores: [] });
    }

    const responseIds = llmResponses.map((r) => r.id);
    const responseMap = new Map(llmResponses.map((r) => [r.id, r.llm_name]));

    // c) Récupérer tous les mention_results pour ces réponses
    const { data: rawMentions, error: mentionsError } = await supabase
      .from("mention_results")
      .select("llm_response_id, entity_name, entity_type, is_mentioned, position")
      .in("llm_response_id", responseIds);

    if (mentionsError) {
      throw databaseError("Impossible de récupérer les mentions.");
    }

    const mentions = (rawMentions ?? []) as MentionRow[];

    // d) Grouper par entité
    const entityGroups = new Map<
      string,
      { entity_type: string; items: MentionItem[] }
    >();

    for (const m of mentions) {
      const llm_name = responseMap.get(m.llm_response_id) ?? "unknown";
      const existing = entityGroups.get(m.entity_name);
      if (!existing) {
        entityGroups.set(m.entity_name, {
          entity_type: m.entity_type,
          items: [{ llm_name, is_mentioned: m.is_mentioned, position: m.position }],
        });
      } else {
        existing.items.push({ llm_name, is_mentioned: m.is_mentioned, position: m.position });
      }
    }

    // e) Calculer les scores par entité
    const scores: ScoreEntry[] = [];

    for (const [entity_name, { entity_type, items }] of entityGroups) {
      const resolvedType: "brand" | "competitor" =
        entity_type === "brand" ? "brand" : "competitor";

      const total = items.length;
      const mentioned = items.filter((m) => m.is_mentioned).length;
      const mention_rate = total > 0 ? mentioned / total : 0;

      const positions = items
        .filter((m) => m.position !== null)
        .map((m) => m.position as number);
      const avg_position =
        positions.length > 0
          ? positions.reduce((a, b) => a + b, 0) / positions.length
          : null;

      const calcLlmScore = (llmName: string): number | null => {
        const group = items.filter((m) => m.llm_name === llmName);
        if (group.length === 0) return null;
        return Math.round(
          (group.filter((m) => m.is_mentioned).length / group.length) * 100
        );
      };

      scores.push({
        entity_name,
        entity_type: resolvedType,
        total_score: Math.round(mention_rate * 100),
        mention_rate,
        avg_position: avg_position !== null ? Math.round(avg_position * 10) / 10 : null,
        sentiment_score: null,
        score_claude_haiku: calcLlmScore("claude-haiku"),
        score_mistral: calcLlmScore("mistral"),
      });
    }

    // f) Trier : brand en premier, puis par score décroissant
    scores.sort((a, b) => {
      if (a.entity_type === "brand" && b.entity_type !== "brand") return -1;
      if (a.entity_type !== "brand" && b.entity_type === "brand") return 1;
      return b.total_score - a.total_score;
    });

    return successResponse({ scores });
  } catch (err) {
    return errorResponse(err);
  }
}
