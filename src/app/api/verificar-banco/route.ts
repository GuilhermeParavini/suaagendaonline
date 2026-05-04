import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ResultadoColuna = {
  ok: boolean;
  detalhes?: unknown;
  erro?: string;
};

async function checarColuna(
  admin: ReturnType<typeof createAdminClient>,
  tabela: string,
  coluna: string,
): Promise<ResultadoColuna> {
  // PostgREST retorna 42703 se a coluna nao existe.
  const { error } = await admin
    .from(tabela)
    .select(coluna, { count: 'exact', head: true })
    .limit(1);
  if (error) {
    return { ok: false, erro: `${error.code ?? ''} ${error.message}`.trim() };
  }
  return { ok: true };
}

async function listarColunasTabela(
  admin: ReturnType<typeof createAdminClient>,
  tabela: string,
  colunasEsperadas: string[],
): Promise<{
  existe: boolean;
  colunas: Record<string, ResultadoColuna>;
  amostra?: unknown;
}> {
  const colunas: Record<string, ResultadoColuna> = {};
  let existe = true;
  let amostra: unknown = null;

  // Primeiro: testa se a tabela existe puxando uma linha qualquer
  const { data, error } = await admin
    .from(tabela)
    .select('*')
    .limit(1);
  if (error) {
    existe = false;
    return {
      existe: false,
      colunas: { _erro: { ok: false, erro: `${error.code ?? ''} ${error.message}` } },
    };
  }
  if (data && data.length > 0) {
    amostra = data[0];
  }

  for (const c of colunasEsperadas) {
    colunas[c] = await checarColuna(admin, tabela, c);
  }
  return { existe, colunas, amostra };
}

export async function GET() {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) {
    return NextResponse.json(
      { ok: false, erro: 'Faca login no app antes de chamar este endpoint.' },
      { status: 401 },
    );
  }

  const admin = createAdminClient();

  const avaliacoes = await listarColunasTabela(admin, 'avaliacoes', [
    'id',
    'tenant_id',
    'agendamento_id',
    'paciente_id',
    'profissional_id',
    'nota',
    'gostou',
    'melhorar',
    'recomendaria',
    'created_at',
  ]);

  const profissionaisColunas = await listarColunasTabela(admin, 'profissionais', [
    'enviar_avaliacao',
    'enviar_followup',
    'followup_mensagem',
    // o prompt mencionou 'mensagem_followup' tambem; verificamos os dois
    'mensagem_followup',
    'mostrar_acompanhamento',
    'logo_url',
    'assinatura_tipo',
    'assinatura_fonte',
    'assinatura_url',
  ]);

  const bloqueios = await listarColunasTabela(admin, 'bloqueios', [
    'id',
    'tenant_id',
    'profissional_id',
    'data_inicio',
    'data_fim',
    'motivo',
    'tipo',
    'created_at',
  ]);

  const feriados = await listarColunasTabela(admin, 'feriados', [
    'id',
    'tenant_id',
    'data',
    'nome',
    'tipo',
    'recorrente',
    'created_at',
  ]);

  let buckets: unknown = null;
  let bucketsErro: string | null = null;
  try {
    const r = await admin.storage.listBuckets();
    if (r.error) {
      bucketsErro = r.error.message;
    } else {
      buckets = (r.data ?? []).map((b) => ({
        id: b.id,
        name: b.name,
        public: b.public,
        created_at: b.created_at,
      }));
    }
  } catch (e) {
    bucketsErro = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    avaliacoes,
    profissionais: profissionaisColunas,
    bloqueios,
    feriados,
    storage: { buckets, erro: bucketsErro },
  });
}
