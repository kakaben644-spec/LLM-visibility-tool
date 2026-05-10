import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { errorResponse, successResponse } from "@/lib/utils/api-error";

const bodySchema = z.object({
  session_token: z.string().uuid("session_token doit être un UUID valide"),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return errorResponse("Non authentifié", "UNAUTHORIZED", 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Corps JSON invalide", "VALIDATION_ERROR", 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0].message, "VALIDATION_ERROR", 400);
  }

  const { session_token } = parsed.data;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc("migrate_session", {
    p_session_token: session_token,
    p_user_id: userId,
  });

  if (error) {
    console.error("[migrate-session] Supabase RPC error:", error.message);
    return successResponse({ ok: false, error: error.message });
  }

  return successResponse({ ok: true });
}
