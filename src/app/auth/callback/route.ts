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
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const typeParam = url.searchParams.get('type') as EmailOtpType | null;
  const nextParam = url.searchParams.get('next') ?? '/';
  const errorParam = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  const allParams = Object.fromEntries(url.searchParams.entries());
  console.log('[auth/callback] entrada', {
    url: url.toString(),
    code: code ? `${code.slice(0, 8)}...` : null,
    tokenHash: tokenHash ? `${tokenHash.slice(0, 8)}...` : null,
    type: typeParam,
    next: nextParam,
    error: errorParam,
    errorDescription,
    todosParams: Object.keys(allParams),
  });

  const nextSafe = nextParam.startsWith('/') ? nextParam : '/';
  // Recovery sempre cai em /redefinir-senha, ignorando next se necessario.
  const isRecovery =
    typeParam === 'recovery' || nextSafe.startsWith('/redefinir-senha');
  const next = isRecovery ? '/redefinir-senha' : nextSafe;

  if (errorParam) {
    console.error('[auth/callback] erro Supabase no redirect', {
      errorParam,
      errorDescription,
    });
    const target = new URL('/login', url.origin);
    target.searchParams.set('error', errorDescription ?? errorParam);
    return NextResponse.redirect(target);
  }

  const supabase = await createClient();

  if (tokenHash && typeParam && OTP_TYPES.includes(typeParam)) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: typeParam,
    });
    console.log('[auth/callback] verifyOtp resultado', {
      ok: !error,
      userId: data?.user?.id ?? null,
      error: error?.message ?? null,
    });
    if (error) {
      const target = new URL('/login', url.origin);
      target.searchParams.set('error', error.message);
      return NextResponse.redirect(target);
    }
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    console.log('[auth/callback] exchangeCodeForSession resultado', {
      ok: !error,
      userId: data?.user?.id ?? null,
      error: error?.message ?? null,
    });
    if (error) {
      const target = new URL('/login', url.origin);
      target.searchParams.set('error', error.message);
      return NextResponse.redirect(target);
    }
  } else {
    // Nao chegou code nem token_hash: provavelmente o token veio no hash da URL
    // (#access_token=...). O servidor nao recebe o hash, mas o cliente JS na
    // proxima pagina detecta. Para recovery, deixar /redefinir-senha tratar.
    console.warn('[auth/callback] sem code/tokenHash', {
      typeParam,
      nextParam,
    });
  }

  console.log('[auth/callback] redirecionando', { next });
  return NextResponse.redirect(new URL(next, url.origin));
}
