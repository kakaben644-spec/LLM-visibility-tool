import { NextRequest } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  errorResponse,
  successResponse,
  notFound,
  databaseError,
} from "@/lib/utils/api-error";
import type { AuditStatus } from "@/lib/types";

export const maxDuration = 8;

// ---------------------------------------------------------------------------
// Types locaux
// ---------------------------------------------------------------------------

interface AuditRow {
  id: string;
  brand_id: string;
  status: string;
  created_at: string;
}

interface LlmResponseRow {
  llm_name: string;
  error: string | null;
}

interface PromptRow {
  id: string;
}

// ---------------------------------------------------------------------------
// GET /api/audit/[id]/status
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: auditId } = await params;
    const supabase = getSupabaseAdmin();

    // a) SELECT audit
    const { data: audit, error: auditError } = await supabase
      .from("audits")
      .select("id, brand_id, status, created_at")
      .eq("id", auditId)
      .single<AuditRow>();

    if (auditError || !audit) {
      throw notFound("Audit introuvable.");
    }

    // b) Compter les llm_responses pour cet audit
    const { data: responses, error: responsesError } = await supabase
      .from("llm_responses")
      .select("llm_name, error")
      .eq("audit_id", auditId);

    if (responsesError) {
      throw databaseError("Impossible de récupérer les réponses LLM.");
    }

    const llmResponses = (responses ?? []) as LlmResponseRow[];

    // c) Total attendu = prompts actifs × 3 LLMs
    const { data: prompts, error: promptsError } = await supabase
      .from("prompts")
      .select("id")
      .eq("brand_id", audit.brand_id)
      .eq("is_active", true);

    if (promptsError) {
      throw databaseError("Impossible de récupérer les prompts.");
    }

    const promptRows = (prompts ?? []) as PromptRow[];
    const expectedResponses = promptRows.length * 3;
    const totalResponses = llmResponses.length;

    const progressPct =
      expectedResponses > 0
        ? Math.min(100, Math.round((totalResponses / expectedResponses) * 100))
        : 0;

    const completedLlms = [
      ...new Set(llmResponses.filter((r) => !r.error).map((r) => r.llm_name)),
    ];
    const failedLlms = [
      ...new Set(llmResponses.filter((r) => r.error).map((r) => r.llm_name)),
    ];

    // d) Marquer completed si toutes les réponses reçues OU si le temps
    //    imparti est écoulé. Threshold : 5s/appel (moyenne réelle entre
    //    appels rapides en erreur et appels LLM lents), ce qui donne
    //    120s pour 24 appels — inférieur au timeout client de 180s.
    const elapsedMs = Date.now() - new Date(audit.created_at).getTime();
    const timeoutMs = expectedResponses * 5000;
    const allReceived = expectedResponses > 0 && totalResponses >= expectedResponses;
    const timedOut = expectedResponses > 0 && elapsedMs > timeoutMs;

    let status = audit.status as AuditStatus;
    if ((allReceived || timedOut) && status === "running") {
      const { error: updateError } = await supabase
        .from("audits")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", auditId);

      if (!updateError) {
        status = "completed";
      }
    }

    return successResponse({
      audit_id: auditId,
      status,
      progress_pct: progressPct,
      completed_llms: completedLlms,
      failed_llms: failedLlms,
      total_responses: totalResponses,
      expected_responses: expectedResponses,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
