import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { seedFeriadosNacionais } from '@/actions/feriados';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();

  if (!userResp.user) {
    return NextResponse.json(
      { sucesso: false, error: 'Nao autenticado' },
      { status: 401 },
    );
  }

  try {
    const r2026 = await seedFeriadosNacionais(2026);
    const r2027 = await seedFeriadosNacionais(2027);

    return NextResponse.json({
      sucesso: true,
      inseridos: r2026.inseridos + r2027.inseridos,
      detalhe: {
        '2026': r2026,
        '2027': r2027,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        sucesso: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
