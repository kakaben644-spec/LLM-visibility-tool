import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Client Supabase SERVICE ROLE (usage serveur uniquement — bypass RLS)
// Ne jamais exposer côté client : SUPABASE_SERVICE_ROLE_KEY n'est pas NEXT_PUBLIC_
// ---------------------------------------------------------------------------

function createServiceRoleClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "[Supabase] NEXT_PUBLIC_SUPABASE_URL est manquant. Vérifie ton .env.local"
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "[Supabase] SUPABASE_SERVICE_ROLE_KEY est manquant. " +
        "N'utilise PAS la clé anon ici — le client service role bypass RLS."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      // Désactiver l'auto-refresh et la persistance côté serveur
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Singleton paresseux : instancié au premier appel, pas au chargement du module.
// Cela évite les erreurs au build-time quand les env vars ne sont pas encore chargées.
let _adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!_adminClient) {
    _adminClient = createServiceRoleClient();
  }
  return _adminClient;
}
