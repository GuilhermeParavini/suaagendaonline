'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';

export type AgendamentoDia = {
  id: string;
  data_hora: string;
  duracao_min: number;
  status: 'agendado' | 'confirmado' | 'em_atendimento' | 'concluido' | 'faltou' | 'cancelado';
  paciente: { id: string; nome: string } | null;
  procedimento: { id: string; nome: string } | null;
};

type GetAgendamentosResult =
  | { ok: true; agendamentos: AgendamentoDia[] }
  | { ok: false; error: string };

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
