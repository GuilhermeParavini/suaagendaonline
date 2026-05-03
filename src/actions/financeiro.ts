'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';

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
};

export type ResumoFinanceiro = {
  receita: number;
  despesa: number;
  saldo: number;
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
    .select('tipo, valor')
    .eq('tenant_id', ctx.tenantId)
    .gte('data_lancamento', inicio)
    .lt('data_lancamento', fim);
  if (error) return { ok: false, error: error.message };

  let receita = 0;
  let despesa = 0;
  for (const row of rows ?? []) {
    const valor = Number(row.valor) || 0;
    if (row.tipo === 'receita') receita += valor;
    else if (row.tipo === 'despesa') despesa += valor;
  }
  return { ok: true, data: { receita, despesa, saldo: receita - despesa } };
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
      'id, tipo, descricao, valor, forma_pagamento, data_lancamento, data_pagamento, pago, categoria, observacoes, agendamento_id, pacientes(id, nome)',
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
};

export async function criarLancamento(
  input: NovoLancamentoInput,
): Promise<Result<{ id: string }>> {
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

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('financeiro')
    .insert({
      tenant_id: ctx.tenantId,
      profissional_id: ctx.profissionalId,
      paciente_id: pacienteId,
      tipo: input.tipo,
      descricao,
      valor: input.valor,
      forma_pagamento: input.forma_pagamento ?? null,
      data_lancamento: input.data_lancamento,
      data_pagamento: input.pago ? input.data_lancamento : null,
      pago: input.pago,
      categoria: input.categoria?.trim() || null,
      observacoes: input.observacoes?.trim() || null,
    })
    .select('id')
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Falha ao salvar.' };
  }

  revalidatePath('/financeiro');
  return { ok: true, data: { id: data.id as string } };
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

export async function getReciboData(id: string): Promise<
  Result<{
    lancamento: Lancamento;
    profissional: {
      nome: string;
      especialidade: string;
      registro_profissional: string | null;
      email: string;
      telefone: string | null;
    };
    tenant: {
      nome_empresa: string;
      endereco: string | null;
      cidade: string | null;
      estado: string | null;
    };
  }>
> {
  const ctx = await obterTenant();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from('financeiro')
    .select(
      'id, tipo, descricao, valor, forma_pagamento, data_lancamento, data_pagamento, pago, categoria, observacoes, agendamento_id, tenant_id, pacientes(id, nome)',
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

  const { data: prof, error: profErr } = await admin
    .from('profissionais')
    .select('nome, especialidade, registro_profissional, email, telefone')
    .eq('id', ctx.profissionalId)
    .maybeSingle();
  if (profErr) return { ok: false, error: profErr.message };
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };

  const { data: tenant, error: tenantErr } = await admin
    .from('tenants')
    .select('nome_empresa, endereco, cidade, estado')
    .eq('id', ctx.tenantId)
    .maybeSingle();
  if (tenantErr) return { ok: false, error: tenantErr.message };
  if (!tenant) return { ok: false, error: 'Tenant nao encontrado.' };

  const paciente = Array.isArray(row.pacientes) ? row.pacientes[0] : row.pacientes;

  const lancamento: Lancamento = {
    id: row.id as string,
    tipo: row.tipo as FinanceiroTipo,
    descricao: row.descricao as string,
    valor: Number(row.valor) || 0,
    forma_pagamento: (row.forma_pagamento as FormaPagamento | null) ?? null,
    data_lancamento: row.data_lancamento as string,
    data_pagamento: (row.data_pagamento as string | null) ?? null,
    pago: Boolean(row.pago),
    categoria: (row.categoria as string | null) ?? null,
    observacoes: (row.observacoes as string | null) ?? null,
    agendamento_id: (row.agendamento_id as string | null) ?? null,
    paciente: paciente
      ? { id: paciente.id as string, nome: paciente.nome as string }
      : null,
  };

  return {
    ok: true,
    data: {
      lancamento,
      profissional: {
        nome: prof.nome as string,
        especialidade: prof.especialidade as string,
        registro_profissional: (prof.registro_profissional as string | null) ?? null,
        email: prof.email as string,
        telefone: (prof.telefone as string | null) ?? null,
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
