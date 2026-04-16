import { NextRequest } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  errorResponse,
  successResponse,
  notFound,
  databaseError,
} from "@/lib/utils/api-error";
import { checkRateLimit } from "@/lib/utils/rate-limit";

export const maxDuration = 8;

// ---------------------------------------------------------------------------
// Schéma Zod
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  session_token: z.string().uuid("session_token doit être un UUID valide"),
});

const idSchema = z.string().uuid("L'identifiant de l'audit doit être un UUID valide");

// ---------------------------------------------------------------------------
// Types locaux
// ---------------------------------------------------------------------------

interface AuditRow {
  id: string;
  brand_id: string;
}

interface BrandRow {
  name: string;
}

interface PromptRow {
  id: string;
  text: string;
  category: string | null;
}

interface CompetitorRow {
  name: string;
}

interface NewAuditRow {
  id: string;
}

// ---------------------------------------------------------------------------
// POST /api/audit/[id]/rerun
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await checkRateLimit(req, "audit:rerun", 3, 3600);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { id: rawId } = await params;
    const auditId = idSchema.parse(rawId);

    const body: unknown = await req.json().catch(() => null);
    if (body === null) {
      return errorResponse("Corps de la requête manquant", "VALIDATION_ERROR", 400);
    }
    bodySchema.parse(body);

    const supabase = getSupabaseAdmin();

    // a) Vérifier que l'audit existe
    const { data: audit, error: auditError } = await supabase
      .from("audits")
      .select("id, brand_id")
      .eq("id", auditId)
      .single<AuditRow>();

    if (auditError || !audit) {
      return notFound("Audit introuvable.");
    }

    // b) Récupérer le nom de la marque
    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .select("name")
      .eq("id", audit.brand_id)
      .single<BrandRow>();

    if (brandError || !brand) {
      throw databaseError("Impossible de récupérer la marque.");
    }

    // c) Récupérer les prompts actifs liés au brand_id
    const { data: prompts, error: promptsError } = await supabase
      .from("prompts")
      .select("id, text, category")
      .eq("brand_id", audit.brand_id)
      .eq("is_active", true);

    if (promptsError) {
      return databaseError("Impossible de récupérer les prompts.");
    }

    const promptRows = (prompts ?? []) as PromptRow[];

    // d) Récupérer les concurrents liés au brand_id
    const { data: competitors, error: competitorsError } = await supabase
      .from("competitors")
      .select("name")
      .eq("brand_id", audit.brand_id);

    if (competitorsError) {
      throw databaseError("Impossible de récupérer les concurrents.");
    }

    const competitorRows = (competitors ?? []) as CompetitorRow[];

    // e) INSERT nouvel audit
    const { data: newAudit, error: newAuditError } = await supabase
      .from("audits")
      .insert({
        brand_id: audit.brand_id,
        status: "running",
        triggered_by: "manual",
      })
      .select("id")
      .single<NewAuditRow>();

    if (newAuditError || !newAudit) {
      console.error("[audit/rerun] audit insert error:", newAuditError);
      return databaseError("Impossible de créer le nouvel audit.");
    }

    return successResponse(
      {
        audit_id: newAudit.id,
        brand_name: brand.name,
        prompts: promptRows.map((p) => p.text),
        competitors: competitorRows.map((c) => c.name),
      },
      201
    );
  } catch (err) {
    return errorResponse(err);
  }
}
