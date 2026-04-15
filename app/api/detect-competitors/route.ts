import { NextRequest } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  errorResponse,
  successResponse,
  notFound,
  databaseError,
  llmError,
  AppError,
  API_ERROR_CODES,
} from "@/lib/utils/api-error";

export const maxDuration = 10;

// ─── Zod schema ───────────────────────────────────────────────────────────────

const bodySchema = z.object({
  session_token: z.string().min(1),
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface Competitor {
  name: string;
  url: string;
}

interface ClaudeCompetitorsResponse {
  competitors: Competitor[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un expert en intelligence concurrentielle.
À partir du contenu d'un site web, identifie 3 à 5 concurrents directs de cette entreprise.
Réponds UNIQUEMENT avec un JSON valide, sans markdown ni backticks.
Format : { "competitors": [{ "name": "NomConcurrent", "url": "concurrent.com" }] }
Règles :
- Entre 3 et 5 concurrents uniquement
- Le champ "url" doit être un nom de domaine (sans https://, sans chemin)
- Si le contenu est insuffisant, déduis les concurrents à partir du nom de domaine`;

// ─── Helper ───────────────────────────────────────────────────────────────────

async function callClaudeForCompetitors(
  brandUrl: string,
  scrapedContent: string
): Promise<Competitor[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw llmError("ANTHROPIC_API_KEY manquant dans les variables d'environnement");
  }

  const client = new Anthropic({ apiKey });

  const userMessage =
    scrapedContent.trim()
      ? `Site web : ${brandUrl}\n\nContenu du site :\n${scrapedContent.slice(0, 4000)}`
      : `Site web : ${brandUrl}\n\nContenu du site non disponible. Déduis les concurrents à partir du domaine.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const firstBlock = response.content[0];
  const rawText = firstBlock?.type === "text" ? firstBlock.text.trim() : "";

  try {
    const parsed = JSON.parse(rawText) as ClaudeCompetitorsResponse;
    if (
      parsed &&
      Array.isArray(parsed.competitors) &&
      parsed.competitors.length >= 3 &&
      parsed.competitors.length <= 5 &&
      parsed.competitors.every(
        (c) => typeof c.name === "string" && typeof c.url === "string"
      )
    ) {
      return parsed.competitors;
    }
    return [];
  } catch {
    return [];
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    if (body === null) {
      throw new AppError(
        "Corps de la requête manquant ou invalide",
        API_ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }

    const input = bodySchema.parse(body);
    const { session_token } = input;

    // 1. Fetch session from Supabase
    const supabase = getSupabaseAdmin();

    const { data: session, error: sessionError } = await supabase
      .from("onboarding_sessions")
      .select("id, brand_url, scraped_content")
      .eq("session_token", session_token)
      .single<{
        id: string;
        brand_url: string | null;
        scraped_content: string | null;
      }>();

    if (sessionError || !session) {
      throw notFound(
        "Session introuvable ou expirée. Merci de recommencer l'onboarding."
      );
    }

    const brandUrl = session.brand_url ?? "";
    const scrapedContent = session.scraped_content ?? "";

    // 2. Detect competitors via Claude
    const competitors = await callClaudeForCompetitors(brandUrl, scrapedContent);

    // 3. Save competitors to onboarding_sessions.competitors
    const { error: updateError } = await supabase
      .from("onboarding_sessions")
      .update({ competitors, current_step: 3 })
      .eq("session_token", session_token);

    if (updateError) {
      console.error("[POST /api/detect-competitors] Supabase update error:", updateError);
      throw databaseError("Impossible d'enregistrer les concurrents détectés.");
    }

    return successResponse({ competitors });
  } catch (err) {
    return errorResponse(err);
  }
}
