// app/api/recommendations/[id]/route.ts
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { errorResponse, successResponse, notFound } from "@/lib/utils/api-error";

const patchBodySchema = z.object({
  is_done: z.boolean(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return errorResponse("Non authentifié", "UNAUTHORIZED", 401);

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return errorResponse("id invalide", "VALIDATION_ERROR", 400);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Corps JSON invalide", "VALIDATION_ERROR", 400);
  }

  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0].message, "VALIDATION_ERROR", 400);
  }

  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from("recommendations")
    .update({ is_done: parsed.data.is_done }, { count: "exact" })
    .eq("id", id);

  if (error) return errorResponse(error.message, "DATABASE_ERROR", 500);
  if (count === 0) return notFound("Recommandation introuvable");

  return successResponse({ id, is_done: parsed.data.is_done });
}
