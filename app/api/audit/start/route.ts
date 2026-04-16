import { NextRequest } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  errorResponse,
  successResponse,
  notFound,
  databaseError,
  AppError,
  API_ERROR_CODES,
} from "@/lib/utils/api-error";

export const maxDuration = 8;

// ---------------------------------------------------------------------------
// Schémas Zod
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  session_token: z.string().uuid("session_token doit être un UUID valide"),
});

const selectedPromptSchema = z.object({
  text: z.string().min(1),
  category: z.string().optional(),
  is_custom: z.boolean().optional().default(false),
});

const competitorItemSchema = z.object({
  name: z.string().min(1),
  url: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Types locaux (alignés sur 001_init.sql)
// ---------------------------------------------------------------------------

interface OnboardingSessionRow {
  id: string;
  brand_name: string | null;
  brand_url: string | null;
  brand_country: string;
  account_type: string;
  scraped_content: string | null;
  selected_prompts: unknown[];
  competitors: unknown[];
  completed: boolean;
}

interface BrandRow {
  id: string;
}

interface PromptInserted {
  id: string;
  text: string;
  category: string | null;
}

interface AuditRow {
  id: string;
}

// ---------------------------------------------------------------------------
// POST /api/audit/start
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    if (body === null) {
      throw new AppError("Corps de la requête manquant", API_ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const { session_token } = bodySchema.parse(body);
    const supabase = getSupabaseAdmin();

    // a) Récupérer la session non terminée
    const { data: session, error: sessionError } = await supabase
      .from("onboarding_sessions")
      .select(
        "id, brand_name, brand_url, brand_country, account_type, scraped_content, selected_prompts, competitors, completed"
      )
      .eq("session_token", session_token)
      .eq("completed", false)
      .single<OnboardingSessionRow>();

    if (sessionError || !session) {
      throw notFound("Session introuvable ou déjà terminée.");
    }

    // b) Vérifier brand_name et brand_url
    if (!session.brand_name || !session.brand_url) {
      throw new AppError(
        "Session incomplète — étapes 1-3 requises",
        API_ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }

    // c) INSERT brand
    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .insert({
        name: session.brand_name,
        url: session.brand_url,
        country: session.brand_country,
        account_type: session.account_type,
        scraped_content: session.scraped_content,
      })
      .select("id")
      .single<BrandRow>();

    if (brandError || !brand) {
      console.error("[audit/start] brand insert error:", brandError);
      throw databaseError("Impossible de créer la marque.");
    }

    const brandId = brand.id;

    // d) INSERT prompts
    const rawPrompts = Array.isArray(session.selected_prompts)
      ? session.selected_prompts
      : [];
    const parsedPrompts = rawPrompts.map((p) => selectedPromptSchema.parse(p));

    const { data: insertedPrompts, error: promptsError } = await supabase
      .from("prompts")
      .insert(
        parsedPrompts.map((p) => ({
          brand_id: brandId,
          text: p.text,
          category: p.category ?? null,
          is_custom: p.is_custom,
        }))
      )
      .select("id, text, category");

    if (promptsError || !insertedPrompts) {
      console.error("[audit/start] prompts insert error:", promptsError);
      throw databaseError("Impossible de créer les prompts.");
    }

    // e) INSERT competitors
    const rawCompetitors = Array.isArray(session.competitors)
      ? session.competitors
      : [];
    const parsedCompetitors = rawCompetitors.map((c) =>
      competitorItemSchema.parse(c)
    );

    if (parsedCompetitors.length > 0) {
      const { error: compError } = await supabase.from("competitors").insert(
        parsedCompetitors.map((c) => ({
          brand_id: brandId,
          name: c.name,
          domain: c.url,
          auto_detected: true,
        }))
      );

      if (compError) {
        console.error("[audit/start] competitors insert error:", compError);
        throw databaseError("Impossible de créer les concurrents.");
      }
    }

    // f) INSERT audit
    const { data: audit, error: auditError } = await supabase
      .from("audits")
      .insert({
        brand_id: brandId,
        status: "running",
        triggered_by: "manual",
      })
      .select("id")
      .single<AuditRow>();

    if (auditError || !audit) {
      console.error("[audit/start] audit insert error:", auditError);
      throw databaseError("Impossible de créer l'audit.");
    }

    const prompts = (insertedPrompts as PromptInserted[]).map((p) => ({
      id: p.id,
      text: p.text,
      category: p.category,
    }));

    return successResponse({ audit_id: audit.id, brand_id: brandId, prompts }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
