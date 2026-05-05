'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import {
  exigirAdmin,
  obterContextoAutenticado,
} from '@/lib/auth-context';

export type TipoCobrancaComissao = 'percentual' | 'fixo' | 'misto';
export type IncideSobreComissao = 'tudo' | 'atendimentos';
export type StatusComissaoMensal = 'aberto' | 'pago' | 'cancelado';

export type ComissaoProfissional = {
  id: string;
  tenant_id: string;
  profissional_id: string;
  tipo_cobranca: TipoCobrancaComissao;
  percentual: number;
  valor_fixo_mensal: number;
  incide_sobre: IncideSobreComissao;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type ComissaoMensal = {
  id: string;
  tenant_id: string;
  profissional_id: string;
  mes_ano: string; // 'YYYY-MM'
  faturamento_bruto: number;
  total_atendimentos: number;
  detalhamento_pagamentos: Record<string, number> | null;
  total_despesas: number;
  detalhamento_despesas: Record<string, number> | null;
  percentual_aplicado: number;
  valor_comissao_percentual: number;
  valor_fixo_mensal: number;
  total_comissao: number;
  valor_liquido: number;
  lucro_real: number;
  status: StatusComissaoMensal;
  data_pagamento: string | null;
  forma_pagamento: string | null;
  observacoes: string | null;
  profissional?: { id: string; nome: string; especialidade: string | null };
  created_at: string;
  updated_at: string;
};

export type ResumoComissao = {
  aplicavel: boolean;
  percentual: number;
  valorComissao: number;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const FORMAS_PAGAMENTO_VALIDAS = [
  'dinheiro',
  'pix',
  'cartao_credito',
  'cartao_debito',
  'convenio',
  'transferencia',
  'outro',
];

function mapComissaoProfissional(row: Record<string, unknown>): ComissaoProfissional {
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    profissional_id: row.profissional_id as string,
    tipo_cobranca:
      (row.tipo_cobranca as TipoCobrancaComissao | null) ?? 'percentual',
    percentual: Number(row.percentual) || 0,
    valor_fixo_mensal: Number(row.valor_fixo_mensal) || 0,
    incide_sobre:
      (row.incide_sobre as IncideSobreComissao | null) ?? 'tudo',
    ativo: row.ativo === false ? false : true,
    observacoes: (row.observacoes as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapComissaoMensal(row: Record<string, unknown>): ComissaoMensal {
  const profRaw = row.profissionais as
    | { id: string; nome: string; especialidade: string | null }
    | { id: string; nome: string; especialidade: string | null }[]
    | null
    | undefined;
  const profPick = Array.isArray(profRaw) ? profRaw[0] : profRaw;
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    profissional_id: row.profissional_id as string,
    mes_ano: row.mes_ano as string,
    faturamento_bruto: Number(row.faturamento_bruto) || 0,
    total_atendimentos: Number(row.total_atendimentos) || 0,
    detalhamento_pagamentos:
      (row.detalhamento_pagamentos as Record<string, number> | null) ?? null,
    total_despesas: Number(row.total_despesas) || 0,
    detalhamento_despesas:
      (row.detalhamento_despesas as Record<string, number> | null) ?? null,
    percentual_aplicado: Number(row.percentual_aplicado) || 0,
    valor_comissao_percentual: Number(row.valor_comissao_percentual) || 0,
    valor_fixo_mensal: Number(row.valor_fixo_mensal) || 0,
    total_comissao: Number(row.total_comissao) || 0,
    valor_liquido: Number(row.valor_liquido) || 0,
    lucro_real: Number(row.lucro_real) || 0,
    status: (row.status as StatusComissaoMensal | null) ?? 'aberto',
    data_pagamento: (row.data_pagamento as string | null) ?? null,
    forma_pagamento: (row.forma_pagamento as string | null) ?? null,
    observacoes: (row.observacoes as string | null) ?? null,
    profissional: profPick
      ? {
          id: profPick.id as string,
          nome: profPick.nome as string,
          especialidade:
            (profPick.especialidade as string | null) ?? null,
        }
      : undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// ============================================================
// a) getComissaoProfissional
// ============================================================
export async function getComissaoProfissional(
  profissionalId: string,
): Promise<Result<ComissaoProfissional | null>> {
  if (!profissionalId) {
    return { ok: false, error: 'Profissional invalido.' };
  }
  const ctx = await obterContextoAutenticado();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();

  // Profissional comum so pode ver a propria; admin pode ver qualquer do tenant.
  if (ctx.role !== 'admin' && profissionalId !== ctx.profissionalId) {
    return { ok: false, error: 'Sem permissao.' };
  }

  const { data, error } = await admin
    .from('comissoes_profissional')
    .select(
      'id, tenant_id, profissional_id, tipo_cobranca, percentual, valor_fixo_mensal, incide_sobre, ativo, observacoes, created_at, updated_at',
    )
    .eq('profissional_id', profissionalId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  return { ok: true, data: data ? mapComissaoProfissional(data) : null };
}

// ============================================================
// b) salvarComissao (UPSERT)
// ============================================================
export type SalvarComissaoInput = {
  profissionalId: string;
  tipoCobranca: TipoCobrancaComissao;
  percentual: number;
  valorFixoMensal: number;
  incideSobre: IncideSobreComissao;
  ativo?: boolean;
  observacoes?: string;
};

export async function salvarComissao(
  input: SalvarComissaoInput,
): Promise<Result<ComissaoProfissional>> {
  const ctx = await exigirAdmin();
  if (!ctx.ok) return ctx;

  if (!input.profissionalId) {
    return { ok: false, error: 'Profissional invalido.' };
  }
  if (!['percentual', 'fixo', 'misto'].includes(input.tipoCobranca)) {
    return { ok: false, error: 'Tipo de cobranca invalido.' };
  }
  if (!['tudo', 'atendimentos'].includes(input.incideSobre)) {
    return { ok: false, error: 'Incide sobre invalido.' };
  }
  const percentual = Number(input.percentual);
  if (!Number.isFinite(percentual) || percentual < 0 || percentual > 100) {
    return { ok: false, error: 'Percentual deve estar entre 0 e 100.' };
  }
  const valorFixo = Number(input.valorFixoMensal);
  if (!Number.isFinite(valorFixo) || valorFixo < 0) {
    return { ok: false, error: 'Valor fixo invalido.' };
  }

  const admin = createAdminClient();

  // Verifica que o profissional pertence ao tenant
  const { data: prof, error: profErr } = await admin
    .from('profissionais')
    .select('id, tenant_id')
    .eq('id', input.profissionalId)
    .maybeSingle();
  if (profErr) return { ok: false, error: profErr.message };
  if (!prof || prof.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Profissional nao encontrado neste tenant.' };
  }

  const payload = {
    tenant_id: ctx.tenantId,
    profissional_id: input.profissionalId,
    tipo_cobranca: input.tipoCobranca,
    percentual,
    valor_fixo_mensal: valorFixo,
    incide_sobre: input.incideSobre,
    ativo: input.ativo === false ? false : true,
    observacoes: input.observacoes?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from('comissoes_profissional')
    .upsert(payload, { onConflict: 'profissional_id' })
    .select(
      'id, tenant_id, profissional_id, tipo_cobranca, percentual, valor_fixo_mensal, incide_sobre, ativo, observacoes, created_at, updated_at',
    )
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Falha ao salvar comissao.' };
  }

  revalidatePath('/financeiro');
  return { ok: true, data: mapComissaoProfissional(data) };
}

// ============================================================
// c) getComissoesTenant
// ============================================================
export type ComissaoProfissionalComNome = ComissaoProfissional & {
  profissional: { id: string; nome: string; especialidade: string | null };
};

export async function getComissoesTenant(): Promise<
  Result<ComissaoProfissionalComNome[]>
> {
  const ctx = await exigirAdmin();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('comissoes_profissional')
    .select(
      'id, tenant_id, profissional_id, tipo_cobranca, percentual, valor_fixo_mensal, incide_sobre, ativo, observacoes, created_at, updated_at, profissionais!inner(id, nome, especialidade)',
    )
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: true });
  if (error) return { ok: false, error: error.message };

  const lista: ComissaoProfissionalComNome[] = (data ?? []).map((row) => {
    const base = mapComissaoProfissional(row);
    const profRaw = (row as Record<string, unknown>).profissionais as
      | { id: string; nome: string; especialidade: string | null }
      | { id: string; nome: string; especialidade: string | null }[]
      | null;
    const profPick = Array.isArray(profRaw) ? profRaw[0] : profRaw;
    return {
      ...base,
      profissional: {
        id: (profPick?.id as string) ?? base.profissional_id,
        nome: (profPick?.nome as string) ?? '',
        especialidade: (profPick?.especialidade as string | null) ?? null,
      },
    };
  });

  return { ok: true, data: lista };
}

// ============================================================
// d) calcularComissaoLancamento
// ============================================================
export async function calcularComissaoLancamento(
  valor: number,
  profissionalId: string,
  agendamentoId?: string | null,
): Promise<ResumoComissao> {
  if (!Number.isFinite(valor) || valor <= 0 || !profissionalId) {
    return { aplicavel: false, percentual: 0, valorComissao: 0 };
  }

  const admin = createAdminClient();
  const { data: cfg } = await admin
    .from('comissoes_profissional')
    .select(
      'tipo_cobranca, percentual, incide_sobre, ativo',
    )
    .eq('profissional_id', profissionalId)
    .maybeSingle();
  if (!cfg) return { aplicavel: false, percentual: 0, valorComissao: 0 };
  if (cfg.ativo === false) {
    return { aplicavel: false, percentual: 0, valorComissao: 0 };
  }

  const tipo = (cfg.tipo_cobranca as TipoCobrancaComissao) ?? 'percentual';
  if (tipo === 'fixo') {
    // Cobranca apenas mensal — lancamento individual nao tem comissao percentual
    return { aplicavel: false, percentual: 0, valorComissao: 0 };
  }

  const incideSobre = (cfg.incide_sobre as IncideSobreComissao) ?? 'tudo';
  if (incideSobre === 'atendimentos' && !agendamentoId) {
    return { aplicavel: false, percentual: 0, valorComissao: 0 };
  }

  const percentual = Number(cfg.percentual) || 0;
  if (percentual <= 0) {
    return { aplicavel: false, percentual: 0, valorComissao: 0 };
  }

  const valorComissao = Math.round(valor * percentual) / 100;
  return { aplicavel: true, percentual, valorComissao };
}

// ============================================================
// e) getComissoesMensais
// ============================================================
export type FiltrosComissoesMensais = {
  mesAno?: string;
  profissionalId?: string;
  status?: StatusComissaoMensal | 'todos';
};

export async function getComissoesMensais(
  filtros: FiltrosComissoesMensais = {},
): Promise<Result<ComissaoMensal[]>> {
  const ctx = await obterContextoAutenticado();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  let query = admin
    .from('comissoes_mensais')
    .select(
      'id, tenant_id, profissional_id, mes_ano, faturamento_bruto, total_atendimentos, detalhamento_pagamentos, total_despesas, detalhamento_despesas, percentual_aplicado, valor_comissao_percentual, valor_fixo_mensal, total_comissao, valor_liquido, lucro_real, status, data_pagamento, forma_pagamento, observacoes, created_at, updated_at, profissionais(id, nome, especialidade)',
    )
    .eq('tenant_id', ctx.tenantId);

  if (ctx.role !== 'admin') {
    query = query.eq('profissional_id', ctx.profissionalId);
  } else if (filtros.profissionalId) {
    query = query.eq('profissional_id', filtros.profissionalId);
  }

  if (filtros.mesAno && /^\d{4}-\d{2}$/.test(filtros.mesAno)) {
    query = query.eq('mes_ano', filtros.mesAno);
  }
  if (
    filtros.status &&
    filtros.status !== 'todos' &&
    ['aberto', 'pago', 'cancelado'].includes(filtros.status)
  ) {
    query = query.eq('status', filtros.status);
  }

  query = query.order('mes_ano', { ascending: false });

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };

  return { ok: true, data: (data ?? []).map((r) => mapComissaoMensal(r)) };
}

// ============================================================
// f) marcarComissaoPaga
// ============================================================
export async function marcarComissaoPaga(
  comissaoMensalId: string,
  formaPagamento: string,
  observacoes?: string,
): Promise<Result<null>> {
  if (!comissaoMensalId) {
    return { ok: false, error: 'Fechamento invalido.' };
  }
  if (!FORMAS_PAGAMENTO_VALIDAS.includes(formaPagamento)) {
    return { ok: false, error: 'Forma de pagamento invalida.' };
  }

  const ctx = await exigirAdmin();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data: row, error: getErr } = await admin
    .from('comissoes_mensais')
    .select('id, tenant_id')
    .eq('id', comissaoMensalId)
    .maybeSingle();
  if (getErr) return { ok: false, error: getErr.message };
  if (!row) return { ok: false, error: 'Fechamento nao encontrado.' };
  if (row.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Sem permissao.' };
  }

  const today = new Date().toISOString().slice(0, 10);
  const update: Record<string, unknown> = {
    status: 'pago',
    data_pagamento: today,
    forma_pagamento: formaPagamento,
    updated_at: new Date().toISOString(),
  };
  const obs = observacoes?.trim();
  if (obs) update.observacoes = obs;

  const { error } = await admin
    .from('comissoes_mensais')
    .update(update)
    .eq('id', comissaoMensalId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/financeiro');
  return { ok: true, data: null };
}

// ============================================================
// g) recalcularFechamento
// ============================================================
function rangeMesAno(mesAno: string): { inicio: string; fim: string } {
  const [anoStr, mesStr] = mesAno.split('-');
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new Error('Periodo invalido.');
  }
  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const proximoMes = mes === 12 ? 1 : mes + 1;
  const proximoAno = mes === 12 ? ano + 1 : ano;
  const fim = `${proximoAno}-${String(proximoMes).padStart(2, '0')}-01`;
  return { inicio, fim };
}

export async function recalcularFechamentoInterno(
  tenantId: string,
  profissionalId: string,
  mesAno: string,
): Promise<Result<ComissaoMensal>> {
  if (!tenantId || !profissionalId) {
    return { ok: false, error: 'Tenant ou profissional invalido.' };
  }
  if (!/^\d{4}-\d{2}$/.test(mesAno)) {
    return { ok: false, error: 'Mes/ano invalido. Use YYYY-MM.' };
  }

  let inicio: string;
  let fim: string;
  try {
    ({ inicio, fim } = rangeMesAno(mesAno));
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Periodo invalido.',
    };
  }

  const admin = createAdminClient();
  const { data: prof, error: profErr } = await admin
    .from('profissionais')
    .select('id, tenant_id')
    .eq('id', profissionalId)
    .maybeSingle();
  if (profErr) return { ok: false, error: profErr.message };
  if (!prof || prof.tenant_id !== tenantId) {
    return { ok: false, error: 'Profissional nao encontrado neste tenant.' };
  }

  const { data: cfg } = await admin
    .from('comissoes_profissional')
    .select(
      'tipo_cobranca, percentual, valor_fixo_mensal, incide_sobre, ativo',
    )
    .eq('profissional_id', profissionalId)
    .maybeSingle();

  const tipoCobranca =
    (cfg?.tipo_cobranca as TipoCobrancaComissao | null) ?? 'percentual';
  const percentualConfig = Number(cfg?.percentual) || 0;
  const valorFixoConfig = Number(cfg?.valor_fixo_mensal) || 0;
  const incideSobre =
    (cfg?.incide_sobre as IncideSobreComissao | null) ?? 'tudo';
  const cfgAtivo = cfg ? cfg.ativo !== false : false;

  // Lancamentos do mes
  const { data: lancs, error: lancErr } = await admin
    .from('financeiro')
    .select(
      'tipo, valor, forma_pagamento, agendamento_id, categoria_despesa, comissao_aplicavel',
    )
    .eq('tenant_id', tenantId)
    .eq('profissional_id', profissionalId)
    .gte('data_lancamento', inicio)
    .lt('data_lancamento', fim);
  if (lancErr) return { ok: false, error: lancErr.message };

  let faturamentoBruto = 0;
  let totalAtendimentos = 0;
  let baseCalculo = 0;
  let totalDespesas = 0;
  const detalhamentoPagamentos: Record<string, number> = {};
  const detalhamentoDespesas: Record<string, number> = {};

  for (const row of lancs ?? []) {
    const valor = Number(row.valor) || 0;
    if (row.tipo === 'receita') {
      faturamentoBruto += valor;
      if (row.agendamento_id) totalAtendimentos += 1;

      const forma = (row.forma_pagamento as string | null) ?? 'outro';
      detalhamentoPagamentos[forma] =
        (detalhamentoPagamentos[forma] ?? 0) + valor;

      const aplicaPorAgendamento =
        incideSobre === 'tudo' || Boolean(row.agendamento_id);
      if (cfgAtivo && tipoCobranca !== 'fixo' && aplicaPorAgendamento) {
        baseCalculo += valor;
      }
    } else if (row.tipo === 'despesa') {
      totalDespesas += valor;
      const cat = (row.categoria_despesa as string | null) ?? 'outros';
      detalhamentoDespesas[cat] = (detalhamentoDespesas[cat] ?? 0) + valor;
    }
  }

  const valorComissaoPercentual = cfgAtivo
    ? Math.round(baseCalculo * percentualConfig) / 100
    : 0;
  const valorFixoAplicado =
    cfgAtivo && (tipoCobranca === 'fixo' || tipoCobranca === 'misto')
      ? valorFixoConfig
      : 0;
  const totalComissao =
    Math.round((valorComissaoPercentual + valorFixoAplicado) * 100) / 100;
  const valorLiquido =
    Math.round((faturamentoBruto - totalComissao) * 100) / 100;
  const lucroReal =
    Math.round((valorLiquido - totalDespesas) * 100) / 100;

  const payload = {
    tenant_id: tenantId,
    profissional_id: profissionalId,
    mes_ano: mesAno,
    faturamento_bruto: faturamentoBruto,
    total_atendimentos: totalAtendimentos,
    detalhamento_pagamentos: detalhamentoPagamentos,
    total_despesas: totalDespesas,
    detalhamento_despesas: detalhamentoDespesas,
    percentual_aplicado: cfgAtivo ? percentualConfig : 0,
    valor_comissao_percentual: valorComissaoPercentual,
    valor_fixo_mensal: valorFixoAplicado,
    total_comissao: totalComissao,
    valor_liquido: valorLiquido,
    lucro_real: lucroReal,
    updated_at: new Date().toISOString(),
  };

  // UPSERT mantendo status existente se ja foi pago
  const { data: existente } = await admin
    .from('comissoes_mensais')
    .select('id, status')
    .eq('tenant_id', tenantId)
    .eq('profissional_id', profissionalId)
    .eq('mes_ano', mesAno)
    .maybeSingle();

  let row: Record<string, unknown> | null = null;
  if (existente) {
    const { data, error } = await admin
      .from('comissoes_mensais')
      .update(payload)
      .eq('id', existente.id as string)
      .select('*')
      .single();
    if (error || !data) {
      return {
        ok: false,
        error: error?.message ?? 'Falha ao atualizar fechamento.',
      };
    }
    row = data as Record<string, unknown>;
  } else {
    const { data, error } = await admin
      .from('comissoes_mensais')
      .insert({ ...payload, status: 'aberto' })
      .select('*')
      .single();
    if (error || !data) {
      return {
        ok: false,
        error: error?.message ?? 'Falha ao criar fechamento.',
      };
    }
    row = data as Record<string, unknown>;
  }

  revalidatePath('/financeiro');
  return { ok: true, data: mapComissaoMensal(row) };
}

export async function recalcularFechamento(
  mesAno: string,
  profissionalId: string,
): Promise<Result<ComissaoMensal>> {
  const ctx = await exigirAdmin();
  if (!ctx.ok) return ctx;
  return recalcularFechamentoInterno(ctx.tenantId, profissionalId, mesAno);
}
