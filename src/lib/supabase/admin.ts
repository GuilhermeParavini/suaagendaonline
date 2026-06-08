import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Admin client com service role key — bypassa RLS.
// Uso: Server Components / Server Actions / Route Handlers / middleware (proxy).
// Nunca importar de Client Components.
// Fica isolado neste modulo (sem `next/headers`) para poder ser usado tambem no
// proxy/middleware, que roda no runtime Edge onde `next/headers` nao existe.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
