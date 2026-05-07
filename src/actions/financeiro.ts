'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { calcularComissaoLancamento } from '@/actions/comissoes';

export type FinanceiroTipo = 'receita' | 'despesa';
export type FormaPagamento =
  | 'dinheiro'
  | 'pix'
  | 'cartao_credito'
  | 'cartao_debito'
  | 'convenio'
  | 'transferencia'
  | 'outro';

const FORMAS_VALIDAS: FormaPagamento[] = [
  'dinheiro',
  'pix',
  'cartao_credito',
  'cartao_debito',
  'convenio',
  'transferencia',
  'outro',
];

export type Lancamento = {
  id: string;
  tipo: FinanceiroTipo;
  descricao: string;
  valor: number;
  forma_pagamento: FormaPagamento | null;
  data_lancamento: string;
  data_pagamento: string | null;
  pago: boolean;
  categoria: string | null;
  observacoes: string | null;
  paciente: { id: string; nome: string } | null;
  agendamento_id: string | null;
  categoria_despesa: string | null;
  fornecedor: string | null;
  percentual_comissao: number | null;
  valor_comissao: number | null;
  comissao_aplicavel: boolean;
};

export type ResumoFinanceiro = {
  receita: number;
  despesa: number;
  saldo: number;
  totalComissao: number;
  valorLiquido: number;
  temComissao: boolean;
};

export type LancamentosFiltros = {
  mes: number;
  ano: number;
  tipo?: FinanceiroTipo;
  forma_pagamento?: FormaPagamento | 'todos';
  status?: 'todos' | 'pago' | 'pendente';
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function rangeDoMes(ano: number, mes: number): { inicio: string; fim: string } {
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new Error('Periodo invalido.');
  }
  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const proximoMes = mes === 12 ? 1 : mes + 1;
  const proximoAno = mes === 12 ? ano + 1 : ano;
  const fim = `${proximoAno}-${String(proximoMes).padStart(2, '0')}-01`;
  return { inicio, fim };
}

async function obterTenant(): Promise<
  | { ok: true; tenantId: string; profissionalId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessao expirada.' };

  const admin = createAdminClient();
  const { data: prof, error } = await admin
    .from('profissionais')
    .select('id, tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };
  return {
    ok: true,
    tenantId: prof.tenant_id as string,
    profissionalId: prof.id as string,
  };
}

export async function getResumoFinanceiro(
  mes: number,
  ano: number,
): Promise<Result<ResumoFinanceiro>> {
  const ctx = await obterTenant();
  if (!ctx.ok) return ctx;

  let inicio: string;
  let fim: string;
  try {
    ({ inicio, fim } = rangeDoMes(ano, mes));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Periodo invalido.' };
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from('financeiro')
    .select('tipo, valor, valor_comissao, comissao_aplicavel')
    .eq('tenant_id', ctx.tenantId)
    .eq('profissional_id', ctx.profissionalId)
    .gte('data_lancamento', inicio)
    .lt('data_lancamento', fim);
  if (error) return { ok: false, error: error.message };

  let receita = 0;
  let despesa = 0;
  let totalComissao = 0;
  for (const row of rows ?? []) {
    const valor = Number(row.valor) || 0;
    if (row.tipo === 'receita') {
      receita += valor;
      if (row.comissao_aplicavel) {
        totalComissao += Number(row.valor_comissao) || 0;
      }
    } else if (row.tipo === 'despesa') {
      despesa += valor;
    }
  }

  // Verifica se o profissional tem config de comissao
  const { data: cfg } = await admin
    .from('comissoes_profissional')
    .select('id, ativo')
    .eq('profissional_id', ctx.profissionalId)
    .maybeSingle();
  const temComissao = !!cfg && cfg.ativo !== false;

  return {
    ok: true,
    data: {
      receita,
      despesa,
      saldo: receita - despesa,
      totalComissao: temComissao ? totalComissao : 0,
      valorLiquido: temComissao ? receita - totalComissao : receita,
      temComissao,
    },
  };
}

export async function getLancamentos(
  filtros: LancamentosFiltros,
): Promise<Result<Lancamento[]>> {
  const ctx = await obterTenant();
  if (!ctx.ok) return ctx;

  let inicio: string;
  let fim: string;
  try {
    ({ inicio, fim } = rangeDoMes(filtros.ano, filtros.mes));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Periodo invalido.' };
  }

  const admin = createAdminClient();
  let query = admin
    .from('financeiro')
    .select(
      'id, tipo, descricao, valor, forma_pagamento, data_lancamento, data_pagamento, pago, categoria, observacoes, agendamento_id, categoria_despesa, fornecedor, percentual_comissao, valor_comissao, comissao_aplicavel, pacientes(id, nome)',
    )
    .eq('tenant_id', ctx.tenantId)
    .gte('data_lancamento', inicio)
    .lt('data_lancamento', fim)
    .order('data_lancamento', { ascending: false });

  if (filtros.tipo === 'receita' || filtros.tipo === 'despesa') {
    query = query.eq('tipo', filtros.tipo);
  }
  if (
    filtros.forma_pagamento &&
    filtros.forma_pagamento !== 'todos' &&
    FORMAS_VALIDAS.includes(filtros.forma_pagamento as FormaPagamento)
  ) {
    query = query.eq('forma_pagamento', filtros.forma_pagamento);
  }
  if (filtros.status === 'pago') query = query.eq('pago', true);
  else if (filtros.status === 'pendente') query = query.eq('pago', false);

  const { data: rows, error } = await query;
  if (error) return { ok: false, error: error.message };

  const lancamentos: Lancamento[] = (rows ?? []).map((r) => {
    const paciente = Array.isArray(r.pacientes) ? r.pacientes[0] : r.pacientes;
    return {
      id: r.id as string,
      tipo: r.tipo as FinanceiroTipo,
      descricao: r.descricao as string,
      valor: Number(r.valor) || 0,
      forma_pagamento: (r.forma_pagamento as FormaPagamento | null) ?? null,
      data_lancamento: r.data_lancamento as string,
      data_pagamento: (r.data_pagamento as string | null) ?? null,
      pago: Boolean(r.pago),
      categoria: (r.categoria as string | null) ?? null,
      observacoes: (r.observacoes as string | null) ?? null,
      agendamento_id: (r.agendamento_id as string | null) ?? null,
      categoria_despesa: (r.categoria_despesa as string | null) ?? null,
      fornecedor: (r.fornecedor as string | null) ?? null,
      percentual_comissao:
        r.percentual_comissao === null || r.percentual_comissao === undefined
          ? null
          : Number(r.percentual_comissao),
      valor_comissao:
        r.valor_comissao === null || r.valor_comissao === undefined
          ? null
          : Number(r.valor_comissao),
      comissao_aplicavel: Boolean(r.comissao_aplicavel),
      paciente: paciente
        ? { id: paciente.id as string, nome: paciente.nome as string }
        : null,
    };
  });

  return { ok: true, data: lancamentos };
}

export type NovoLancamentoInput = {
  tipo: FinanceiroTipo;
  descricao: string;
  valor: number;
  forma_pagamento?: FormaPagamento | null;
  data_lancamento: string;
  pago: boolean;
  categoria?: string;
  observacoes?: string;
  paciente_id?: string | null;
  agendamento_id?: string | null;
  categoria_despesa?: string | null;
  fornecedor?: string | null;
};

export type CriarLancamentoData = {
  id: string;
  sugerirEntradaEstoque?: boolean;
};

export async function criarLancamento(
  input: NovoLancamentoInput,
): Promise<Result<CriarLancamentoData>> {
  const ctx = await obterTenant();
  if (!ctx.ok) return ctx;

  const descricao = input.descricao?.trim();
  if (!descricao) return { ok: false, error: 'Descricao obrigatoria.' };
  if (!['receita', 'despesa'].includes(input.tipo)) {
    return { ok: false, error: 'Tipo invalido.' };
  }
  if (!Number.isFinite(input.valor) || input.valor <= 0) {
    return { ok: false, error: 'Valor invalido.' };
  }
  if (!isIsoDate(input.data_lancamento)) {
    return { ok: false, error: 'Data invalida.' };
  }
  if (
    input.forma_pagamento &&
    !FORMAS_VALIDAS.includes(input.forma_pagamento)
  ) {
    return { ok: false, error: 'Forma de pagamento invalida.' };
  }

  let pacienteId: string | null = null;
  if (input.paciente_id) {
    const admin = createAdminClient();
    const { data: pac, error: pacErr } = await admin
      .from('pacientes')
      .select('id')
      .eq('id', input.paciente_id)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();
    if (pacErr) return { ok: false, error: pacErr.message };
    if (!pac) return { ok: false, error: 'Paciente nao encontrado.' };
    pacienteId = pac.id as string;
  }

  let agendamentoId: string | null = null;
  if (input.agendamento_id) {
    const admin = createAdminClient();
    const { data: ag, error: agErr } = await admin
      .from('agendamentos')
      .select('id, tenant_id')
      .eq('id', input.agendamento_id)
      .maybeSingle();
    if (agErr) return { ok: false, error: agErr.message };
    if (!ag || ag.tenant_id !== ctx.tenantId) {
      return { ok: false, error: 'Agendamento nao encontrado.' };
    }
    agendamentoId = ag.id as string;
  }

  // Comissao automatica para receitas
  let percentualComissao = 0;
  let valorComissao = 0;
  let comissaoAplicavel = false;
  let categoriaDespesa: string | null = null;
  let fornecedor: string | null = null;

  if (input.tipo === 'receita') {
    const resumo = await calcularComissaoLancamento(
      input.valor,
      ctx.profissionalId,
      agendamentoId,
    );
    percentualComissao = resumo.percentual;
    valorComissao = resumo.valorComissao;
    comissaoAplicavel = resumo.aplicavel;
  } else {
    categoriaDespesa = input.categoria_despesa?.trim() || null;
    fornecedor = input.fornecedor?.trim() || null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('financeiro')
    .insert({
      tenant_id: ctx.tenantId,
      profissional_id: ctx.profissionalId,
      paciente_id: pacienteId,
      agendamento_id: agendamentoId,
      tipo: input.tipo,
      descricao,
      valor: input.valor,
      forma_pagamento: input.forma_pagamento ?? null,
      data_lancamento: input.data_lancamento,
      data_pagamento: input.pago ? input.data_lancamento : null,
      pago: input.pago,
      categoria: input.categoria?.trim() || null,
      observacoes: input.observacoes?.trim() || null,
      categoria_despesa: categoriaDespesa,
      fornecedor,
      percentual_comissao: comissaoAplicavel ? percentualComissao : 0,
      valor_comissao: comissaoAplicavel ? valorComissao : 0,
      comissao_aplicavel: comissaoAplicavel,
    })
    .select('id')
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Falha ao salvar.' };
  }

  const sugerirEntradaEstoque =
    input.tipo === 'despesa' &&
    (categoriaDespesa ?? '').toLowerCase() === 'produtos';

  revalidatePath('/financeiro');
  return {
    ok: true,
    data: {
      id: data.id as string,
      sugerirEntradaEstoque: sugerirEntradaEstoque || undefined,
    },
  };
}

export async function atualizarPago(
  id: string,
  pago: boolean,
): Promise<Result<null>> {
  if (!id) return { ok: false, error: 'Lancamento invalido.' };

  const ctx = await obterTenant();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data: row, error: getErr } = await admin
    .from('financeiro')
    .select('id, tenant_id, data_lancamento')
    .eq('id', id)
    .maybeSingle();
  if (getErr) return { ok: false, error: getErr.message };
  if (!row) return { ok: false, error: 'Lancamento nao encontrado.' };
  if (row.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Sem permissao.' };
  }

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await admin
    .from('financeiro')
    .update({
      pago,
      data_pagamento: pago ? today : null,
    })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/financeiro');
  return { ok: true, data: null };
}

export async function excluirLancamento(id: string): Promise<Result<null>> {
  if (!id) return { ok: false, error: 'Lancamento invalido.' };

  const ctx = await obterTenant();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data: row, error: getErr } = await admin
    .from('financeiro')
    .select('id, tenant_id')
    .eq('id', id)
    .maybeSingle();
  if (getErr) return { ok: false, error: getErr.message };
  if (!row) return { ok: false, error: 'Lancamento nao encontrado.' };
  if (row.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Sem permissao.' };
  }

  const { error } = await admin.from('financeiro').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/financeiro');
  return { ok: true, data: null };
}

export type PacienteOption = { id: string; nome: string };

export async function listarPacientesOptions(): Promise<Result<PacienteOption[]>> {
  const ctx = await obterTenant();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('pacientes')
    .select('id, nome')
    .eq('tenant_id', ctx.tenantId)
    .eq('ativo', true)
    .order('nome', { ascending: true });
  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    data: (data ?? []).map((p) => ({
      id: p.id as string,
      nome: p.nome as string,
    })),
  };
}

export type ReciboProfissional = {
  nome: string;
  especialidade: string;
  registro_profissional: string | null;
  email: string;
  telefone: string | null;
  assinatura_tipo: 'fonte' | 'imagem' | null;
  assinatura_fonte: string | null;
  assinatura_url: string | null;
  logo_url: string | null;
};

type ReciboData = {
  lancamento: Lancamento;
  pacienteEmail: string | null;
  pacienteTelefone: string | null;
  profissional: ReciboProfissional;
  tenant: {
    nome_empresa: string;
    endereco: string | null;
    cidade: string | null;
    estado: string | null;
  };
};

async function montarReciboData(
  admin: ReturnType<typeof createAdminClient>,
  row: {
    id: string;
    tipo: string;
    descricao: string;
    valor: unknown;
    forma_pagamento: string | null;
    data_lancamento: string;
    data_pagamento: string | null;
    pago: boolean;
    categoria: string | null;
    observacoes: string | null;
    agendamento_id: string | null;
    tenant_id: string;
    profissional_id: string | null;
    paciente_id: string | null;
    pacientes: { id: string; nome: string } | { id: string; nome: string }[] | null;
  },
): Promise<Result<ReciboData>> {
  const paciente = Array.isArray(row.pacientes) ? row.pacientes[0] : row.pacientes;

  let pacienteEmail: string | null = null;
  let pacienteTelefone: string | null = null;
  if (row.paciente_id) {
    const { data: pac } = await admin
      .from('pacientes')
      .select('email, telefone')
      .eq('id', row.paciente_id)
      .maybeSingle();
    pacienteEmail = (pac?.email as string | null) ?? null;
    pacienteTelefone = (pac?.telefone as string | null) ?? null;
  }

  if (!row.profissional_id) {
    return { ok: false, error: 'Profissional do lancamento nao encontrado.' };
  }

  const { data: prof, error: profErr } = await admin
    .from('profissionais')
    .select(
      'nome, especialidade, registro_profissional, email, telefone, assinatura_tipo, assinatura_fonte, assinatura_url, logo_url',
    )
    .eq('id', row.profissional_id)
    .maybeSingle();
  if (profErr) return { ok: false, error: profErr.message };
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };

  const { data: tenant, error: tenantErr } = await admin
    .from('tenants')
    .select('nome_empresa, endereco, cidade, estado')
    .eq('id', row.tenant_id)
    .maybeSingle();
  if (tenantErr) return { ok: false, error: tenantErr.message };
  if (!tenant) return { ok: false, error: 'Tenant nao encontrado.' };

  const lancamento: Lancamento = {
    id: row.id,
    tipo: row.tipo as FinanceiroTipo,
    descricao: row.descricao,
    valor: Number(row.valor) || 0,
    forma_pagamento: (row.forma_pagamento as FormaPagamento | null) ?? null,
    data_lancamento: row.data_lancamento,
    data_pagamento: row.data_pagamento,
    pago: Boolean(row.pago),
    categoria: row.categoria,
    observacoes: row.observacoes,
    agendamento_id: row.agendamento_id,
    categoria_despesa: null,
    fornecedor: null,
    percentual_comissao: null,
    valor_comissao: null,
    comissao_aplicavel: false,
    paciente: paciente
      ? { id: paciente.id as string, nome: paciente.nome as string }
      : null,
  };

  return {
    ok: true,
    data: {
      lancamento,
      pacienteEmail,
      pacienteTelefone,
      profissional: {
        nome: prof.nome as string,
        especialidade: prof.especialidade as string,
        registro_profissional: (prof.registro_profissional as string | null) ?? null,
        email: prof.email as string,
        telefone: (prof.telefone as string | null) ?? null,
        assinatura_tipo:
          (prof.assinatura_tipo as 'fonte' | 'imagem' | null) ?? null,
        assinatura_fonte: (prof.assinatura_fonte as string | null) ?? null,
        assinatura_url: (prof.assinatura_url as string | null) ?? null,
        logo_url: (prof.logo_url as string | null) ?? null,
      },
      tenant: {
        nome_empresa: tenant.nome_empresa as string,
        endereco: (tenant.endereco as string | null) ?? null,
        cidade: (tenant.cidade as string | null) ?? null,
        estado: (tenant.estado as string | null) ?? null,
      },
    },
  };
}

export async function getReciboPublico(id: string): Promise<Result<ReciboData>> {
  if (!id || typeof id !== 'string') {
    return { ok: false, error: 'Recibo invalido.' };
  }

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from('financeiro')
    .select(
      'id, tipo, descricao, valor, forma_pagamento, data_lancamento, data_pagamento, pago, categoria, observacoes, agendamento_id, tenant_id, profissional_id, paciente_id, pacientes(id, nome)',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!row) return { ok: false, error: 'Recibo nao encontrado.' };
  if (row.tipo !== 'receita') {
    return { ok: false, error: 'Recibo disponivel apenas para receitas.' };
  }
  if (!row.pago) {
    return { ok: false, error: 'Recibo disponivel apenas para lancamentos pagos.' };
  }

  return montarReciboData(admin, {
    id: row.id as string,
    tipo: row.tipo as string,
    descricao: row.descricao as string,
    valor: row.valor,
    forma_pagamento: (row.forma_pagamento as string | null) ?? null,
    data_lancamento: row.data_lancamento as string,
    data_pagamento: (row.data_pagamento as string | null) ?? null,
    pago: Boolean(row.pago),
    categoria: (row.categoria as string | null) ?? null,
    observacoes: (row.observacoes as string | null) ?? null,
    agendamento_id: (row.agendamento_id as string | null) ?? null,
    tenant_id: row.tenant_id as string,
    profissional_id: (row.profissional_id as string | null) ?? null,
    paciente_id: (row.paciente_id as string | null) ?? null,
    pacientes: (row.pacientes as
      | { id: string; nome: string }
      | { id: string; nome: string }[]
      | null) ?? null,
  });
}

export async function getReciboData(id: string): Promise<Result<ReciboData>> {
  const ctx = await obterTenant();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from('financeiro')
    .select(
      'id, tipo, descricao, valor, forma_pagamento, data_lancamento, data_pagamento, pago, categoria, observacoes, agendamento_id, tenant_id, profissional_id, paciente_id, pacientes(id, nome)',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!row) return { ok: false, error: 'Lancamento nao encontrado.' };
  if (row.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Sem permissao.' };
  }
  if (row.tipo !== 'receita') {
    return { ok: false, error: 'Recibo disponivel apenas para receitas.' };
  }
  if (!row.pago) {
    return { ok: false, error: 'Recibo disponivel apenas para lancamentos pagos.' };
  }

  return montarReciboData(admin, {
    id: row.id as string,
    tipo: row.tipo as string,
    descricao: row.descricao as string,
    valor: row.valor,
    forma_pagamento: (row.forma_pagamento as string | null) ?? null,
    data_lancamento: row.data_lancamento as string,
    data_pagamento: (row.data_pagamento as string | null) ?? null,
    pago: Boolean(row.pago),
    categoria: (row.categoria as string | null) ?? null,
    observacoes: (row.observacoes as string | null) ?? null,
    agendamento_id: (row.agendamento_id as string | null) ?? null,
    tenant_id: row.tenant_id as string,
    profissional_id: (row.profissional_id as string | null) ?? null,
    paciente_id: (row.paciente_id as string | null) ?? null,
    pacientes: (row.pacientes as
      | { id: string; nome: string }
      | { id: string; nome: string }[]
      | null) ?? null,
  });
}
