// Le middleware importe lib/auth → lib/supabase/server → next/headers (cookies),
// qui n'est pas disponible dans le runtime Edge. On force Node.js.
export const runtime = "nodejs";

export { proxy as middleware, config } from "./proxy";
