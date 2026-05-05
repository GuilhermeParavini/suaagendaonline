'use server';

import { createAdminClient, createClient } from '@/lib/supabase/server';
import type { FormaPagamento } from './financeiro';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

type Genero = 'masculino' | 'feminino' | 'prefiro_nao_informar';

type StatusAgendamento =
  | 'agendado'
  | 'confirmado'
  | 'em_atendimento'
  | 'concluido'
  | 'faltou'
  | 'cancelado';

const TZ = 'America/Sao_Paulo';

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

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function defaultPeriodo(): { dataInicio: string; dataFim: string } {
  const now = new Date();
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;
  const inicio = `${ano}-${pad2(mes)}-01`;
  const last = new Date(ano, mes, 0);
  const fim = `${last.getFullYear()}-${pad2(last.getMonth() + 1)}-${pad2(last.getDate())}`;
  return { dataInicio: inicio, dataFim: fim };
}

function ultimos6Meses(): { ano: number; mes: number; label: string }[] {
  const now = new Date();
  const out: { ano: number; mes: number; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      ano: d.getFullYear(),
      mes: d.getMonth() + 1,
      label: `${pad2(d.getMonth() + 1)}/${d.getFullYear()}`,
    });
  }
  return out;
}

function spParts(d: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  weekday: number;
} {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
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
    year: Number(obj.year),
    month: Number(obj.month),
    day: Number(obj.day),
    hour: hourRaw,
    weekday: weekdayMap[obj.weekday] ?? 0,
  };
}

// ============================================================
// FATURAMENTO
// ============================================================

export type FaturamentoFiltros = {
  dataInicio?: string;
  dataFim?: string;
  formaPagamento?: FormaPagamento | 'todos';
  pago?: 'todos' | 'pago' | 'pendente';
  profissionalId?: string | 'todos';
};

export type FaturamentoData = {
  periodo: { dataInicio: string; dataFim: string };
  totalReceitas: number;
  totalDespesas: number;
  saldo: number;
  ticketMedio: number;
  porMes: { mes: string; receitas: number; despesas: number }[];
  porFormaPagamento: { forma: string; total: number }[];
  lancamentos: {
    id: string;
    data: string;
    descricao: string;
    paciente_nome: string | null;
    valor: number;
    tipo: 'receita' | 'despesa';
    forma_pagamento: FormaPagamento | null;
    pago: boolean;
  }[];
};

const FORMAS_VALIDAS: FormaPagamento[] = [
  'dinheiro',
  'pix',
  'cartao_credito',
  'cartao_debito',
  'convenio',
  'transferencia',
  'outro',
];

export async function getRelatorioFaturamento(
  filtros: FaturamentoFiltros = {},
): Promise<Result<FaturamentoData>> {
  const ctx = await obterTenant();
  if (!ctx.ok) return ctx;

  const padrao = defaultPeriodo();
  const dataInicio =
    filtros.dataInicio && isIsoDate(filtros.dataInicio)
      ? filtros.dataInicio
      : padrao.dataInicio;
  const dataFim =
    filtros.dataFim && isIsoDate(filtros.dataFim)
      ? filtros.dataFim
      : padrao.dataFim;
  if (dataFim < dataInicio) {
    return { ok: false, error: 'Data fim anterior a data inicio.' };
  }

  const admin = createAdminClient();

  let q = admin
    .from('financeiro')
    .select(
      'id, tipo, descricao, valor, forma_pagamento, data_lancamento, pago, pacientes(id, nome)',
    )
    .eq('tenant_id', ctx.tenantId)
    .gte('data_lancamento', dataInicio)
    .lte('data_lancamento', dataFim)
    .order('data_lancamento', { ascending: false });

  if (
    filtros.formaPagamento &&
    filtros.formaPagamento !== 'todos' &&
    FORMAS_VALIDAS.includes(filtros.formaPagamento as FormaPagamento)
  ) {
    q = q.eq('forma_pagamento', filtros.formaPagamento);
  }
  if (filtros.pago === 'pago') q = q.eq('pago', true);
  else if (filtros.pago === 'pendente') q = q.eq('pago', false);
  if (filtros.profissionalId && filtros.profissionalId !== 'todos') {
    q = q.eq('profissional_id', filtros.profissionalId);
  }

  const { data: rows, error } = await q;
  if (error) return { ok: false, error: error.message };

  const lancamentos = (rows ?? []).map((r) => {
    const pac = Array.isArray(r.pacientes) ? r.pacientes[0] : r.pacientes;
    return {
      id: r.id as string,
      data: r.data_lancamento as string,
      descricao: r.descricao as string,
      paciente_nome: (pac?.nome as string | undefined) ?? null,
      valor: Number(r.valor) || 0,
      tipo: r.tipo as 'receita' | 'despesa',
      forma_pagamento: (r.forma_pagamento as FormaPagamento | null) ?? null,
      pago: Boolean(r.pago),
    };
  });

  let totalReceitas = 0;
  let totalDespesas = 0;
  let countReceitas = 0;
  for (const l of lancamentos) {
    if (l.tipo === 'receita') {
      totalReceitas += l.valor;
      countReceitas++;
    } else {
      totalDespesas += l.valor;
    }
  }
  const ticketMedio = countReceitas > 0 ? totalReceitas / countReceitas : 0;

  const formaMap = new Map<string, number>();
  for (const l of lancamentos) {
    if (l.tipo !== 'receita') continue;
    const f = l.forma_pagamento ?? 'outro';
    formaMap.set(f, (formaMap.get(f) ?? 0) + l.valor);
  }
  const porFormaPagamento = Array.from(formaMap.entries())
    .map(([forma, total]) => ({ forma, total }))
    .sort((a, b) => b.total - a.total);

  const seis = ultimos6Meses();
  const inicio6 = `${seis[0].ano}-${pad2(seis[0].mes)}-01`;
  const last = seis[seis.length - 1];
  const lastDate = new Date(last.ano, last.mes, 0);
  const fim6 = `${lastDate.getFullYear()}-${pad2(lastDate.getMonth() + 1)}-${pad2(lastDate.getDate())}`;

  const { data: porMesRows, error: errMes } = await admin
    .from('financeiro')
    .select('tipo, valor, data_lancamento')
    .eq('tenant_id', ctx.tenantId)
    .gte('data_lancamento', inicio6)
    .lte('data_lancamento', fim6);
  if (errMes) return { ok: false, error: errMes.message };

  const porMesAcc = new Map<string, { receitas: number; despesas: number }>();
  for (const m of seis) {
    porMesAcc.set(m.label, { receitas: 0, despesas: 0 });
  }
  for (const row of porMesRows ?? []) {
    const d = row.data_lancamento as string;
    if (!d) continue;
    const label = `${d.slice(5, 7)}/${d.slice(0, 4)}`;
    const acc = porMesAcc.get(label);
    if (!acc) continue;
    const v = Number(row.valor) || 0;
    if (row.tipo === 'receita') acc.receitas += v;
    else if (row.tipo === 'despesa') acc.despesas += v;
  }
  const porMes = seis.map((m) => ({
    mes: m.label,
    receitas: porMesAcc.get(m.label)?.receitas ?? 0,
    despesas: porMesAcc.get(m.label)?.despesas ?? 0,
  }));

  return {
    ok: true,
    data: {
      periodo: { dataInicio, dataFim },
      totalReceitas,
      totalDespesas,
      saldo: totalReceitas - totalDespesas,
      ticketMedio,
      porMes,
      porFormaPagamento,
      lancamentos,
    },
  };
}

// ============================================================
// PACIENTES
// ============================================================

export type FaixaEtaria = '0-17' | '18-30' | '31-50' | '51-65' | '65+';

export type StatusTratamentoFiltro = 'ativo' | 'alta' | 'inativo' | 'todos';

export type PacientesFiltros = {
  dataInicio?: string;
  dataFim?: string;
  genero?: Genero | 'todos';
  faixaEtaria?: FaixaEtaria | 'todos';
  profissionalId?: string | 'todos';
  statusTratamento?: StatusTratamentoFiltro;
};

export type OrigemPacienteRelatorio = {
  origem: string;
  quantidade: number;
  percentual: number;
};

export type PacientesData = {
  periodo: { dataInicio: string; dataFim: string };
  total: number;
  novosNoPeriodo: number;
  retornosNoPeriodo: number;
  taxaRetorno: number;
  pacientesAlta: number;
  porMes: { mes: string; novos: number }[];
  porGenero: { genero: string; total: number }[];
  porOrigem: OrigemPacienteRelatorio[];
  topPacientes: {
    id: string;
    nome: string;
    totalConsultas: number;
    ultimaConsulta: string | null;
  }[];
};

function calcIdade(dataNascimentoIso: string): number | null {
  if (!isIsoDate(dataNascimentoIso)) return null;
  const today = new Date();
  const [y, m, d] = dataNascimentoIso.split('-').map(Number);
  let idade = today.getFullYear() - y;
  const aniv = new Date(today.getFullYear(), m - 1, d);
  if (today < aniv) idade--;
  return idade;
}

function bucketFaixa(idade: number): FaixaEtaria {
  if (idade <= 17) return '0-17';
  if (idade <= 30) return '18-30';
  if (idade <= 50) return '31-50';
  if (idade <= 65) return '51-65';
  return '65+';
}

export async function getRelatorioPacientes(
  filtros: PacientesFiltros = {},
): Promise<Result<PacientesData>> {
  const ctx = await obterTenant();
  if (!ctx.ok) return ctx;

  const padrao = defaultPeriodo();
  const dataInicio =
    filtros.dataInicio && isIsoDate(filtros.dataInicio)
      ? filtros.dataInicio
      : padrao.dataInicio;
  const dataFim =
    filtros.dataFim && isIsoDate(filtros.dataFim)
      ? filtros.dataFim
      : padrao.dataFim;
  if (dataFim < dataInicio) {
    return { ok: false, error: 'Data fim anterior a data inicio.' };
  }

  const admin = createAdminClient();

  const { data: pacientesRows, error: errPac } = await admin
    .from('pacientes')
    .select(
      'id, nome, genero, data_nascimento, created_at, origem, origem_detalhe, status_tratamento',
    )
    .eq('tenant_id', ctx.tenantId)
    .eq('ativo', true);
  if (errPac) return { ok: false, error: errPac.message };

  type PacRow = {
    id: string;
    nome: string;
    genero: Genero;
    data_nascimento: string;
    created_at: string;
    origem: string | null;
    origem_detalhe: string | null;
    status_tratamento: 'ativo' | 'alta' | 'inativo';
  };
  const todosPacientes: PacRow[] = (pacientesRows ?? []).map((p) => ({
    id: p.id as string,
    nome: p.nome as string,
    genero: p.genero as Genero,
    data_nascimento: p.data_nascimento as string,
    created_at: p.created_at as string,
    origem: (p.origem as string | null) ?? null,
    origem_detalhe: (p.origem_detalhe as string | null) ?? null,
    status_tratamento:
      ((p.status_tratamento as 'ativo' | 'alta' | 'inativo' | null) ??
        'ativo'),
  }));

  // Aplica filtros
  const filtrados = todosPacientes.filter((p) => {
    if (
      filtros.genero &&
      filtros.genero !== 'todos' &&
      p.genero !== filtros.genero
    )
      return false;
    if (filtros.faixaEtaria && filtros.faixaEtaria !== 'todos') {
      const idade = calcIdade(p.data_nascimento);
      if (idade === null) return false;
      if (bucketFaixa(idade) !== filtros.faixaEtaria) return false;
    }
    if (
      filtros.statusTratamento &&
      filtros.statusTratamento !== 'todos' &&
      p.status_tratamento !== filtros.statusTratamento
    )
      return false;
    return true;
  });

  const total = filtrados.length;

  const inicioTs = `${dataInicio}T00:00:00`;
  const fimTs = `${dataFim}T23:59:59`;
  const novos = filtrados.filter((p) => {
    if (!p.created_at) return false;
    return p.created_at >= inicioTs && p.created_at <= fimTs + '+00';
  });
  const novosNoPeriodo = novos.length;

  const ids = filtrados.map((p) => p.id);
  let retornosNoPeriodo = 0;
  type AgRow = { paciente_id: string; data_hora: string; status: string };
  const agendamentosPorPac = new Map<string, AgRow[]>();
  if (ids.length > 0) {
    let agQ = admin
      .from('agendamentos')
      .select('paciente_id, data_hora, status')
      .eq('tenant_id', ctx.tenantId)
      .eq('status', 'concluido')
      .in('paciente_id', ids);
    if (filtros.profissionalId && filtros.profissionalId !== 'todos') {
      agQ = agQ.eq('profissional_id', filtros.profissionalId);
    }
    const { data: agRows, error: errAg } = await agQ;
    if (errAg) return { ok: false, error: errAg.message };
    for (const r of agRows ?? []) {
      const pid = r.paciente_id as string;
      const arr = agendamentosPorPac.get(pid) ?? [];
      arr.push({
        paciente_id: pid,
        data_hora: r.data_hora as string,
        status: r.status as string,
      });
      agendamentosPorPac.set(pid, arr);
    }
    for (const [, lista] of agendamentosPorPac) {
      if (lista.length < 2) continue;
      const teveNoPeriodo = lista.some((a) => {
        const ymd = a.data_hora?.slice(0, 10) ?? '';
        return ymd >= dataInicio && ymd <= dataFim;
      });
      if (teveNoPeriodo) retornosNoPeriodo++;
    }
  }

  const ativosComConsulta = Array.from(agendamentosPorPac.values()).filter(
    (l) => l.length > 0,
  ).length;
  const taxaRetorno =
    ativosComConsulta > 0 ? (retornosNoPeriodo / ativosComConsulta) * 100 : 0;

  const seis = ultimos6Meses();
  const porMesAcc = new Map<string, number>();
  for (const m of seis) porMesAcc.set(m.label, 0);
  for (const p of filtrados) {
    if (!p.created_at) continue;
    const label = `${p.created_at.slice(5, 7)}/${p.created_at.slice(0, 4)}`;
    if (porMesAcc.has(label)) {
      porMesAcc.set(label, (porMesAcc.get(label) ?? 0) + 1);
    }
  }
  const porMes = seis.map((m) => ({
    mes: m.label,
    novos: porMesAcc.get(m.label) ?? 0,
  }));

  const generoLabel: Record<Genero, string> = {
    masculino: 'Masculino',
    feminino: 'Feminino',
    prefiro_nao_informar: 'Nao informado',
  };
  const generoMap = new Map<string, number>();
  for (const p of filtrados) {
    const g = generoLabel[p.genero] ?? 'Nao informado';
    generoMap.set(g, (generoMap.get(g) ?? 0) + 1);
  }
  const porGenero = Array.from(generoMap.entries())
    .map(([genero, total]) => ({ genero, total }))
    .sort((a, b) => b.total - a.total);

  const topAcc: { id: string; nome: string; total: number; ultima: string | null }[] =
    [];
  for (const p of filtrados) {
    const lista = agendamentosPorPac.get(p.id) ?? [];
    if (lista.length === 0) continue;
    const ultima = lista
      .map((a) => a.data_hora)
      .sort()
      .reverse()[0];
    topAcc.push({
      id: p.id,
      nome: p.nome,
      total: lista.length,
      ultima: ultima ?? null,
    });
  }
  topAcc.sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
  const topPacientes = topAcc.slice(0, 10).map((t) => ({
    id: t.id,
    nome: t.nome,
    totalConsultas: t.total,
    ultimaConsulta: t.ultima,
  }));

  // Origem dos pacientes
  const ORIGEM_LABEL_MAP: Record<string, string> = {
    instagram: 'Instagram',
    google: 'Google',
    indicacao: 'Indicacao',
    facebook: 'Facebook',
    site: 'Site',
    outros: 'Outros',
  };
  const origemMap = new Map<string, number>();
  for (const p of filtrados) {
    const key = p.origem ?? '__nao_informado__';
    origemMap.set(key, (origemMap.get(key) ?? 0) + 1);
  }
  const totalOrigem = filtrados.length;
  const porOrigem: OrigemPacienteRelatorio[] = Array.from(origemMap.entries())
    .map(([key, qtd]) => ({
      origem:
        key === '__nao_informado__'
          ? 'Nao informado'
          : (ORIGEM_LABEL_MAP[key] ?? key),
      quantidade: qtd,
      percentual:
        totalOrigem > 0
          ? Math.round((qtd / totalOrigem) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => b.quantidade - a.quantidade);

  const pacientesAlta = filtrados.filter(
    (p) => p.status_tratamento === 'alta',
  ).length;

  return {
    ok: true,
    data: {
      periodo: { dataInicio, dataFim },
      total,
      novosNoPeriodo,
      retornosNoPeriodo,
      taxaRetorno,
      pacientesAlta,
      porMes,
      porGenero,
      porOrigem,
      topPacientes,
    },
  };
}

// ============================================================
// AGENDAMENTOS
// ============================================================

export type AgendamentosFiltros = {
  dataInicio?: string;
  dataFim?: string;
  status?: StatusAgendamento | 'todos';
  procedimentoId?: string;
  profissionalId?: string | 'todos';
};

export type AgendamentosData = {
  periodo: { dataInicio: string; dataFim: string };
  total: number;
  concluidos: number;
  faltas: number;
  taxaPresenca: number;
  porDiaSemana: { dia: string; total: number }[];
  porProcedimento: { nome: string; total: number }[];
  porMes: { mes: string; total: number }[];
  horarioPico: string;
};

const STATUS_VALIDOS: StatusAgendamento[] = [
  'agendado',
  'confirmado',
  'em_atendimento',
  'concluido',
  'faltou',
  'cancelado',
];

export async function getRelatorioAgendamentos(
  filtros: AgendamentosFiltros = {},
): Promise<Result<AgendamentosData>> {
  const ctx = await obterTenant();
  if (!ctx.ok) return ctx;

  const padrao = defaultPeriodo();
  const dataInicio =
    filtros.dataInicio && isIsoDate(filtros.dataInicio)
      ? filtros.dataInicio
      : padrao.dataInicio;
  const dataFim =
    filtros.dataFim && isIsoDate(filtros.dataFim)
      ? filtros.dataFim
      : padrao.dataFim;
  if (dataFim < dataInicio) {
    return { ok: false, error: 'Data fim anterior a data inicio.' };
  }

  const admin = createAdminClient();
  const inicioTs = `${dataInicio}T00:00:00-03:00`;
  const fimTs = `${dataFim}T23:59:59-03:00`;

  let q = admin
    .from('agendamentos')
    .select('id, data_hora, status, procedimento_id, procedimentos(id, nome)')
    .eq('tenant_id', ctx.tenantId)
    .gte('data_hora', inicioTs)
    .lte('data_hora', fimTs);

  if (
    filtros.status &&
    filtros.status !== 'todos' &&
    STATUS_VALIDOS.includes(filtros.status as StatusAgendamento)
  ) {
    q = q.eq('status', filtros.status);
  }
  if (filtros.procedimentoId) {
    q = q.eq('procedimento_id', filtros.procedimentoId);
  }
  if (filtros.profissionalId && filtros.profissionalId !== 'todos') {
    q = q.eq('profissional_id', filtros.profissionalId);
  }

  const { data: rows, error } = await q;
  if (error) return { ok: false, error: error.message };

  type Row = {
    id: string;
    data_hora: string;
    status: StatusAgendamento;
    procedimento_id: string | null;
    procedimento_nome: string | null;
  };
  const ags: Row[] = (rows ?? []).map((r) => {
    const proc = Array.isArray(r.procedimentos)
      ? r.procedimentos[0]
      : r.procedimentos;
    return {
      id: r.id as string,
      data_hora: r.data_hora as string,
      status: r.status as StatusAgendamento,
      procedimento_id: (r.procedimento_id as string | null) ?? null,
      procedimento_nome: (proc?.nome as string | undefined) ?? null,
    };
  });

  const total = ags.length;
  const concluidos = ags.filter((a) => a.status === 'concluido').length;
  const faltas = ags.filter((a) => a.status === 'faltou').length;
  const cancelados = ags.filter((a) => a.status === 'cancelado').length;
  const baseSemCancelados = total - cancelados;
  const taxaPresenca =
    baseSemCancelados > 0 ? (concluidos / baseSemCancelados) * 100 : 0;

  const diasLabel = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  const diasOrdem = [1, 2, 3, 4, 5, 6, 0]; // seg-dom
  const porDiaAcc = new Array<number>(7).fill(0);
  const porHoraAcc = new Array<number>(24).fill(0);
  for (const a of ags) {
    if (!a.data_hora) continue;
    const parts = spParts(new Date(a.data_hora));
    porDiaAcc[parts.weekday]++;
    porHoraAcc[parts.hour]++;
  }
  const porDiaSemana = diasOrdem.map((idx) => ({
    dia: diasLabel[idx],
    total: porDiaAcc[idx],
  }));

  const procMap = new Map<string, number>();
  for (const a of ags) {
    const nome = a.procedimento_nome ?? 'Sem procedimento';
    procMap.set(nome, (procMap.get(nome) ?? 0) + 1);
  }
  const porProcedimento = Array.from(procMap.entries())
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Por mes (ultimos 6 meses)
  const seis = ultimos6Meses();
  const inicio6 = `${seis[0].ano}-${pad2(seis[0].mes)}-01T00:00:00-03:00`;
  const last = seis[seis.length - 1];
  const lastDate = new Date(last.ano, last.mes, 0);
  const fim6 = `${lastDate.getFullYear()}-${pad2(lastDate.getMonth() + 1)}-${pad2(lastDate.getDate())}T23:59:59-03:00`;

  let porMesQ = admin
    .from('agendamentos')
    .select('data_hora')
    .eq('tenant_id', ctx.tenantId)
    .gte('data_hora', inicio6)
    .lte('data_hora', fim6);
  if (filtros.profissionalId && filtros.profissionalId !== 'todos') {
    porMesQ = porMesQ.eq('profissional_id', filtros.profissionalId);
  }
  const { data: porMesRows, error: errMes } = await porMesQ;
  if (errMes) return { ok: false, error: errMes.message };

  const porMesAcc = new Map<string, number>();
  for (const m of seis) porMesAcc.set(m.label, 0);
  for (const row of porMesRows ?? []) {
    const dh = row.data_hora as string;
    if (!dh) continue;
    const parts = spParts(new Date(dh));
    const label = `${pad2(parts.month)}/${parts.year}`;
    if (porMesAcc.has(label)) {
      porMesAcc.set(label, (porMesAcc.get(label) ?? 0) + 1);
    }
  }
  const porMes = seis.map((m) => ({
    mes: m.label,
    total: porMesAcc.get(m.label) ?? 0,
  }));

  let horaPico = -1;
  let maxHora = 0;
  for (let h = 0; h < 24; h++) {
    if (porHoraAcc[h] > maxHora) {
      maxHora = porHoraAcc[h];
      horaPico = h;
    }
  }
  const horarioPico =
    horaPico >= 0
      ? `${pad2(horaPico)}:00 - ${pad2((horaPico + 1) % 24)}:00`
      : '—';

  return {
    ok: true,
    data: {
      periodo: { dataInicio, dataFim },
      total,
      concluidos,
      faltas,
      taxaPresenca,
      porDiaSemana,
      porProcedimento,
      porMes,
      horarioPico,
    },
  };
}

// ============================================================
// LISTAR PROCEDIMENTOS PARA FILTRO
// ============================================================

export async function listarProcedimentosRelatorios(): Promise<
  Result<{ id: string; nome: string }[]>
> {
  const ctx = await obterTenant();
  if (!ctx.ok) return ctx;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('procedimentos')
    .select('id, nome')
    .eq('tenant_id', ctx.tenantId)
    .eq('ativo', true)
    .order('nome', { ascending: true });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    data: (data ?? []).map((r) => ({
      id: r.id as string,
      nome: r.nome as string,
    })),
  };
}
