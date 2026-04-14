import { NextRequest } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  errorResponse,
  successResponse,
  notFound,
  databaseError,
} from "@/lib/utils/api-error";
import type { LlmResponse } from "@/lib/types";

export const maxDuration = 8;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const ParamsSchema = z.object({
  id: z.string().min(1, "audit_id est requis"),
});

// ---------------------------------------------------------------------------
// Row types returned by Supabase
// ---------------------------------------------------------------------------

interface LlmResponseRow {
  id: string;
  prompt_id: string;
  llm_name: string;
  response_text: string | null;
  error: string | null;
  prompts: {
    prompt_text: string;
  };
}

// ---------------------------------------------------------------------------
// GET /api/audit/[id]/responses
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const raw = await params;
    const { id: auditId } = ParamsSchema.parse(raw);

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("llm_responses")
      .select(
        `id,
         prompt_id,
         llm_name,
         response_text,
         error,
         prompts!inner ( prompt_text )`
      )
      .eq("audit_id", auditId)
      .order("prompt_id", { ascending: true });

    if (error) {
      throw databaseError("Impossible de récupérer les réponses LLM.");
    }

    if (!data) {
      throw notFound("Aucune réponse trouvée pour cet audit.");
    }

    const rows = data as unknown as LlmResponseRow[];

    const responses: LlmResponse[] = rows.map((row) => ({
      id: row.id,
      prompt_id: row.prompt_id,
      prompt_text: row.prompts.prompt_text,
      llm_name: row.llm_name,
      response_text: row.response_text,
      error: row.error,
    }));

    return successResponse({ responses });
  } catch (err) {
    return errorResponse(err);
  }
}
