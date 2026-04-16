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
  response_text: string;
  prompt_id: string;
}

interface PromptRow {
  id: string;
  text: string;
}

interface MentionRow {
  llm_response_id: string;
  is_mentioned: boolean;
  position: number | null;
}

interface LlmResponseOut {
  id: string;
  prompt_text: string;
  llm_name: string;
  response_text: string;
  is_mentioned: boolean;
  mention_position: number | null;
}

// ---------------------------------------------------------------------------
// GET /api/audit/[id]/responses
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

    // b) Récupérer les llm_responses (colonne DB: response_text, text sur prompts)
    const { data: rawResponses, error: responsesError } = await supabase
      .from("llm_responses")
      .select("id, llm_name, response_text, prompt_id")
      .eq("audit_id", auditId)
      .order("created_at", { ascending: true });

    if (responsesError) {
      throw databaseError("Impossible de récupérer les réponses LLM.");
    }

    const llmResponses = (rawResponses ?? []) as LlmResponseRow[];

    if (llmResponses.length === 0) {
      return successResponse({ responses: [] });
    }

    // c) Récupérer les textes des prompts
    const promptIds = [...new Set(llmResponses.map((r) => r.prompt_id))];

    const { data: rawPrompts, error: promptsError } = await supabase
      .from("prompts")
      .select("id, text")
      .in("id", promptIds);

    if (promptsError) {
      throw databaseError("Impossible de récupérer les prompts.");
    }

    const prompts = (rawPrompts ?? []) as PromptRow[];
    const promptMap = new Map(prompts.map((p) => [p.id, p.text]));

    // d) Récupérer les mention_results (brand uniquement)
    const responseIds = llmResponses.map((r) => r.id);

    const { data: rawMentions, error: mentionsError } = await supabase
      .from("mention_results")
      .select("llm_response_id, is_mentioned, position")
      .in("llm_response_id", responseIds)
      .eq("entity_type", "brand");

    if (mentionsError) {
      throw databaseError("Impossible de récupérer les mentions.");
    }

    const mentions = (rawMentions ?? []) as MentionRow[];
    const mentionMap = new Map(mentions.map((m) => [m.llm_response_id, m]));

    // e) Assembler la réponse
    const responses: LlmResponseOut[] = llmResponses.map((r) => ({
      id: r.id,
      prompt_text: promptMap.get(r.prompt_id) ?? "",
      llm_name: r.llm_name,
      response_text: r.response_text,
      is_mentioned: mentionMap.get(r.id)?.is_mentioned ?? false,
      mention_position: mentionMap.get(r.id)?.position ?? null,
    }));

    return successResponse({ responses });
  } catch (err) {
    return errorResponse(err);
  }
}
