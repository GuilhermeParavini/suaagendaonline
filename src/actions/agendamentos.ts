'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  emailCancelamento,
  emailConfirmacaoAgendamento,
  emailReagendamento,
  emailSolicitarAvaliacao,
  horarioFromIso,
  dataIsoFromTimestamp,
  montarLinkAgendamento,
} from '@/lib/email-templates';
import { enviarNotificacaoEmail } from '@/lib/notificacoes';
import {
  getBloqueiosForProfissional,
  getFeriadosForTenant,
} from '@/lib/feriados-bloqueios';

export type StatusAgendamento =
  | 'agendado'
  | 'confirmado'
  | 'em_atendimento'
  | 'concluido'
  | 'faltou'
  | 'cancelado'
  | 'reagendado';

export type AgendamentoDia = {
  id: string;
  data_hora: string;
  duracao_min: number;
  status: StatusAgendamento;
  paciente: { id: string; nome: string } | null;
  procedimento: { id: string; nome: string } | null;
  reagendado_de: string | null;
};

export type IndisponivelDia =
  | { tipo: 'feriado'; nome: string }
  | {
      tipo: 'bloqueio';
      motivo: string | null;
      bloqueioTipo:
        | 'ferias'
        | 'folga'
        | 'congresso'
        | 'licenca'
        | 'feriado'
        | 'outro';
    };

type GetAgendamentosResult =
  | {
      ok: true;
      agendamentos: AgendamentoDia[];
      indisponivel: IndisponivelDia | null;
      datasIndisponiveisSemana: string[];
    }
  | { ok: false; error: string };

type AtualizarStatusResult = { ok: true } | { ok: false; error: string };

const TRANSICOES_VALIDAS: Record<StatusAgendamento, StatusAgendamento[]> = {
  agendado: ['confirmado', 'cancelado'],
  confirmado: ['em_atendimento', 'cancelado'],
  em_atendimento: ['concluido', 'faltou'],
  concluido: [],
  faltou: [],
  cancelado: [],
  reagendado: [],
};

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function somarDiasIso(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + dias);
  return date.toISOString().slice(0, 10);
}

function inicioSemanaIso(iso: string): string {
  // Semana iniciando na segunda-feira (igual CalendarioSemanal)
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay(); // 0=Dom..6=Sab
  const diff = (dow + 6) % 7; // dias desde segunda
  date.setUTCDate(date.getUTCDate() - diff);
  return date.toISOString().slice(0, 10);
}

export async function getAgendamentosDia(data: string): Promise<GetAgendamentosResult> {
  if (!isIsoDate(data)) {
    return { ok: false, error: 'Data invalida.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessao expirada.' };

  const admin = createAdminClient();

  const { data: prof, error: profError } = await admin
    .from('profissionais')
    .select('id, tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profError) return { ok: false, error: profError.message };
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };

  const inicio = `${data}T00:00:00.000Z`;
  const fim = `${data}T23:59:59.999Z`;

  const { data: rows, error } = await admin
    .from('agendamentos')
    .select(
      'id, data_hora, duracao_min, status, reagendado_de, pacientes(id, nome), procedimentos(id, nome)',
    )
    .eq('profissional_id', prof.id)
    .gte('data_hora', inicio)
    .lte('data_hora', fim)
    .order('data_hora', { ascending: true });

  if (error) return { ok: false, error: error.message };

  const agendamentos: AgendamentoDia[] = (rows ?? []).map((r) => {
    const paciente = Array.isArray(r.pacientes) ? r.pacientes[0] : r.pacientes;
    const procedimento = Array.isArray(r.procedimentos) ? r.procedimentos[0] : r.procedimentos;
    return {
      id: r.id as string,
      data_hora: r.data_hora as string,
      duracao_min: r.duracao_min as number,
      status: r.status as AgendamentoDia['status'],
      paciente: paciente ? { id: paciente.id as string, nome: paciente.nome as string } : null,
      procedimento: procedimento
        ? { id: procedimento.id as string, nome: procedimento.nome as string }
        : null,
      reagendado_de: (r.reagendado_de as string | null) ?? null,
    };
  });

  let indisponivel: IndisponivelDia | null = null;
  let datasIndisponiveisSemana: string[] = [];
  try {
    const semanaInicio = inicioSemanaIso(data);
    const semanaFim = somarDiasIso(semanaInicio, 6);

    const [feriadosSemana, bloqueiosSemana] = await Promise.all([
      getFeriadosForTenant(prof.tenant_id as string, semanaInicio, semanaFim),
      getBloqueiosForProfissional(prof.id as string, semanaInicio, semanaFim),
    ]);

    const setIndisp = new Set<string>();
    for (const f of feriadosSemana) {
      setIndisp.add(f.data);
      if (f.data === data) {
        indisponivel = { tipo: 'feriado', nome: f.nome };
      }
    }
    for (const b of bloqueiosSemana) {
      const bi = b.data_inicio < semanaInicio ? semanaInicio : b.data_inicio;
      const bf = b.data_fim > semanaFim ? semanaFim : b.data_fim;
      let cur = bi;
      while (cur <= bf) {
        setIndisp.add(cur);
        cur = somarDiasIso(cur, 1);
      }
      if (b.data_inicio <= data && b.data_fim >= data && !indisponivel) {
        indisponivel = {
          tipo: 'bloqueio',
          motivo: b.motivo,
          bloqueioTipo: b.tipo,
        };
      }
    }
    datasIndisponiveisSemana = Array.from(setIndisp).sort();
  } catch (e) {
    console.error('[agendamentos] erro ao carregar feriados/bloqueios:', e);
  }

  return { ok: true, agendamentos, indisponivel, datasIndisponiveisSemana };
}

export async function atualizarStatusAgendamento(
  id: string,
  novoStatus: StatusAgendamento,
  motivo?: string,
): Promise<AtualizarStatusResult> {
  if (!id || typeof id !== 'string') {
    return { ok: false, error: 'Agendamento invalido.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessao expirada.' };

  const admin = createAdminClient();

  const { data: prof, error: profError } = await admin
    .from('profissionais')
    .select('id, tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profError) return { ok: false, error: profError.message };
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };

  const { data: agendamento, error: getError } = await admin
    .from('agendamentos')
    .select('id, status, profissional_id, tenant_id')
    .eq('id', id)
    .maybeSingle();
  if (getError) return { ok: false, error: getError.message };
  if (!agendamento) return { ok: false, error: 'Agendamento nao encontrado.' };
  if (agendamento.tenant_id !== prof.tenant_id) {
    return { ok: false, error: 'Sem permissao para este agendamento.' };
  }

  const statusAtual = agendamento.status as StatusAgendamento;
  const permitidas = TRANSICOES_VALIDAS[statusAtual] ?? [];
  if (!permitidas.includes(novoStatus)) {
    return { ok: false, error: 'Transicao de status invalida.' };
  }

  const update: Record<string, unknown> = { status: novoStatus };
  if (novoStatus === 'cancelado') {
    update.cancelado_por = 'profissional';
    update.motivo_cancelamento = motivo?.trim() ? motivo.trim() : null;
  }

  const { error: updateError } = await admin
    .from('agendamentos')
    .update(update)
    .eq('id', id);
  if (updateError) return { ok: false, error: updateError.message };

  // Email automatico de solicitacao de avaliacao quando concluir
  if (novoStatus === 'concluido') {
    try {
      const { data: ag } = await admin
        .from('agendamentos')
        .select('id, paciente_id, profissional_id, tenant_id')
        .eq('id', id)
        .maybeSingle();
      if (ag) {
        const [{ data: paciente }, { data: profissional }] = await Promise.all([
          admin
            .from('pacientes')
            .select('nome, email')
            .eq('id', ag.paciente_id as string)
            .maybeSingle(),
          admin
            .from('profissionais')
            .select('nome, logo_url, enviar_avaliacao')
            .eq('id', ag.profissional_id as string)
            .maybeSingle(),
        ]);

        const enviarAvaliacao =
          (profissional?.enviar_avaliacao as boolean | null) === false
            ? false
            : true;
        const destino = (paciente?.email as string | null) ?? null;

        if (enviarAvaliacao && destino) {
          const baseUrl =
            process.env.NEXT_PUBLIC_APP_URL ??
            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
          const linkAvaliacao = baseUrl
            ? `${baseUrl.replace(/\/+$/, '')}/avaliacao/${id}`
            : `/avaliacao/${id}`;

          const tpl = emailSolicitarAvaliacao({
            pacienteNome: (paciente?.nome as string) ?? 'Paciente',
            profissionalNome:
              (profissional?.nome as string) ?? 'Profissional',
            linkAvaliacao,
            logoUrl: (profissional?.logo_url as string | null) ?? null,
          });
          await enviarNotificacaoEmail({
            tenantId: ag.tenant_id as string,
            agendamentoId: id,
            tipo: 'feedback',
            destino,
            assunto: tpl.assunto,
            html: tpl.html,
          });
        }
      }
    } catch (e) {
      console.error('[agendamentos] erro ao enviar email de avaliacao:', e);
    }
  }

  if (novoStatus === 'cancelado') {
    try {
      const { data: ag } = await admin
        .from('agendamentos')
        .select('id, data_hora, paciente_id, profissional_id, tenant_id')
        .eq('id', id)
        .maybeSingle();
      if (ag) {
        const [{ data: paciente }, { data: profissional }, { data: tenant }] =
          await Promise.all([
            admin
              .from('pacientes')
              .select('nome, email')
              .eq('id', ag.paciente_id as string)
              .maybeSingle(),
            admin
              .from('profissionais')
              .select('nome, logo_url')
              .eq('id', ag.profissional_id as string)
              .maybeSingle(),
            admin
              .from('tenants')
              .select('slug')
              .eq('id', ag.tenant_id as string)
              .maybeSingle(),
          ]);

        const destino = (paciente?.email as string | null) ?? null;
        if (destino) {
          const slug = (tenant?.slug as string | null) ?? null;
          const baseUrl =
            process.env.NEXT_PUBLIC_APP_URL ??
            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
          const linkAgendamento = montarLinkAgendamento(baseUrl, slug);

          const dataHoraIso = ag.data_hora as string;
          const tpl = emailCancelamento({
            pacienteNome: (paciente?.nome as string) ?? 'Paciente',
            profissionalNome:
              (profissional?.nome as string) ?? 'Profissional',
            dataIso: dataIsoFromTimestamp(dataHoraIso),
            horario: horarioFromIso(dataHoraIso),
            linkAgendamento,
            logoUrl: (profissional?.logo_url as string | null) ?? null,
          });
          await enviarNotificacaoEmail({
            tenantId: ag.tenant_id as string,
            agendamentoId: id,
            tipo: 'cancelamento',
            destino,
            assunto: tpl.assunto,
            html: tpl.html,
          });
        }
      }
    } catch (e) {
      console.error('[agendamentos] Erro ao enviar email de cancelamento:', e);
    }
  }

  revalidatePath('/agenda');
  return { ok: true };
}

// ============================================================
// Agendamento manual pelo painel (Novo agendamento via FAB)
// ============================================================

export type PacienteOpcao = {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
};

export type ProcedimentoOpcao = {
  id: string;
  nome: string;
  duracao_min: number;
};

export type SlotPainel = { time: string; available: boolean };

export async function getDatasIndisponiveisPainel(
  dataInicio: string,
  dataFim: string,
): Promise<{ ok: true; datas: string[] } | { ok: false; error: string }> {
  if (!isIsoDate(dataInicio) || !isIsoDate(dataFim)) {
    return { ok: false, error: 'Periodo invalido.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessao expirada.' };

  const admin = createAdminClient();
  const { data: prof, error: profErr } = await admin
    .from('profissionais')
    .select('id, tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profErr) return { ok: false, error: profErr.message };
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };

  try {
    const [feriados, bloqueios] = await Promise.all([
      getFeriadosForTenant(prof.tenant_id as string, dataInicio, dataFim),
      getBloqueiosForProfissional(prof.id as string, dataInicio, dataFim),
    ]);

    const datas = new Set<string>();
    for (const f of feriados) datas.add(f.data);
    for (const b of bloqueios) {
      const ini = b.data_inicio < dataInicio ? dataInicio : b.data_inicio;
      const fim = b.data_fim > dataFim ? dataFim : b.data_fim;
      let cur = ini;
      while (cur <= fim) {
        datas.add(cur);
        const [y, m, d] = cur.split('-').map(Number);
        const next = new Date(Date.UTC(y, m - 1, d));
        next.setUTCDate(next.getUTCDate() + 1);
        cur = next.toISOString().slice(0, 10);
      }
    }
    return { ok: true, datas: Array.from(datas).sort() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function buscarPacientesPainel(
  termo: string,
): Promise<{ ok: true; data: PacienteOpcao[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessao expirada.' };

  const admin = createAdminClient();
  const { data: prof, error: profErr } = await admin
    .from('profissionais')
    .select('tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profErr) return { ok: false, error: profErr.message };
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };

  const t = (termo ?? '').trim();
  if (t.length < 2) {
    return { ok: true, data: [] };
  }

  // PostgREST .or() nao aceita virgulas nem caracteres especiais sem escape;
  // dentro de or() ilike espera asterisco (*) como wildcard.
  const safe = t.replace(/[,()*]/g, ' ').trim();
  const digits = t.replace(/\D/g, '');

  let query = admin
    .from('pacientes')
    .select('id, nome, telefone, email')
    .eq('tenant_id', prof.tenant_id as string)
    .eq('ativo', true);

  if (digits.length >= 3) {
    // Busca por nome ou telefone (LGPD: nao buscamos por CPF)
    query = query.or(`nome.ilike.*${safe}*,telefone.ilike.*${digits}*`);
  } else {
    query = query.ilike('nome', `%${safe}%`);
  }

  const { data, error } = await query
    .order('nome', { ascending: true })
    .limit(10);
  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    data: (data ?? []).map((r) => ({
      id: r.id as string,
      nome: r.nome as string,
      telefone: (r.telefone as string) ?? '',
      email: (r.email as string | null) ?? null,
    })),
  };
}

export async function listarProcedimentosPainel(): Promise<
  { ok: true; data: ProcedimentoOpcao[] } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessao expirada.' };

  const admin = createAdminClient();
  const { data: prof, error: profErr } = await admin
    .from('profissionais')
    .select('id, tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profErr) return { ok: false, error: profErr.message };
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };

  const { data, error } = await admin
    .from('procedimentos')
    .select('id, nome, duracao_min')
    .eq('tenant_id', prof.tenant_id as string)
    .eq('ativo', true)
    .order('nome', { ascending: true });
  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    data: (data ?? []).map((r) => ({
      id: r.id as string,
      nome: r.nome as string,
      duracao_min: r.duracao_min as number,
    })),
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function buildIsoDateTime(dataIso: string, hora: string): string {
  const [y, m, d] = dataIso.split('-').map(Number);
  const [hh, mm] = hora.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm, 0, 0)).toISOString();
}

export async function getDisponibilidadePainel(
  dataIso: string,
  procedimentoId: string,
): Promise<
  | {
      ok: true;
      slots: SlotPainel[];
      duracaoMin: number;
      indisponivel?: { tipo: 'feriado' | 'bloqueio'; texto: string };
    }
  | { ok: false; error: string }
> {
  if (!isIsoDate(dataIso)) {
    return { ok: false, error: 'Data invalida.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessao expirada.' };

  const admin = createAdminClient();
  const { data: prof, error: profErr } = await admin
    .from('profissionais')
    .select('id, tenant_id, duracao_padrao_min')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profErr) return { ok: false, error: profErr.message };
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };

  const intervaloMin = (prof.duracao_padrao_min as number) ?? 30;

  const { data: proc, error: procErr } = await admin
    .from('procedimentos')
    .select('duracao_min, tenant_id, ativo')
    .eq('id', procedimentoId)
    .maybeSingle();
  if (procErr) return { ok: false, error: procErr.message };
  if (!proc || proc.tenant_id !== prof.tenant_id || !proc.ativo) {
    return { ok: false, error: 'Procedimento invalido.' };
  }
  const duracaoMin = (proc.duracao_min as number) ?? intervaloMin;

  // Bloqueia feriados — feriados sao estritos (erro fatal se a consulta falhar)
  let feriados: Awaited<ReturnType<typeof getFeriadosForTenant>> = [];
  try {
    feriados = await getFeriadosForTenant(
      prof.tenant_id as string,
      dataIso,
      dataIso,
    );
  } catch (e) {
    return {
      ok: false,
      error: `Falha ao verificar feriados: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  if (feriados.length > 0) {
    return {
      ok: true,
      slots: [],
      duracaoMin,
      indisponivel: {
        tipo: 'feriado',
        texto: `Feriado: ${feriados[0].nome}`,
      },
    };
  }

  // Bloqueios sao permissivos (se a tabela ainda nao existe, segue)
  try {
    const bloqueios = await getBloqueiosForProfissional(
      prof.id as string,
      dataIso,
      dataIso,
    );
    if (bloqueios.length > 0) {
      return {
        ok: true,
        slots: [],
        duracaoMin,
        indisponivel: {
          tipo: 'bloqueio',
          texto: bloqueios[0].motivo
            ? `Bloqueio: ${bloqueios[0].motivo}`
            : 'Dia bloqueado',
        },
      };
    }
  } catch (e) {
    console.error('[agendamentos] erro ao checar bloqueios:', e);
  }

  const [y, m, d] = dataIso.split('-').map(Number);
  const diaSemana = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

  const { data: horarios, error: horError } = await admin
    .from('horarios_disponiveis')
    .select('hora_inicio, hora_fim')
    .eq('profissional_id', prof.id as string)
    .eq('ativo', true)
    .eq('dia_semana', diaSemana);
  if (horError) return { ok: false, error: horError.message };
  if (!horarios || horarios.length === 0) {
    return { ok: true, slots: [], duracaoMin };
  }

  const inicio = `${dataIso}T00:00:00.000Z`;
  const fim = `${dataIso}T23:59:59.999Z`;
  const { data: existentes, error: agErr } = await admin
    .from('agendamentos')
    .select('data_hora, duracao_min, status')
    .eq('profissional_id', prof.id as string)
    .gte('data_hora', inicio)
    .lte('data_hora', fim)
    .neq('status', 'cancelado');
  if (agErr) return { ok: false, error: agErr.message };

  const ocupados = (existentes ?? []).map((row) => {
    const start = new Date(row.data_hora as string).getTime();
    const dur = (row.duracao_min as number) ?? intervaloMin;
    return { start, end: start + dur * 60_000 };
  });

  const agora = Date.now();
  const slots: SlotPainel[] = [];
  const seen = new Set<string>();

  for (const range of horarios) {
    const [hi, mi] = (range.hora_inicio as string).split(':').map(Number);
    const [hf, mf] = (range.hora_fim as string).split(':').map(Number);
    const startMin = hi * 60 + mi;
    const endMin = hf * 60 + mf;

    for (let cur = startMin; cur + duracaoMin <= endMin; cur += intervaloMin) {
      const h = Math.floor(cur / 60);
      const mm = cur % 60;
      const time = `${pad2(h)}:${pad2(mm)}`;
      if (seen.has(time)) continue;
      seen.add(time);

      const slotIso = buildIsoDateTime(dataIso, time);
      const slotStart = new Date(slotIso).getTime();
      const slotEnd = slotStart + duracaoMin * 60_000;
      const isPast = slotStart <= agora;
      const isOccupied = ocupados.some(
        (o) => slotStart < o.end && slotEnd > o.start,
      );
      slots.push({ time, available: !isPast && !isOccupied });
    }
  }

  slots.sort((a, b) => a.time.localeCompare(b.time));
  return { ok: true, slots, duracaoMin };
}

export type CriarAgendamentoPainelInput = {
  pacienteId: string;
  procedimentoId: string;
  dataIso: string;
  hora: string;
  observacoes?: string;
};

export async function criarAgendamentoPainel(
  input: CriarAgendamentoPainelInput,
): Promise<{ ok: true; agendamentoId: string } | { ok: false; error: string }> {
  if (!isIsoDate(input.dataIso)) {
    return { ok: false, error: 'Data invalida.' };
  }
  if (!/^\d{2}:\d{2}$/.test(input.hora)) {
    return { ok: false, error: 'Horario invalido.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessao expirada.' };

  const admin = createAdminClient();
  const { data: prof, error: profErr } = await admin
    .from('profissionais')
    .select('id, tenant_id, nome, tolerancia_atraso_min, logo_url')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profErr) return { ok: false, error: profErr.message };
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };

  const tenantId = prof.tenant_id as string;
  const profissionalId = prof.id as string;

  // Paciente
  const { data: pac, error: pacErr } = await admin
    .from('pacientes')
    .select('id, nome, email, tenant_id')
    .eq('id', input.pacienteId)
    .maybeSingle();
  if (pacErr) return { ok: false, error: pacErr.message };
  if (!pac || pac.tenant_id !== tenantId) {
    return { ok: false, error: 'Paciente nao encontrado.' };
  }

  // Procedimento
  const { data: proc, error: procErr } = await admin
    .from('procedimentos')
    .select('id, nome, duracao_min, tenant_id, ativo')
    .eq('id', input.procedimentoId)
    .maybeSingle();
  if (procErr) return { ok: false, error: procErr.message };
  if (!proc || proc.tenant_id !== tenantId || !proc.ativo) {
    return { ok: false, error: 'Procedimento indisponivel.' };
  }
  const duracaoMin = (proc.duracao_min as number) ?? 30;

  const dataHoraIso = buildIsoDateTime(input.dataIso, input.hora);
  const startMs = new Date(dataHoraIso).getTime();
  const endMs = startMs + duracaoMin * 60_000;

  if (startMs <= Date.now()) {
    return { ok: false, error: 'Horario ja passou. Escolha outro.' };
  }

  // Bloqueia feriados (estrito) e bloqueios (permissivo)
  let feriadosCheck: Awaited<ReturnType<typeof getFeriadosForTenant>> = [];
  try {
    feriadosCheck = await getFeriadosForTenant(
      tenantId,
      input.dataIso,
      input.dataIso,
    );
  } catch (e) {
    return {
      ok: false,
      error: `Falha ao verificar feriados: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  if (feriadosCheck.length > 0) {
    return {
      ok: false,
      error: `Data indisponivel (feriado: ${feriadosCheck[0].nome}).`,
    };
  }

  try {
    const bloqueios = await getBloqueiosForProfissional(
      profissionalId,
      input.dataIso,
      input.dataIso,
    );
    if (bloqueios.length > 0) {
      return { ok: false, error: 'Data indisponivel.' };
    }
  } catch (e) {
    console.error('[agendamentos] erro ao checar bloqueios:', e);
  }

  // Conflito
  const dayInicio = `${input.dataIso}T00:00:00.000Z`;
  const dayFim = `${input.dataIso}T23:59:59.999Z`;
  const { data: existentes, error: existErr } = await admin
    .from('agendamentos')
    .select('data_hora, duracao_min, status')
    .eq('profissional_id', profissionalId)
    .gte('data_hora', dayInicio)
    .lte('data_hora', dayFim)
    .neq('status', 'cancelado');
  if (existErr) return { ok: false, error: existErr.message };

  const conflito = (existentes ?? []).some((row) => {
    const s = new Date(row.data_hora as string).getTime();
    const dur = (row.duracao_min as number) ?? 30;
    return startMs < s + dur * 60_000 && endMs > s;
  });
  if (conflito) {
    return { ok: false, error: 'Horario indisponivel. Escolha outro.' };
  }

  const observacoes = input.observacoes?.trim() || null;

  const { data: agRow, error: agErr } = await admin
    .from('agendamentos')
    .insert({
      tenant_id: tenantId,
      profissional_id: profissionalId,
      paciente_id: pac.id as string,
      procedimento_id: proc.id as string,
      data_hora: dataHoraIso,
      duracao_min: duracaoMin,
      status: 'agendado',
      tolerancia_min: (prof.tolerancia_atraso_min as number) ?? 5,
      observacoes,
    })
    .select('id')
    .single();
  if (agErr || !agRow) {
    return { ok: false, error: agErr?.message ?? 'Falha ao criar agendamento.' };
  }

  const agendamentoId = agRow.id as string;

  // Email de confirmacao (best-effort)
  try {
    const destino = (pac.email as string | null) ?? null;
    if (destino) {
      const { data: tenant } = await admin
        .from('tenants')
        .select('slug')
        .eq('id', tenantId)
        .maybeSingle();
      const slug = (tenant?.slug as string | null) ?? null;
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ??
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
      const linkAgendamento = montarLinkAgendamento(baseUrl, slug);

      const tpl = emailConfirmacaoAgendamento({
        pacienteNome: (pac.nome as string) ?? 'Paciente',
        profissionalNome: (prof.nome as string) ?? 'Profissional',
        dataIso: input.dataIso,
        horario: horarioFromIso(dataHoraIso),
        linkAgendamento,
        logoUrl: (prof.logo_url as string | null) ?? null,
      });
      await enviarNotificacaoEmail({
        tenantId,
        agendamentoId,
        tipo: 'confirmacao',
        destino,
        assunto: tpl.assunto,
        html: tpl.html,
      });
    }
  } catch (e) {
    console.error('[agendamentos] erro ao enviar email confirmacao:', e);
  }

  revalidatePath('/agenda');
  revalidatePath('/');
  return { ok: true, agendamentoId };
}

// ============================================================
// Reagendamento de consulta
// ============================================================

// TODO sprint futura: permitir reagendamento pelo paciente via link publico
// (precisa de autenticacao/token do paciente).

export type ReagendarConsultaInput = {
  agendamentoId: string;
  novaDataIso: string;
  novaHora: string;
  novoProcedimentoId?: string;
  novaDuracaoMin?: number;
};

export type ReagendarConsultaResult =
  | { ok: true; novoAgendamentoId: string }
  | { ok: false; error: string };

export async function reagendarConsulta(
  input: ReagendarConsultaInput,
): Promise<ReagendarConsultaResult> {
  if (!input.agendamentoId) {
    return { ok: false, error: 'Agendamento invalido.' };
  }
  if (!isIsoDate(input.novaDataIso)) {
    return { ok: false, error: 'Data invalida.' };
  }
  if (!/^\d{2}:\d{2}$/.test(input.novaHora)) {
    return { ok: false, error: 'Horario invalido.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessao expirada.' };

  const admin = createAdminClient();
  const { data: prof, error: profErr } = await admin
    .from('profissionais')
    .select(
      'id, tenant_id, nome, especialidade, logo_url, tolerancia_atraso_min',
    )
    .eq('user_id', user.id)
    .maybeSingle();
  if (profErr) return { ok: false, error: profErr.message };
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };

  const tenantId = prof.tenant_id as string;
  const profissionalId = prof.id as string;

  const { data: antigo, error: getErr } = await admin
    .from('agendamentos')
    .select(
      'id, tenant_id, profissional_id, paciente_id, procedimento_id, data_hora, duracao_min, status, tolerancia_min, observacoes',
    )
    .eq('id', input.agendamentoId)
    .maybeSingle();
  if (getErr) return { ok: false, error: getErr.message };
  if (!antigo) return { ok: false, error: 'Agendamento nao encontrado.' };
  if (antigo.tenant_id !== tenantId) {
    return { ok: false, error: 'Sem permissao para este agendamento.' };
  }

  const statusAtual = antigo.status as StatusAgendamento;
  if (statusAtual !== 'agendado' && statusAtual !== 'confirmado') {
    return {
      ok: false,
      error: 'Só é possível reagendar consultas agendadas ou confirmadas.',
    };
  }

  // Procedimento (mantem o atual se nao informado)
  const procedimentoId =
    input.novoProcedimentoId?.trim() ||
    (antigo.procedimento_id as string | null) ||
    null;

  let duracaoMin = input.novaDuracaoMin;
  let procNome: string | null = null;
  if (procedimentoId) {
    const { data: proc, error: procErr } = await admin
      .from('procedimentos')
      .select('id, nome, duracao_min, tenant_id, ativo')
      .eq('id', procedimentoId)
      .maybeSingle();
    if (procErr) return { ok: false, error: procErr.message };
    if (!proc || proc.tenant_id !== tenantId) {
      return { ok: false, error: 'Procedimento invalido.' };
    }
    procNome = (proc.nome as string | null) ?? null;
    if (typeof duracaoMin !== 'number' || duracaoMin <= 0) {
      duracaoMin = (proc.duracao_min as number) ?? 30;
    }
  }
  if (typeof duracaoMin !== 'number' || duracaoMin <= 0) {
    duracaoMin = (antigo.duracao_min as number) ?? 30;
  }

  const novaDataHoraIso = buildIsoDateTime(input.novaDataIso, input.novaHora);
  const startMs = new Date(novaDataHoraIso).getTime();
  const endMs = startMs + duracaoMin * 60_000;

  if (startMs <= Date.now()) {
    return { ok: false, error: 'Horario ja passou. Escolha outro.' };
  }

  // Feriados (estrito)
  let feriadosCheck: Awaited<ReturnType<typeof getFeriadosForTenant>> = [];
  try {
    feriadosCheck = await getFeriadosForTenant(
      tenantId,
      input.novaDataIso,
      input.novaDataIso,
    );
  } catch (e) {
    return {
      ok: false,
      error: `Falha ao verificar feriados: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  if (feriadosCheck.length > 0) {
    return {
      ok: false,
      error: `Data indisponivel (feriado: ${feriadosCheck[0].nome}).`,
    };
  }

  // Bloqueios (permissivo se a tabela nao existir)
  try {
    const bloqueios = await getBloqueiosForProfissional(
      profissionalId,
      input.novaDataIso,
      input.novaDataIso,
    );
    if (bloqueios.length > 0) {
      return { ok: false, error: 'Data indisponivel.' };
    }
  } catch (e) {
    console.error('[agendamentos] erro ao checar bloqueios:', e);
  }

  // Conflito (ignora o agendamento antigo)
  const dayInicio = `${input.novaDataIso}T00:00:00.000Z`;
  const dayFim = `${input.novaDataIso}T23:59:59.999Z`;
  const { data: existentes, error: existErr } = await admin
    .from('agendamentos')
    .select('id, data_hora, duracao_min, status')
    .eq('profissional_id', profissionalId)
    .gte('data_hora', dayInicio)
    .lte('data_hora', dayFim)
    .neq('status', 'cancelado')
    .neq('status', 'reagendado');
  if (existErr) return { ok: false, error: existErr.message };

  const conflito = (existentes ?? [])
    .filter((row) => (row.id as string) !== (antigo.id as string))
    .some((row) => {
      const s = new Date(row.data_hora as string).getTime();
      const dur = (row.duracao_min as number) ?? 30;
      return startMs < s + dur * 60_000 && endMs > s;
    });
  if (conflito) {
    return { ok: false, error: 'Horario indisponivel. Escolha outro.' };
  }

  // 1. Marca antigo como 'reagendado'
  const { error: updErr } = await admin
    .from('agendamentos')
    .update({ status: 'reagendado' })
    .eq('id', antigo.id as string);
  if (updErr) return { ok: false, error: updErr.message };

  // 2. Insere novo agendamento
  const { data: novoRow, error: insErr } = await admin
    .from('agendamentos')
    .insert({
      tenant_id: tenantId,
      profissional_id: profissionalId,
      paciente_id: antigo.paciente_id as string,
      procedimento_id: procedimentoId,
      data_hora: novaDataHoraIso,
      duracao_min: duracaoMin,
      status: 'agendado',
      tolerancia_min:
        (antigo.tolerancia_min as number | null) ??
        (prof.tolerancia_atraso_min as number) ??
        5,
      observacoes: (antigo.observacoes as string | null) ?? null,
      reagendado_de: antigo.id as string,
    })
    .select('id')
    .single();
  if (insErr || !novoRow) {
    // Rollback do status do antigo se a insercao falhou
    await admin
      .from('agendamentos')
      .update({ status: statusAtual })
      .eq('id', antigo.id as string);
    return {
      ok: false,
      error: insErr?.message ?? 'Falha ao criar novo agendamento.',
    };
  }
  const novoId = novoRow.id as string;

  // Email de reagendamento (best-effort)
  try {
    const [{ data: paciente }, { data: tenant }] = await Promise.all([
      admin
        .from('pacientes')
        .select('nome, email')
        .eq('id', antigo.paciente_id as string)
        .maybeSingle(),
      admin
        .from('tenants')
        .select('slug')
        .eq('id', tenantId)
        .maybeSingle(),
    ]);
    const destino = (paciente?.email as string | null) ?? null;
    if (destino) {
      const slug = (tenant?.slug as string | null) ?? null;
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ??
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
      const linkAgendamento = montarLinkAgendamento(baseUrl, slug);

      // Se procNome ainda eh null (procedimento nao foi recarregado), busca pelo id atual
      let procedimentoNomeFinal = procNome;
      if (!procedimentoNomeFinal && procedimentoId) {
        const { data: procFinal } = await admin
          .from('procedimentos')
          .select('nome')
          .eq('id', procedimentoId)
          .maybeSingle();
        procedimentoNomeFinal = (procFinal?.nome as string | null) ?? null;
      }

      const dataAnteriorIso = antigo.data_hora as string;
      const tpl = emailReagendamento({
        pacienteNome: (paciente?.nome as string) ?? 'Paciente',
        profissionalNome: (prof.nome as string) ?? 'Profissional',
        profissionalEspecialidade:
          (prof.especialidade as string | null) ?? null,
        procedimentoNome: procedimentoNomeFinal,
        dataAnteriorIso: dataIsoFromTimestamp(dataAnteriorIso),
        horarioAnterior: horarioFromIso(dataAnteriorIso),
        dataNovaIso: input.novaDataIso,
        horarioNovo: horarioFromIso(novaDataHoraIso),
        linkAgendamento,
        logoUrl: (prof.logo_url as string | null) ?? null,
      });
      await enviarNotificacaoEmail({
        tenantId,
        agendamentoId: novoId,
        tipo: 'reagendamento',
        destino,
        assunto: tpl.assunto,
        html: tpl.html,
      });
    }
  } catch (e) {
    console.error('[agendamentos] erro ao enviar email de reagendamento:', e);
  }

  revalidatePath('/agenda');
  revalidatePath('/');
  return { ok: true, novoAgendamentoId: novoId };
}
