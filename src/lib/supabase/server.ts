import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Re-export para compatibilidade: consumidores Node (server actions, route
// handlers, server components) continuam importando de '@/lib/supabase/server'.
// A implementacao vive em './admin' (sem next/headers) para ser usavel no proxy.
export { createAdminClient } from "./admin";

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
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — middleware will refresh sessions.
          }
        },
      },
    },
  );
}
