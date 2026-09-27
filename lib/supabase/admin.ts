import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase avec la clé service_role — bypass la RLS, réservé aux
 * Server Actions qui doivent gérer des comptes Supabase Auth (création
 * d'employés). Ne jamais importer depuis un composant client (CLAUDE.md §9).
 */
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey && process.env.NODE_ENV !== "test") {
    console.warn(
      "[createAdminClient] SUPABASE_SERVICE_ROLE_KEY absent dans l'environnement, utilisation de la clé anon par défaut."
    );
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
