import { NextRequest } from "next/server";
import { z } from "zod";
import { FirecrawlAppV1 as FirecrawlApp } from "@mendable/firecrawl-js";

import {
  errorResponse,
  successResponse,
  AppError,
  API_ERROR_CODES,
} from "@/lib/utils/api-error";
import { checkRateLimit } from "@/lib/utils/rate-limit";

export const maxDuration = 8;

const scrapeSchema = z.object({
  url: z.string().url("URL invalide"),
});

const CONTENT_MAX_CHARS = 8000;

export async function POST(req: NextRequest) {
  const rateLimitResponse = await checkRateLimit(req, "scrape", 10, 3600);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body: unknown = await req.json().catch(() => null);
    if (body === null) {
      throw new AppError(
        "Corps de la requête manquant",
        API_ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }

    const { url } = scrapeSchema.parse(body);

    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new AppError(
        "FIRECRAWL_API_KEY manquant",
        API_ERROR_CODES.INTERNAL_ERROR,
        500
      );
    }

    const firecrawl = new FirecrawlApp({ apiKey });

    const result = await firecrawl.scrapeUrl(url, {
      formats: ["markdown"],
    });

    if (!result.success || !result.markdown) {
      throw new AppError(
        "Impossible de scraper cette URL. Vérifie qu'elle est accessible publiquement.",
        API_ERROR_CODES.SCRAPE_ERROR,
        422
      );
    }

    const content = result.markdown.slice(0, CONTENT_MAX_CHARS);

    return successResponse({ content, url });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);

    // Erreur réseau ou URL inaccessible
    const message =
      err instanceof Error && err.message.includes("fetch")
        ? "L'URL est inaccessible. Vérifie que le site est en ligne."
        : "Une erreur est survenue lors du scraping.";

    return errorResponse(
      new AppError(message, API_ERROR_CODES.SCRAPE_ERROR, 422)
    );
  }
}
