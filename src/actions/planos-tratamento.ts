'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import {
  getBloqueiosForProfissional,
  getFeriadosForTenant,
} from '@/lib/feriados-bloqueios';

export type TipoPlano = 'avulso' | 'mensal' | 'anual';
export type StatusPlano = 'ativo' | 'concluido' | 'cancelado' | 'pausado';
export type StatusSessao = 'pendente' | 'agendada' | 'realizada' | 'faltou' | 'cancelada';

export type PlanoTratamento = {
  id: string;
  tenant_id: string;
  profissional_id: string;
  paciente_id: string;
  procedimento_id: string | null;
  nome: string;
  tipo: TipoPlano;
  qtd_sessoes: number;
  sessoes_realizadas: number;
  periodicidade_dias: number | null;
  valor_por_sessao: number;
  valor_total: number;
  data_inicio: string;
  data_fim: string | null;
  status: StatusPlano;
  agendar_automatico: boolean;
  mensagem_automatica: boolean;
  mensagem_texto: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  nome_paciente?: string | null;
  nome_procedimento?: string | null;
};

export type SessaoPlano = {
  id: string;
  plano_id: string;
  agendamento_id: string | null;
  numero_sessao: number;
  data_prevista: string;
  status: StatusSessao;
  observacoes: string | null;
  created_at: string;
  agendamento?: {
    data_hora: string;
    status: string;
  } | null;
};

export type CriarPlanoInput = {
  pacienteId: string;
  nome: string;
  tipo: TipoPlano;
  qtdSessoes: number;
  periodicidadeDias?: number | null;
  valorPorSessao: number;
  procedimentoId?: string | null;
  agendarAutomatico: boolean;
  mensagemAutomatica: boolean;
  mensagemTexto?: string | null;
  observacoes?: string | null;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const TIPOS_VALIDOS: TipoPlano[] = ['avulso', 'mensal', 'anual'];
const STATUS_VALIDOS: StatusPlano[] = [
  'ativo',
  'concluido',
  'cancelado',
  'pausado',
];

async function obterContexto(): Promise<
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

function mapPlano(row: Record<string, unknown>): PlanoTratamento {
  const procRaw = row.procedimentos as
    | { nome: string }
    | { nome: string }[]
    | null
    | undefined;
  const procPick = Array.isArray(procRaw) ? procRaw[0] : procRaw;
  const pacRaw = row.pacientes as
    | { nome: string }
    | { nome: string }[]
    | null
    | undefined;
  const pacPick = Array.isArray(pacRaw) ? pacRaw[0] : pacRaw;
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    profissional_id: row.profissional_id as string,
    paciente_id: row.paciente_id as string,
    procedimento_id: (row.procedimento_id as string | null) ?? null,
    nome: row.nome as string,
    tipo: (row.tipo as TipoPlano) ?? 'avulso',
    qtd_sessoes: Number(row.qtd_sessoes) || 0,
    sessoes_realizadas: Number(row.sessoes_realizadas) || 0,
    periodicidade_dias:
      row.periodicidade_dias === null || row.periodicidade_dias === undefined
        ? null
        : Number(row.periodicidade_dias) || 0,
    valor_por_sessao: Number(row.valor_por_sessao) || 0,
    valor_total: Number(row.valor_total) || 0,
    data_inicio: row.data_inicio as string,
    data_fim: (row.data_fim as string | null) ?? null,
    status: (row.status as StatusPlano) ?? 'ativo',
    agendar_automatico: Boolean(row.agendar_automatico),
    mensagem_automatica: Boolean(row.mensagem_automatica),
    mensagem_texto: (row.mensagem_texto as string | null) ?? null,
    observacoes: (row.observacoes as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    nome_paciente: pacPick?.nome ?? null,
    nome_procedimento: procPick?.nome ?? null,
  };
}

function mapSessao(row: Record<string, unknown>): SessaoPlano {
  const agRaw = row.agendamentos as
    | { data_hora: string; status: string }
    | { data_hora: string; status: string }[]
    | null
    | undefined;
  const agPick = Array.isArray(agRaw) ? agRaw[0] : agRaw;
  return {
    id: row.id as string,
    plano_id: row.plano_id as string,
    agendamento_id: (row.agendamento_id as string | null) ?? null,
    numero_sessao: Number(row.numero_sessao) || 0,
    data_prevista: row.data_prevista as string,
    status: (row.status as StatusSessao) ?? 'pendente',
    observacoes: (row.observacoes as string | null) ?? null,
    created_at: row.created_at as string,
    agendamento: agPick
      ? {
          data_hora: agPick.data_hora,
          status: agPick.status,
        }
      : null,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function hojeIsoSP(): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const obj: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date())) obj[p.type] = p.value;
  return `${obj.year}-${obj.month}-${obj.day}`;
}

function somarDiasIso(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + dias);
  return date.toISOString().slice(0, 10);
}

function buildIsoDateTime(dataIso: string, hora: string): string {
  const [y, m, d] = dataIso.split('-').map(Number);
  const [hh, mm] = hora.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm, 0, 0)).toISOString();
}

// ============================================================
// a) criarPlano
// ============================================================
export async function criarPlano(
  input: CriarPlanoInput,
): Promise<
  Result<{ plano: PlanoTratamento; sessoes: SessaoPlano[] }>
> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const nome = input.nome?.trim() ?? '';
  if (nome.length < 2) return { ok: false, error: 'Nome do plano obrigatorio.' };
  if (!TIPOS_VALIDOS.includes(input.tipo)) {
    return { ok: false, error: 'Tipo de plano invalido.' };
  }
  const qtdSessoes = Math.round(Number(input.qtdSessoes));
  if (!Number.isFinite(qtdSessoes) || qtdSessoes < 1 || qtdSessoes > 365) {
    return { ok: false, error: 'Quantidade de sessoes invalida.' };
  }
  const valorPorSessao = Number(input.valorPorSessao);
  if (!Number.isFinite(valorPorSessao) || valorPorSessao < 0) {
    return { ok: false, error: 'Valor por sessao invalido.' };
  }
  const periodicidadeDias =
    input.periodicidadeDias === null || input.periodicidadeDias === undefined
      ? null
      : Math.max(1, Math.round(Number(input.periodicidadeDias)));
  if (
    (input.tipo === 'mensal' || input.tipo === 'anual') &&
    (periodicidadeDias === null || periodicidadeDias <= 0)
  ) {
    return {
      ok: false,
      error: 'Periodicidade obrigatoria para planos mensais e anuais.',
    };
  }

  const admin = createAdminClient();

  const { data: pac, error: pacErr } = await admin
    .from('pacientes')
    .select('id, tenant_id, nome, email')
    .eq('id', input.pacienteId)
    .maybeSingle();
  if (pacErr) return { ok: false, error: pacErr.message };
  if (!pac || pac.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Paciente nao encontrado.' };
  }

  let procedimentoId: string | null = null;
  let duracaoProcMin = 30;
  let nomeProcedimento: string | null = null;
  if (input.procedimentoId) {
    const { data: proc, error: procErr } = await admin
      .from('procedimentos')
      .select('id, nome, duracao_min, tenant_id, ativo')
      .eq('id', input.procedimentoId)
      .maybeSingle();
    if (procErr) return { ok: false, error: procErr.message };
    if (!proc || proc.tenant_id !== ctx.tenantId || !proc.ativo) {
      return { ok: false, error: 'Procedimento invalido.' };
    }
    procedimentoId = proc.id as string;
    duracaoProcMin = (proc.duracao_min as number) ?? 30;
    nomeProcedimento = (proc.nome as string) ?? null;
  }

  const dataInicio = hojeIsoSP();

  let dataFim: string | null = dataInicio;
  if (input.tipo === 'mensal' && periodicidadeDias) {
    dataFim = somarDiasIso(dataInicio, qtdSessoes * periodicidadeDias);
  } else if (input.tipo === 'anual') {
    dataFim = somarDiasIso(dataInicio, 365);
  }

  const valorTotal = Math.round(valorPorSessao * qtdSessoes * 100) / 100;

  const { data: planoRow, error: planoErr } = await admin
    .from('planos_tratamento')
    .insert({
      tenant_id: ctx.tenantId,
      profissional_id: ctx.profissionalId,
      paciente_id: input.pacienteId,
      procedimento_id: procedimentoId,
      nome,
      tipo: input.tipo,
      qtd_sessoes: qtdSessoes,
      sessoes_realizadas: 0,
      periodicidade_dias: periodicidadeDias,
      valor_por_sessao: valorPorSessao,
      valor_total: valorTotal,
      data_inicio: dataInicio,
      data_fim: dataFim,
      status: 'ativo',
      agendar_automatico: Boolean(input.agendarAutomatico),
      mensagem_automatica: Boolean(input.mensagemAutomatica),
      mensagem_texto: input.mensagemTexto?.trim() || null,
      observacoes: input.observacoes?.trim() || null,
    })
    .select('*')
    .single();
  if (planoErr || !planoRow) {
    return {
      ok: false,
      error: planoErr?.message ?? 'Falha ao criar plano.',
    };
  }
  const planoId = planoRow.id as string;

  // Inserir sessoes
  const sessoesPayload: Array<{
    plano_id: string;
    numero_sessao: number;
    data_prevista: string;
    status: StatusSessao;
  }> = [];
  for (let i = 1; i <= qtdSessoes; i++) {
    const dataPrevista = periodicidadeDias
      ? somarDiasIso(dataInicio, (i - 1) * periodicidadeDias)
      : dataInicio;
    sessoesPayload.push({
      plano_id: planoId,
      numero_sessao: i,
      data_prevista: dataPrevista,
      status: 'pendente',
    });
  }
  const { data: sessoesRows, error: sessErr } = await admin
    .from('sessoes_plano')
    .insert(sessoesPayload)
    .select('*');
  if (sessErr) {
    await admin.from('planos_tratamento').delete().eq('id', planoId);
    return { ok: false, error: sessErr.message };
  }

  const sessoesCriadas: SessaoPlano[] = (sessoesRows ?? [])
    .map((r) => mapSessao(r))
    .sort((a, b) => a.numero_sessao - b.numero_sessao);

  // Agendar automatico (best-effort por sessao)
  if (input.agendarAutomatico && procedimentoId) {
    const hojeRef = hojeIsoSP();
    for (const sessao of sessoesCriadas) {
      if (sessao.data_prevista < hojeRef) continue; // ignora passado
      const slot = await encontrarPrimeiroSlot(
        admin,
        ctx.tenantId,
        ctx.profissionalId,
        sessao.data_prevista,
        duracaoProcMin,
      );
      if (!slot) continue;

      const { data: agRow, error: agErr } = await admin
        .from('agendamentos')
        .insert({
          tenant_id: ctx.tenantId,
          profissional_id: ctx.profissionalId,
          paciente_id: input.pacienteId,
          procedimento_id: procedimentoId,
          data_hora: slot.iso,
          duracao_min: duracaoProcMin,
          status: 'agendado',
          tolerancia_min: 5,
        })
        .select('id')
        .single();
      if (agErr || !agRow) continue;

      await admin
        .from('sessoes_plano')
        .update({
          agendamento_id: agRow.id as string,
          status: 'agendada',
        })
        .eq('id', sessao.id);
      sessao.agendamento_id = agRow.id as string;
      sessao.status = 'agendada';
    }
  }

  revalidatePath(`/pacientes/${input.pacienteId}`);
  revalidatePath('/agenda');

  const planoFinal = mapPlano({
    ...(planoRow as Record<string, unknown>),
    pacientes: { nome: pac.nome as string },
    procedimentos: nomeProcedimento ? { nome: nomeProcedimento } : null,
  });

  return {
    ok: true,
    data: { plano: planoFinal, sessoes: sessoesCriadas },
  };
}

async function encontrarPrimeiroSlot(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  profissionalId: string,
  dataIso: string,
  duracaoMin: number,
): Promise<{ iso: string; hora: string } | null> {
  // Verifica feriado / bloqueio
  try {
    const feriados = await getFeriadosForTenant(tenantId, dataIso, dataIso);
    if (feriados.length > 0) return null;
  } catch {
    // permissivo
  }
  try {
    const bloqueios = await getBloqueiosForProfissional(
      profissionalId,
      dataIso,
      dataIso,
    );
    if (bloqueios.length > 0) return null;
  } catch {
    // permissivo
  }

  const { data: prof } = await admin
    .from('profissionais')
    .select('duracao_padrao_min, intervalo_entre_consultas_min')
    .eq('id', profissionalId)
    .maybeSingle();
  const duracaoPadraoMin = (prof?.duracao_padrao_min as number) ?? 30;
  const intervaloEntreMin =
    (prof?.intervalo_entre_consultas_min as number | null) ?? 0;

  const [y, m, d] = dataIso.split('-').map(Number);
  const diaSemana = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const { data: horarios } = await admin
    .from('horarios_disponiveis')
    .select('hora_inicio, hora_fim')
    .eq('profissional_id', profissionalId)
    .eq('ativo', true)
    .eq('dia_semana', diaSemana);
  if (!horarios || horarios.length === 0) return null;

  const inicioDia = `${dataIso}T00:00:00.000Z`;
  const fimDia = `${dataIso}T23:59:59.999Z`;
  const { data: existentes } = await admin
    .from('agendamentos')
    .select('data_hora, duracao_min, status')
    .eq('profissional_id', profissionalId)
    .gte('data_hora', inicioDia)
    .lte('data_hora', fimDia)
    .neq('status', 'cancelado');
  const ocupados = (existentes ?? []).map((row) => {
    const start = new Date(row.data_hora as string).getTime();
    const dur = (row.duracao_min as number) ?? duracaoPadraoMin;
    return { start, end: start + (dur + intervaloEntreMin) * 60_000 };
  });

  const passoMin = duracaoMin + intervaloEntreMin;
  const agora = Date.now();
  const seen = new Set<string>();

  type Cand = { iso: string; hora: string; start: number };
  const candidatos: Cand[] = [];

  for (const range of horarios) {
    const [hi, mi] = (range.hora_inicio as string).split(':').map(Number);
    const [hf, mf] = (range.hora_fim as string).split(':').map(Number);
    const startMin = hi * 60 + mi;
    const endMin = hf * 60 + mf;
    for (let cur = startMin; cur + duracaoMin <= endMin; cur += passoMin) {
      const h = Math.floor(cur / 60);
      const mm = cur % 60;
      const time = `${pad2(h)}:${pad2(mm)}`;
      if (seen.has(time)) continue;
      seen.add(time);
      const iso = buildIsoDateTime(dataIso, time);
      const start = new Date(iso).getTime();
      if (start <= agora) continue;
      const conflito = ocupados.some(
        (o) =>
          start < o.end &&
          start + (duracaoMin + intervaloEntreMin) * 60_000 > o.start,
      );
      if (conflito) continue;
      candidatos.push({ iso, hora: time, start });
    }
  }
  candidatos.sort((a, b) => a.start - b.start);
  return candidatos[0] ?? null;
}

// ============================================================
// b) getPlanosPaciente
// ============================================================
export async function getPlanosPaciente(
  pacienteId: string,
): Promise<Result<PlanoTratamento[]>> {
  if (!pacienteId) return { ok: false, error: 'Paciente invalido.' };
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('planos_tratamento')
    .select(
      'id, tenant_id, profissional_id, paciente_id, procedimento_id, nome, tipo, qtd_sessoes, sessoes_realizadas, periodicidade_dias, valor_por_sessao, valor_total, data_inicio, data_fim, status, agendar_automatico, mensagem_automatica, mensagem_texto, observacoes, created_at, updated_at, procedimentos(nome), pacientes(nome)',
    )
    .eq('paciente_id', pacienteId)
    .eq('tenant_id', ctx.tenantId)
    .order('status', { ascending: true })
    .order('data_inicio', { ascending: false });
  if (error) return { ok: false, error: error.message };

  const planos = (data ?? []).map((r) => mapPlano(r));
  // ativos primeiro (status === 'ativo'), depois demais
  planos.sort((a, b) => {
    const aAtivo = a.status === 'ativo' ? 0 : 1;
    const bAtivo = b.status === 'ativo' ? 0 : 1;
    if (aAtivo !== bAtivo) return aAtivo - bAtivo;
    return a.data_inicio < b.data_inicio ? 1 : -1;
  });
  return { ok: true, data: planos };
}

// ============================================================
// c) getPlano
// ============================================================
export async function getPlano(
  planoId: string,
): Promise<Result<PlanoTratamento>> {
  if (!planoId) return { ok: false, error: 'Plano invalido.' };
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('planos_tratamento')
    .select(
      'id, tenant_id, profissional_id, paciente_id, procedimento_id, nome, tipo, qtd_sessoes, sessoes_realizadas, periodicidade_dias, valor_por_sessao, valor_total, data_inicio, data_fim, status, agendar_automatico, mensagem_automatica, mensagem_texto, observacoes, created_at, updated_at, procedimentos(nome), pacientes(nome)',
    )
    .eq('id', planoId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Plano nao encontrado.' };
  if (data.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Sem permissao.' };
  }
  return { ok: true, data: mapPlano(data) };
}

// ============================================================
// d) getSessoesPlano
// ============================================================
export async function getSessoesPlano(
  planoId: string,
): Promise<Result<SessaoPlano[]>> {
  if (!planoId) return { ok: false, error: 'Plano invalido.' };
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  // Garantir ownership
  const { data: plano, error: planoErr } = await admin
    .from('planos_tratamento')
    .select('id, tenant_id')
    .eq('id', planoId)
    .maybeSingle();
  if (planoErr) return { ok: false, error: planoErr.message };
  if (!plano) return { ok: false, error: 'Plano nao encontrado.' };
  if (plano.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Sem permissao.' };
  }

  const { data, error } = await admin
    .from('sessoes_plano')
    .select(
      'id, plano_id, agendamento_id, numero_sessao, data_prevista, status, observacoes, created_at, agendamentos(data_hora, status)',
    )
    .eq('plano_id', planoId)
    .order('numero_sessao', { ascending: true });
  if (error) return { ok: false, error: error.message };

  return { ok: true, data: (data ?? []).map((r) => mapSessao(r)) };
}

// ============================================================
// e) atualizarPlano
// ============================================================
export type AtualizarPlanoInput = Partial<{
  status: StatusPlano;
  observacoes: string | null;
  mensagemAutomatica: boolean;
  mensagemTexto: string | null;
}>;

export async function atualizarPlano(
  planoId: string,
  dados: AtualizarPlanoInput,
): Promise<Result<null>> {
  if (!planoId) return { ok: false, error: 'Plano invalido.' };
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data: plano, error: planoErr } = await admin
    .from('planos_tratamento')
    .select('id, tenant_id, paciente_id, status')
    .eq('id', planoId)
    .maybeSingle();
  if (planoErr) return { ok: false, error: planoErr.message };
  if (!plano) return { ok: false, error: 'Plano nao encontrado.' };
  if (plano.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Sem permissao.' };
  }

  const update: Record<string, unknown> = {};
  if (dados.status !== undefined) {
    if (!STATUS_VALIDOS.includes(dados.status)) {
      return { ok: false, error: 'Status invalido.' };
    }
    update.status = dados.status;
  }
  if (dados.observacoes !== undefined) {
    update.observacoes = dados.observacoes?.trim() || null;
  }
  if (dados.mensagemAutomatica !== undefined) {
    update.mensagem_automatica = Boolean(dados.mensagemAutomatica);
  }
  if (dados.mensagemTexto !== undefined) {
    update.mensagem_texto = dados.mensagemTexto?.trim() || null;
  }

  if (Object.keys(update).length > 0) {
    update.updated_at = new Date().toISOString();
    const { error: updErr } = await admin
      .from('planos_tratamento')
      .update(update)
      .eq('id', planoId);
    if (updErr) return { ok: false, error: updErr.message };
  }

  // Cancelamento em cascata
  if (dados.status === 'cancelado') {
    const { data: sessoes } = await admin
      .from('sessoes_plano')
      .select('id, agendamento_id, status')
      .eq('plano_id', planoId)
      .in('status', ['pendente', 'agendada']);
    for (const s of sessoes ?? []) {
      await admin
        .from('sessoes_plano')
        .update({ status: 'cancelada' })
        .eq('id', s.id as string);
      const agId = s.agendamento_id as string | null;
      if (agId) {
        await admin
          .from('agendamentos')
          .update({
            status: 'cancelado',
            cancelado_por: 'profissional',
            motivo_cancelamento: 'Plano cancelado',
          })
          .eq('id', agId);
      }
    }
  }

  revalidatePath(`/pacientes/${plano.paciente_id}`);
  revalidatePath('/agenda');
  return { ok: true, data: null };
}

// ============================================================
// f) agendarSessao
// ============================================================
export async function agendarSessao(
  sessaoId: string,
  agendamentoId: string,
): Promise<Result<null>> {
  if (!sessaoId || !agendamentoId) {
    return { ok: false, error: 'Dados invalidos.' };
  }
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data: sessao, error: sessaoErr } = await admin
    .from('sessoes_plano')
    .select('id, plano_id, planos_tratamento(tenant_id)')
    .eq('id', sessaoId)
    .maybeSingle();
  if (sessaoErr) return { ok: false, error: sessaoErr.message };
  if (!sessao) return { ok: false, error: 'Sessao nao encontrada.' };
  const planoRaw = sessao.planos_tratamento as
    | { tenant_id: string }
    | { tenant_id: string }[]
    | null;
  const planoPick = Array.isArray(planoRaw) ? planoRaw[0] : planoRaw;
  if (!planoPick || planoPick.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Sem permissao.' };
  }

  // Valida agendamento
  const { data: ag } = await admin
    .from('agendamentos')
    .select('id, tenant_id')
    .eq('id', agendamentoId)
    .maybeSingle();
  if (!ag || ag.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Agendamento nao encontrado.' };
  }

  const { error: updErr } = await admin
    .from('sessoes_plano')
    .update({ agendamento_id: agendamentoId, status: 'agendada' })
    .eq('id', sessaoId);
  if (updErr) return { ok: false, error: updErr.message };

  return { ok: true, data: null };
}

// ============================================================
// g) marcarSessaoRealizada
// h) marcarSessaoFalta
// ============================================================
export type MarcarSessaoResult =
  | {
      ok: true;
      data: {
        sessaoAtualizada: boolean;
        planoAtualizado: boolean;
        planoConcluido: boolean;
      };
    }
  | { ok: false; error: string };

export async function marcarSessaoRealizada(
  agendamentoId: string,
): Promise<MarcarSessaoResult> {
  if (!agendamentoId) return { ok: false, error: 'Agendamento invalido.' };
  const admin = createAdminClient();
  const { data: sessao } = await admin
    .from('sessoes_plano')
    .select('id, plano_id, status')
    .eq('agendamento_id', agendamentoId)
    .maybeSingle();
  if (!sessao) {
    return {
      ok: true,
      data: {
        sessaoAtualizada: false,
        planoAtualizado: false,
        planoConcluido: false,
      },
    };
  }

  if ((sessao.status as StatusSessao) === 'realizada') {
    // Idempotente
    return {
      ok: true,
      data: {
        sessaoAtualizada: false,
        planoAtualizado: false,
        planoConcluido: false,
      },
    };
  }

  const { error: updSessErr } = await admin
    .from('sessoes_plano')
    .update({ status: 'realizada' })
    .eq('id', sessao.id as string);
  if (updSessErr) return { ok: false, error: updSessErr.message };

  const planoId = sessao.plano_id as string;
  const { data: plano } = await admin
    .from('planos_tratamento')
    .select('id, qtd_sessoes, sessoes_realizadas, status, paciente_id')
    .eq('id', planoId)
    .maybeSingle();
  if (!plano) {
    return {
      ok: true,
      data: {
        sessaoAtualizada: true,
        planoAtualizado: false,
        planoConcluido: false,
      },
    };
  }

  const novasRealizadas = (Number(plano.sessoes_realizadas) || 0) + 1;
  const qtdSessoes = Number(plano.qtd_sessoes) || 0;
  const concluido =
    qtdSessoes > 0 &&
    novasRealizadas >= qtdSessoes &&
    (plano.status as StatusPlano) === 'ativo';

  const planoUpdate: Record<string, unknown> = {
    sessoes_realizadas: novasRealizadas,
    updated_at: new Date().toISOString(),
  };
  if (concluido) planoUpdate.status = 'concluido';

  const { error: updPlanoErr } = await admin
    .from('planos_tratamento')
    .update(planoUpdate)
    .eq('id', planoId);
  if (updPlanoErr) return { ok: false, error: updPlanoErr.message };

  if (plano.paciente_id) {
    revalidatePath(`/pacientes/${plano.paciente_id as string}`);
  }

  return {
    ok: true,
    data: {
      sessaoAtualizada: true,
      planoAtualizado: true,
      planoConcluido: concluido,
    },
  };
}

export async function marcarSessaoFalta(
  agendamentoId: string,
): Promise<Result<{ sessaoAtualizada: boolean }>> {
  if (!agendamentoId) return { ok: false, error: 'Agendamento invalido.' };
  const admin = createAdminClient();
  const { data: sessao } = await admin
    .from('sessoes_plano')
    .select('id, status')
    .eq('agendamento_id', agendamentoId)
    .maybeSingle();
  if (!sessao) {
    return { ok: true, data: { sessaoAtualizada: false } };
  }
  if ((sessao.status as StatusSessao) === 'faltou') {
    return { ok: true, data: { sessaoAtualizada: false } };
  }
  const { error } = await admin
    .from('sessoes_plano')
    .update({ status: 'faltou' })
    .eq('id', sessao.id as string);
  if (error) return { ok: false, error: error.message };

  return { ok: true, data: { sessaoAtualizada: true } };
}
