import { auth } from "@clerk/nextjs/server";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { errorResponse, successResponse } from "@/lib/utils/api-error";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditRow {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  created_at: string;
  brand_id: string;
  brand_name: string;
  total_score: number | null;
  mention_rate: number | null;
}

// ---------------------------------------------------------------------------
// GET /api/history
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return errorResponse("Non authentifié", "UNAUTHORIZED", 401);

    const supabase = getSupabaseAdmin();

    // 1. Resolve Clerk ID → internal user
    const { data: userRow, error: userErr } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", userId)
      .single();

    if (userErr) return errorResponse(userErr.message, "DATABASE_ERROR", 500);
    if (!userRow) return errorResponse("Utilisateur introuvable", "NOT_FOUND", 404);

    // 2. Get all brands for this user
    const { data: brands, error: brandsErr } = await supabase
      .from("brands")
      .select("id, name")
      .eq("user_id", userRow.id);

    if (brandsErr) return errorResponse(brandsErr.message, "DATABASE_ERROR", 500);
    if (!brands || brands.length === 0) return successResponse({ audits: [] });

    const brandIds = brands.map((b) => b.id as string);
    const brandNameMap = new Map(
      brands.map((b) => [b.id as string, b.name as string])
    );

    // 3. Get all audits for those brands, newest first
    const { data: auditRows, error: auditsErr } = await supabase
      .from("audits")
      .select("id, status, created_at, brand_id")
      .in("brand_id", brandIds)
      .order("created_at", { ascending: false });

    if (auditsErr) return errorResponse(auditsErr.message, "DATABASE_ERROR", 500);
    if (!auditRows || auditRows.length === 0) return successResponse({ audits: [] });

    const auditIds = auditRows.map((a) => a.id as string);

    // 4. Compute brand mention_rate from mention_results (entity_type = 'brand')
    const { data: mentionRows, error: mentionsErr } = await supabase
      .from("mention_results")
      .select("audit_id, is_mentioned")
      .in("audit_id", auditIds)
      .eq("entity_type", "brand");

    if (mentionsErr) return errorResponse(mentionsErr.message, "DATABASE_ERROR", 500);

    const mentionMap = new Map<string, { total: number; mentioned: number }>();
    for (const m of mentionRows ?? []) {
      const key = m.audit_id as string;
      const existing = mentionMap.get(key) ?? { total: 0, mentioned: 0 };
      existing.total++;
      if (m.is_mentioned) existing.mentioned++;
      mentionMap.set(key, existing);
    }

    // 5. Build result
    const audits: AuditRow[] = auditRows.map((a) => {
      const stats = mentionMap.get(a.id as string);
      const mention_rate =
        stats && stats.total > 0 ? stats.mentioned / stats.total : null;
      return {
        id: a.id as string,
        status: a.status as AuditRow["status"],
        created_at: a.created_at as string,
        brand_id: a.brand_id as string,
        brand_name: brandNameMap.get(a.brand_id as string) ?? "",
        total_score: mention_rate !== null ? Math.round(mention_rate * 100) : null,
        mention_rate,
      };
    });

    return successResponse({ audits });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Erreur interne",
      "INTERNAL_ERROR",
      500
    );
  }
}
