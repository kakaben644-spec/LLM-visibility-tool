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

const SYSTEM_PROMPT = `Tu es un expert en stratégie de contenu et en référencement dans les LLMs.
À partir du contenu d'un site web, génère entre 6 et 8 questions en français
qu'un utilisateur pourrait poser à un LLM (GPT-4, Claude, Gemini) pour trouver
une solution comme celle proposée par cette marque.
Réponds UNIQUEMENT avec un JSON valide, sans markdown ni backticks.
Format : { "prompts": [{ "text": "...", "category": "Découverte|Comparatif|Réputation|Éducatif" }] }
Règles :

6 à 8 questions minimum
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

function buildUserMessage(brandName: string, scrapedContent: string): string {
  if (scrapedContent.trim() === "") {
    return `Génère au moins 4 questions génériques pour la marque suivante : "${brandName}". La marque n'a pas de contenu de site disponible.`;
  }
  return `Marque : "${brandName}"\n\nContenu du site :\n${scrapedContent}`;
}

async function callClaudeForPrompts(
  brandName: string,
  scrapedContent: string
): Promise<GeneratedPrompt[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw llmError("ANTHROPIC_API_KEY manquant dans les variables d'environnement");
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildUserMessage(brandName, scrapedContent),
      },
    ],
  });

  const firstBlock = response.content[0];
  const rawText = firstBlock?.type === "text" ? firstBlock.text.trim() : "";

  try {
    const parsed = JSON.parse(rawText) as ClaudePromptsResponse;
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
  } catch {
    return getFallbackPrompts(brandName);
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
    const { scraped_content, brand_name } = input;

    // Generate prompts via Claude — DB writes happen later in audit/start
    const prompts = await callClaudeForPrompts(brand_name, scraped_content);

    return successResponse({ prompts });
  } catch (err) {
    return errorResponse(err);
  }
}
