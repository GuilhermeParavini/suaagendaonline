import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getSugestoesCards } from '@/actions/assistente-sugestoes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FALLBACK = { cards: [], saudacao: 'Olá!', log_id: null };

const TZ = 'America/Sao_Paulo';

function partesSP(d: Date): { hour: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: '2-digit',
    weekday: 'short',
    hour12: false,
  });
  const obj: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) obj[p.type] = p.value;
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const hourRaw = obj.hour === '24' ? 0 : Number(obj.hour);
  return {
    hour: Number.isFinite(hourRaw) ? hourRaw : 0,
    weekday: weekdayMap[obj.weekday] ?? 0,
  };
}

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
    const pacienteId = url.searchParams.get('paciente_id');

    const resposta = await getSugestoesCards(
      prof.tenant_id as string,
      prof.id as string,
      (prof.role as string) ?? 'profissional',
      pagina,
      (prof.nome as string | null) ?? null,
      { pagina, pacienteId },
    );

    // Log de exibicao (best-effort, nao bloqueia)
    let logId: string | null = null;
    try {
      const partes = partesSP(new Date());
      const { data: logRow } = await admin
        .from('sugestoes_cards_log')
        .insert({
          tenant_id: prof.tenant_id as string,
          profissional_id: prof.id as string,
          cards_exibidos: resposta.cards.map((c) => ({
            id: c.id,
            titulo: c.titulo,
            prioridade: c.prioridade,
          })),
          card_clicado: null,
          hora: partes.hour,
          dia_semana: partes.weekday,
          pagina_origem: pagina,
        })
        .select('id')
        .single();
      logId = (logRow?.id as string | null) ?? null;
    } catch (e) {
      console.error('[assistente/sugestoes] erro ao gravar log:', e);
    }

    return NextResponse.json({ ...resposta, log_id: logId });
  } catch (e) {
    console.error('[assistente/sugestoes] erro:', e);
    return NextResponse.json(FALLBACK);
  }
}

export async function POST(request: Request) {
  // Endpoint para registrar clique em card
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: prof } = await admin
      .from('profissionais')
      .select('tenant_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!prof) return NextResponse.json({ ok: false }, { status: 403 });

    const body = (await request.json().catch(() => ({}))) as {
      log_id?: unknown;
      card_id?: unknown;
    };
    const logId = typeof body.log_id === 'string' ? body.log_id : null;
    const cardId = typeof body.card_id === 'string' ? body.card_id : null;
    if (!logId || !cardId) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    await admin
      .from('sugestoes_cards_log')
      .update({ card_clicado: cardId })
      .eq('id', logId)
      .eq('tenant_id', prof.tenant_id as string);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[assistente/sugestoes] erro click:', e);
    return NextResponse.json({ ok: false });
  }
}
