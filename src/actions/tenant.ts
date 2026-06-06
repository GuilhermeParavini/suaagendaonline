'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function hasProfessionalProfile(userId: string): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { data, error } = await supabase
      .from('profissionais')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      // Fail-closed: qualquer falha na query conta como "sem perfil".
      console.error(
        '[hasProfessionalProfile] erro ao verificar perfil profissional:',
        error.message,
      );
      return false;
    }

    return !!data;
  } catch (err) {
    console.error(
      '[hasProfessionalProfile] excecao ao verificar perfil profissional:',
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}
