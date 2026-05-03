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
  const next = nextParam.startsWith('/') ? nextParam : '/';

  const errorParam = url.searchParams.get('error');
  if (errorParam) {
    const description = url.searchParams.get('error_description');
    const target = new URL('/login', url.origin);
    target.searchParams.set('error', description ?? errorParam);
    return NextResponse.redirect(target);
  }

  const supabase = await createClient();

  if (tokenHash && typeParam && OTP_TYPES.includes(typeParam)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: typeParam,
    });
    if (error) {
      const target = new URL('/login', url.origin);
      target.searchParams.set('error', error.message);
      return NextResponse.redirect(target);
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const target = new URL('/login', url.origin);
      target.searchParams.set('error', error.message);
      return NextResponse.redirect(target);
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
