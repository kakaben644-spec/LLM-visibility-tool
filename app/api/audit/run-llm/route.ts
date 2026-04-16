import { NextRequest } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  errorResponse,
  successResponse,
  databaseError,
} from "@/lib/utils/api-error";
import { callOpenAI } from "@/lib/llm/openai";
import { callClaude } from "@/lib/llm/claude";
import { callGemini } from "@/lib/llm/gemini";
import { detectMentions } from "@/lib/utils/mentions";
import type { LLMCallResult } from "@/lib/types";

export const maxDuration = 10;

// ---------------------------------------------------------------------------
// Schéma Zod
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  audit_id: z.string().uuid("audit_id doit être un UUID valide"),
  prompt_id: z.string().uuid("prompt_id doit être un UUID valide"),
  prompt_text: z.string().min(1),
  llm_name: z.enum(["gpt-4o", "claude-sonnet", "gemini-pro"]),
  brand_name: z.string().min(1),
  competitors: z.array(
    z.object({
      name: z.string().min(1),
      domain: z.string().min(1),
    })
  ),
});

// ---------------------------------------------------------------------------
// Types locaux
// ---------------------------------------------------------------------------

interface LlmResponseRow {
  id: string;
}

// ---------------------------------------------------------------------------
// POST /api/audit/run-llm
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    if (body === null) {
      throw new Error("Corps de la requête manquant");
    }

    const input = bodySchema.parse(body);

    // a) Appeler le bon LLM
    let llmResult: LLMCallResult;
    switch (input.llm_name) {
      case "gpt-4o":
        llmResult = await callOpenAI(input.prompt_text);
        break;
      case "claude-sonnet":
        llmResult = await callClaude(input.prompt_text);
        break;
      case "gemini-pro":
        llmResult = await callGemini(input.prompt_text);
        break;
    }

    const supabase = getSupabaseAdmin();

    // b) INSERT llm_responses
    const { data: llmResponse, error: llmResponseError } = await supabase
      .from("llm_responses")
      .insert({
        audit_id: input.audit_id,
        prompt_id: input.prompt_id,
        llm_name: input.llm_name,
        response_text: llmResult.response_text,
        tokens_used: llmResult.tokens_used ?? null,
        latency_ms: llmResult.latency_ms,
        error: llmResult.error ?? null,
      })
      .select("id")
      .single<LlmResponseRow>();

    if (llmResponseError || !llmResponse) {
      console.error("[audit/run-llm] llm_response insert error:", llmResponseError);
      throw databaseError("Impossible d'enregistrer la réponse LLM.");
    }

    // c) Analyser les mentions (brand + concurrents)
    const mentions = detectMentions({
      responseText: llmResult.response_text,
      brandName: input.brand_name,
      competitors: input.competitors,
    });

    // d) INSERT mention_results
    if (mentions.length > 0) {
      const { error: mentionError } = await supabase
        .from("mention_results")
        .insert(
          mentions.map((m) => ({
            llm_response_id: llmResponse.id,
            entity_name: m.entity_name,
            entity_type: m.entity_type,
            is_mentioned: m.is_mentioned,
            position: m.position,
            mention_count: m.mention_count,
          }))
        );

      if (mentionError) {
        console.error("[audit/run-llm] mention_results insert error:", mentionError);
        throw databaseError("Impossible d'enregistrer les mentions.");
      }
    }

    const brandMention = mentions.find((m) => m.entity_type === "brand");

    return successResponse({
      llm_response_id: llmResponse.id,
      brand_mentioned: brandMention?.is_mentioned ?? false,
      position: brandMention?.position ?? null,
      latency_ms: llmResult.latency_ms,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
