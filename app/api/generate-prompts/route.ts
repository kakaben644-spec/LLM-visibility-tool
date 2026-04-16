import { NextRequest } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

import {
  errorResponse,
  successResponse,
  llmError,
  AppError,
  API_ERROR_CODES,
} from "@/lib/utils/api-error";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { fetchSerperContext } from "@/lib/utils/serper";

export const maxDuration = 10;

// ─── Zod schema ───────────────────────────────────────────────────────────────

const bodySchema = z.object({
  scraped_content: z.string(),
  brand_name: z.string().min(1),
});

// ─── Types ────────────────────────────────────────────────────────────────────

type PromptCategory = "Découverte" | "Comparatif" | "Réputation" | "Éducatif";

interface GeneratedPrompt {
  text: string;
  category: PromptCategory;
}

interface ClaudePromptsResponse {
  prompts: GeneratedPrompt[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert at crafting audit questions. You MUST respond with ONLY a raw JSON array — no markdown, no backticks, no explanation, no preamble. Your entire response must be parseable by JSON.parse() directly.
Format : { "prompts": [{ "text": "...", "category": "Découverte|Comparatif|Réputation|Éducatif" }] }
Règles :

6 à 8 questions minimum en français
Au moins 1 question par catégorie
Questions naturelles, comme si un vrai utilisateur les tapait dans un chat`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getFallbackPrompts(brandName: string): GeneratedPrompt[] {
  return [
    {
      text: `Quelles sont les meilleures solutions similaires à ${brandName} ?`,
      category: "Comparatif",
    },
    {
      text: `Comment fonctionne ${brandName} ?`,
      category: "Éducatif",
    },
    {
      text: `Quels sont les avis sur ${brandName} ?`,
      category: "Réputation",
    },
    {
      text: `Comment trouver un outil comme ${brandName} ?`,
      category: "Découverte",
    },
  ];
}

function buildUserMessage(brandName: string, scrapedContent: string, serperContext: string): string {
  const parts: string[] = [`Marque : "${brandName}"`];

  if (serperContext.trim() !== "") {
    parts.push(`\nRésultats de recherche Google :\n${serperContext}`);
  }

  if (scrapedContent.trim() !== "") {
    const truncated = scrapedContent.slice(0, 4000);
    parts.push(`\nContenu du site :\n${truncated}`);
  } else {
    parts.push("\nAucun contenu de site disponible.");
  }

  return parts.join("\n");
}

async function callClaudeForPrompts(
  brandName: string,
  scrapedContent: string,
  serperContext: string
): Promise<GeneratedPrompt[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw llmError("ANTHROPIC_API_KEY manquant dans les variables d'environnement");
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildUserMessage(brandName, scrapedContent, serperContext),
      },
    ],
  });

  const firstBlock = response.content[0];
  const raw = firstBlock?.type === "text" ? firstBlock.text.trim() : "";

  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as ClaudePromptsResponse;
    if (
      parsed &&
      Array.isArray(parsed.prompts) &&
      parsed.prompts.length > 0 &&
      parsed.prompts.every(
        (p) => typeof p.text === "string" && typeof p.category === "string"
      )
    ) {
      return parsed.prompts;
    }
    return getFallbackPrompts(brandName);
  } catch (e) {
    console.error("[generate-prompts] JSON.parse failed:", e);
    console.error("[generate-prompts] Raw response was:", raw);
    return getFallbackPrompts(brandName);
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rateLimitResponse = await checkRateLimit(req, "generate-prompts", 10, 3600);
  if (rateLimitResponse) return rateLimitResponse;

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
    const { scraped_content, brand_name } = input;

    // Enrich context with Google search results (soft-fail: empty string on error)
    const serperContext = await fetchSerperContext(brand_name);

    // Generate prompts via Claude — DB writes happen later in audit/start
    const prompts = await callClaudeForPrompts(brand_name, scraped_content, serperContext);

    return successResponse({ prompts });
  } catch (err) {
    return errorResponse(err);
  }
}
