import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { EmailOtpType, User } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const OTP_TYPES: EmailOtpType[] = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
];

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const typeParam = url.searchParams.get('type') as EmailOtpType | null;
  const nextParam = url.searchParams.get('next') ?? '/inicio';

  const nextSafe = nextParam.startsWith('/') ? nextParam : '/inicio';
  // Recovery sempre cai em /redefinir-senha, ignorando next se necessario.
  const isRecovery =
    typeParam === 'recovery' || nextSafe.startsWith('/redefinir-senha');
  const next = isRecovery ? '/redefinir-senha' : nextSafe;

  if (!tokenHash || !typeParam || !OTP_TYPES.includes(typeParam)) {
    const target = new URL('/login', url.origin);
    target.searchParams.set('error', 'Link inválido ou expirado.');
    return NextResponse.redirect(target);
  }

  // ============================================================
  // PADRAO CORRETO Supabase SSR para Route Handlers (Next.js 16) — mesmo do
  // auth/callback: os cookies da sessao DEVEM ser escritos no objeto `response`
  // que sera retornado. Setar via cookies() do next/headers e retornar um
  // NextResponse.redirect() novo PERDE os cookies — a sessao nao chegaria nas
  // server actions. Aqui: ler de request.cookies, escrever em response.cookies.
  // A Location do redirect e ajustada no fim, sem recriar o response (o que
  // descartaria os cookies recem-setados).
  // ============================================================
  const response = NextResponse.redirect(new URL(next, url.origin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: typeParam,
  });
  if (error) {
    const target = new URL('/login', url.origin);
    target.searchParams.set('error', error.message);
    return NextResponse.redirect(target);
  }

  const user: User | null = data.user;

  // Decidir o destino final:
  // - recovery sempre vai para /redefinir-senha (ja refletido em `next`)
  // - usuario SEM perfil profissional -> /onboarding (signup recem-confirmado)
  // - usuario COM perfil -> next (/inicio por padrao)
  // A checagem de perfil usa o admin client (service role), independente de RLS.
  // Fail-closed: se a query falhar, mandar para /onboarding.
  let destino = next;
  if (!isRecovery && user) {
    const admin = createAdminClient();
    const { data: prof, error: profError } = await admin
      .from('profissionais')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profError) {
      console.error(
        'Erro ao verificar perfil profissional:',
        profError.message,
      );
    }
    destino = profError || !prof ? '/onboarding' : next;
  }

  // Atualizar a Location no MESMO response (que ja carrega os cookies da sessao).
  response.headers.set('Location', new URL(destino, url.origin).toString());
  return response;
}
