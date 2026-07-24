import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase avec la clé service_role — bypass la RLS, réservé aux
 * Server Actions qui doivent gérer des comptes Supabase Auth (création
 * d'employés). Ne jamais importer depuis un composant client (CLAUDE.md §9).
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
