import { NextResponse } from 'next/server';
import { seedDatabase } from '@/actions/seed';

export const dynamic = 'force-dynamic';

const SEED_SECRET = 'seed2026';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && secret !== SEED_SECRET) {
    return NextResponse.json(
      { ok: false, error: 'Forbidden' },
      { status: 403 },
    );
  }

  const result = await seedDatabase();

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  return GET(request);
}
