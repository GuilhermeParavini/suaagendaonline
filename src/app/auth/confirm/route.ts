import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const OTP_TYPES: EmailOtpType[] = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const typeParam = url.searchParams.get('type') as EmailOtpType | null;
  const nextParam = url.searchParams.get('next') ?? '/';
  const next = nextParam.startsWith('/') ? nextParam : '/';

  if (!tokenHash || !typeParam || !OTP_TYPES.includes(typeParam)) {
    const target = new URL('/login', url.origin);
    target.searchParams.set('error', 'Link inválido ou expirado.');
    return NextResponse.redirect(target);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: typeParam,
  });
  if (error) {
    const target = new URL('/login', url.origin);
    target.searchParams.set('error', error.message);
    return NextResponse.redirect(target);
  }

  // Para 'recovery', sempre redirecionar para /redefinir-senha (independente do next).
  const destino = typeParam === 'recovery' ? '/redefinir-senha' : next;
  return NextResponse.redirect(new URL(destino, url.origin));
}
