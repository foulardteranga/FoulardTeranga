import { createBrowserClient } from "@supabase/ssr";

/** Client Supabase pour Client Components — session lue depuis les cookies du navigateur. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
