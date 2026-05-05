import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type CorpoFeedback = {
  historico_id?: unknown;
  avaliacao?: unknown;
  tags?: unknown;
  comentario?: unknown;
  pagina_origem?: unknown;
};

const AVALIACOES_VALIDAS = new Set(['positivo', 'negativo']);

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    let body: CorpoFeedback = {};
    try {
      body = (await request.json()) as CorpoFeedback;
    } catch {
      body = {};
    }

    const historicoId =
      typeof body.historico_id === 'string' && body.historico_id
        ? body.historico_id
        : null;
    const avaliacaoRaw =
      typeof body.avaliacao === 'string' ? body.avaliacao : '';
    if (!AVALIACOES_VALIDAS.has(avaliacaoRaw)) {
      return NextResponse.json({ ok: false });
    }
    const tags =
      Array.isArray(body.tags)
        ? (body.tags as unknown[])
            .map((t) => String(t).trim())
            .filter((t) => t.length > 0)
        : [];
    const comentario =
      typeof body.comentario === 'string' && body.comentario.trim()
        ? body.comentario.trim().slice(0, 1000)
        : null;
    const paginaOrigem =
      typeof body.pagina_origem === 'string'
        ? body.pagina_origem
        : null;

    const admin = createAdminClient();

    const { data: prof, error: profErr } = await admin
      .from('profissionais')
      .select('id, tenant_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profErr || !prof) {
      return NextResponse.json({ ok: false });
    }
    const tenantId = prof.tenant_id as string;
    const profissionalId = prof.id as string;

    let perguntaOriginal: string | null = null;
    let respostaIa: string | null = null;
    let intencao: string | null = null;
    let funcoes: unknown = null;
    let foiCardInicial = false;
    let foiFollowUp = false;

    if (historicoId) {
      const { data: hist } = await admin
        .from('historico_assistente')
        .select(
          'pergunta, resposta, intencao_detectada, funcoes_chamadas, origem',
        )
        .eq('id', historicoId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (hist) {
        perguntaOriginal = (hist.pergunta as string | null) ?? null;
        respostaIa = (hist.resposta as string | null) ?? null;
        intencao = (hist.intencao_detectada as string | null) ?? null;
        funcoes = hist.funcoes_chamadas ?? null;
        const origem = (hist.origem as string | null) ?? null;
        foiCardInicial = origem === 'card_inicial';
        foiFollowUp = origem === 'card_follow_up';
      }
    }

    const { error: insErr } = await admin.from('feedback_assistente').insert({
      tenant_id: tenantId,
      tipo: 'profissional',
      profissional_id: profissionalId,
      historico_assistente_id: historicoId,
      avaliacao: avaliacaoRaw,
      tags,
      comentario,
      pergunta_original: perguntaOriginal,
      resposta_ia: respostaIa,
      intencao_detectada: intencao,
      funcoes_chamadas: funcoes,
      foi_card_inicial: foiCardInicial,
      foi_follow_up: foiFollowUp,
      pagina_origem: paginaOrigem,
    });
    if (insErr) {
      console.error('[assistente/feedback] erro:', insErr.message);
      return NextResponse.json({ ok: false });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[assistente/feedback] erro:', e);
    return NextResponse.json({ ok: false });
  }
}
