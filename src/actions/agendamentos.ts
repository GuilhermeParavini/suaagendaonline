'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  emailCancelamento,
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
  | 'cancelado';

export type AgendamentoDia = {
  id: string;
  data_hora: string;
  duracao_min: number;
  status: StatusAgendamento;
  paciente: { id: string; nome: string } | null;
  procedimento: { id: string; nome: string } | null;
};

export type IndisponivelDia =
  | { tipo: 'feriado'; nome: string }
  | { tipo: 'bloqueio'; motivo: string | null };

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
      'id, data_hora, duracao_min, status, pacientes(id, nome), procedimentos(id, nome)',
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
        indisponivel = { tipo: 'bloqueio', motivo: b.motivo };
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
              .select('nome')
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
