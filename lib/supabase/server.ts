import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client Supabase pour Server Components / Server Actions. `setAll` peut
 * échouer silencieusement quand appelé depuis un Server Component pur (lecture
 * seule) — c'est attendu, le rafraîchissement de session est géré par proxy.ts.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Component en lecture seule : sans effet, attendu.
          }
        },
      },
    }
  );
}
