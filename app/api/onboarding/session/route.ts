import { NextRequest } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  errorResponse,
  successResponse,
  notFound,
  databaseError,
} from "@/lib/utils/api-error";

// Route Handlers dans Next.js 16 peuvent durer jusqu'à 8s sur Vercel Free
export const maxDuration = 8;

// ---------------------------------------------------------------------------
// Types locaux (alignés sur le schéma DB 001_init.sql)
// ---------------------------------------------------------------------------

interface OnboardingSessionRow {
  id: string;
  session_token: string;
  user_id: string | null;
  current_step: number;
  brand_name: string | null;
  brand_url: string | null;
  brand_country: string;
  account_type: string;
  scraped_content: string | null;
  generated_prompts: unknown[];
  selected_prompts: unknown[];
  competitors: unknown[];
  completed: boolean;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Schémas Zod de validation
// ---------------------------------------------------------------------------

const postBodySchema = z.object({
  brand_name: z.string().min(1).max(255).optional(),
  brand_url: z.string().max(2048).optional(),
  brand_country: z.string().max(100).optional(),
  account_type: z.enum(["brand", "agency"]).optional(),
});

const patchBodySchema = z.object({
  session_token: z.string().uuid("session_token doit être un UUID valide"),
  current_step: z.number().int().min(1).max(4).optional(),
  brand_name: z.string().min(1).max(255).optional(),
  brand_url: z.string().max(2048).optional(),
  brand_country: z.string().max(100).optional(),
  account_type: z.enum(["brand", "agency"]).optional(),
  scraped_content: z.string().optional(),
  generated_prompts: z.array(z.unknown()).optional(),
  selected_prompts: z.array(z.unknown()).optional(),
  competitors: z.array(z.unknown()).optional(),
});

const getQuerySchema = z.object({
  token: z.string().uuid("Le paramètre token doit être un UUID valide"),
});

// ---------------------------------------------------------------------------
// POST /api/onboarding/session
// Crée une nouvelle session anonyme et retourne { session_token, id }
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => ({}));
    const input = postBodySchema.parse(body);

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("onboarding_sessions")
      .insert({
        brand_name: input.brand_name ?? null,
        brand_url: input.brand_url ?? null,
        brand_country: input.brand_country ?? "France",
        account_type: input.account_type ?? "brand",
      })
      .select("id, session_token")
      .single<Pick<OnboardingSessionRow, "id" | "session_token">>();

    if (error || !data) {
      console.error("[POST /onboarding/session] Supabase error:", error);
      throw databaseError(
        "Impossible de créer la session. Réessaie dans quelques instants."
      );
    }

    return successResponse(
      { session_token: data.session_token, id: data.id },
      201
    );
  } catch (err) {
    return errorResponse(err);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/onboarding/session
// Met à jour une étape de l'onboarding pour une session existante
// Body: { session_token, current_step?, ...champs de l'étape }
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);

    if (body === null) {
      return errorResponse(new Error("Corps de la requête invalide ou vide"));
    }

    const input = patchBodySchema.parse(body);

    // Séparer session_token des champs à mettre à jour
    const { session_token, ...updateFields } = input;

    // Construire l'objet de mise à jour en excluant les champs undefined
    const updatePayload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updateFields)) {
      if (value !== undefined) {
        updatePayload[key] = value;
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return errorResponse(
        new Error("Aucun champ à mettre à jour fourni dans le body")
      );
    }

    const supabase = getSupabaseAdmin();

    const { error, count } = await supabase
      .from("onboarding_sessions")
      .update(updatePayload)
      .eq("session_token", session_token)
      .eq("completed", false); // Ne pas modifier une session déjà terminée

    if (error) {
      console.error("[PATCH /onboarding/session] Supabase error:", error);
      throw databaseError("Impossible de mettre à jour la session.");
    }

    if (count === 0) {
      // Aucune ligne affectée = session not found ou already completed
      throw notFound(
        "Session introuvable, expirée ou déjà terminée. Crée une nouvelle session."
      );
    }

    return successResponse({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/onboarding/session?token=<uuid>
// Récupère une session existante et non expirée
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = getQuerySchema.parse({ token: searchParams.get("token") });

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("onboarding_sessions")
      .select("*")
      .eq("session_token", query.token)
      .gt("expires_at", new Date().toISOString()) // session non expirée
      .single<OnboardingSessionRow>();

    if (error || !data) {
      // Supabase renvoie une erreur PGRST116 quand aucune ligne n'est trouvée
      throw notFound(
        "Session introuvable ou expirée. Merci de recommencer l'onboarding."
      );
    }

    return successResponse(data);
  } catch (err) {
    return errorResponse(err);
  }
}
