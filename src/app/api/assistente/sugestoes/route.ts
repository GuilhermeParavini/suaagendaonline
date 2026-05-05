import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getSugestoesCards } from '@/actions/assistente-sugestoes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FALLBACK = { cards: [], saudacao: 'Olá!' };

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(FALLBACK, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: prof, error: profErr } = await admin
      .from('profissionais')
      .select('id, tenant_id, nome, role')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profErr || !prof) {
      return NextResponse.json(FALLBACK);
    }

    const url = new URL(request.url);
    const pagina = url.searchParams.get('pagina') ?? 'dashboard';

    const resposta = await getSugestoesCards(
      prof.tenant_id as string,
      prof.id as string,
      (prof.role as string) ?? 'profissional',
      pagina,
      (prof.nome as string | null) ?? null,
    );

    return NextResponse.json(resposta);
  } catch (e) {
    console.error('[assistente/sugestoes] erro:', e);
    return NextResponse.json(FALLBACK);
  }
}
