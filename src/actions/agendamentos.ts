'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';

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

type GetAgendamentosResult =
  | { ok: true; agendamentos: AgendamentoDia[] }
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
    .select('id')
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

  return { ok: true, agendamentos };
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

  revalidatePath('/agenda');
  return { ok: true };
}
