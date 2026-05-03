import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const nextParam = url.searchParams.get('next') ?? '/';
  const next = nextParam.startsWith('/') ? nextParam : '/';

  const errorParam = url.searchParams.get('error');
  if (errorParam) {
    const description = url.searchParams.get('error_description');
    const target = new URL('/login', url.origin);
    target.searchParams.set('error', description ?? errorParam);
    return NextResponse.redirect(target);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const target = new URL('/login', url.origin);
      target.searchParams.set('error', error.message);
      return NextResponse.redirect(target);
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
