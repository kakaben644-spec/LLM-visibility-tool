import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
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

  // Retrieve Clerk user data to upsert in our users table
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  const primaryEmail = clerkUser.emailAddresses.find(
    (e) => e.id === clerkUser.primaryEmailAddressId
  );
  const email = primaryEmail?.emailAddress ?? "";
  const fullName =
    `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || null;

  const supabase = getSupabaseAdmin();

  // Upsert user row (safety net — webhook may not have fired yet)
  const { data: dbUser, error: upsertError } = await supabase
    .from("users")
    .upsert(
      { clerk_id: userId, email, full_name: fullName },
      { onConflict: "clerk_id" }
    )
    .select("id")
    .single();

  if (upsertError || !dbUser) {
    console.error("[migrate-session] Upsert user error:", upsertError?.message);
    return errorResponse("Impossible de créer l'utilisateur", "DATABASE_ERROR", 500);
  }

  // Call migrate_session with internal UUID
  const { error } = await supabase.rpc("migrate_session", {
    p_session_token: session_token,
    p_user_id: dbUser.id,
  });

  if (error) {
    console.error("[migrate-session] Supabase RPC error:", error.message);
    return errorResponse(error.message, "DATABASE_ERROR", 500);
  }

  return successResponse({ ok: true });
}
