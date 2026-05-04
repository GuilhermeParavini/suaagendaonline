'use server';

import { createAdminClient, createClient } from '@/lib/supabase/server';

export type Avaliacao = {
  id: string;
  tenant_id: string;
  agendamento_id: string;
  paciente_id: string | null;
  profissional_id: string | null;
  nota: number;
  gostou: string | null;
  melhorar: string | null;
  recomendaria: boolean | null;
  created_at: string;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ContextoAvaliacaoPublica = {
  agendamentoId: string;
  pacienteNome: string;
  profissionalNome: string;
  profissionalEspecialidade: string;
  logoUrl: string | null;
  jaAvaliou: boolean;
};

export async function getContextoAvaliacao(
  agendamentoId: string,
): Promise<{ ok: true; data: ContextoAvaliacaoPublica } | { ok: false; error: string }> {
  if (!agendamentoId || !UUID_REGEX.test(agendamentoId)) {
    return { ok: false, error: 'Agendamento invalido.' };
  }

  const admin = createAdminClient();
  const { data: ag, error: agErr } = await admin
    .from('agendamentos')
    .select(
      'id, status, paciente_id, profissional_id, pacientes(nome), profissionais(nome, especialidade, logo_url)',
    )
    .eq('id', agendamentoId)
    .maybeSingle();
  if (agErr) return { ok: false, error: agErr.message };
  if (!ag) return { ok: false, error: 'Agendamento nao encontrado.' };
  if (ag.status !== 'concluido') {
    return { ok: false, error: 'Agendamento nao concluido.' };
  }

  const paciente = Array.isArray(ag.pacientes) ? ag.pacientes[0] : ag.pacientes;
  const profissional = Array.isArray(ag.profissionais)
    ? ag.profissionais[0]
    : ag.profissionais;

  const { data: existente } = await admin
    .from('avaliacoes')
    .select('id')
    .eq('agendamento_id', agendamentoId)
    .maybeSingle();

  return {
    ok: true,
    data: {
      agendamentoId,
      pacienteNome: (paciente?.nome as string | null) ?? 'Paciente',
      profissionalNome: (profissional?.nome as string | null) ?? 'Profissional',
      profissionalEspecialidade:
        (profissional?.especialidade as string | null) ?? '',
      logoUrl: (profissional?.logo_url as string | null) ?? null,
      jaAvaliou: !!existente,
    },
  };
}

export type CriarAvaliacaoInput = {
  agendamentoId: string;
  nota: number;
  gostou?: string;
  melhorar?: string;
  recomendaria?: boolean | null;
};

export async function criarAvaliacao(
  input: CriarAvaliacaoInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!input.agendamentoId || !UUID_REGEX.test(input.agendamentoId)) {
    return { ok: false, error: 'Agendamento invalido.' };
  }
  if (!Number.isInteger(input.nota) || input.nota < 1 || input.nota > 5) {
    return { ok: false, error: 'Nota deve ser entre 1 e 5.' };
  }
  const gostou = (input.gostou ?? '').trim();
  const melhorar = (input.melhorar ?? '').trim();
  if (gostou.length > 500 || melhorar.length > 500) {
    return { ok: false, error: 'Comentario acima de 500 caracteres.' };
  }

  const admin = createAdminClient();

  const { data: ag, error: agErr } = await admin
    .from('agendamentos')
    .select('id, status, tenant_id, paciente_id, profissional_id')
    .eq('id', input.agendamentoId)
    .maybeSingle();
  if (agErr) return { ok: false, error: agErr.message };
  if (!ag) return { ok: false, error: 'Agendamento nao encontrado.' };
  if (ag.status !== 'concluido') {
    return { ok: false, error: 'Agendamento nao concluido.' };
  }

  const { data: existente } = await admin
    .from('avaliacoes')
    .select('id')
    .eq('agendamento_id', input.agendamentoId)
    .maybeSingle();
  if (existente) {
    return { ok: false, error: 'Voce ja avaliou esta consulta.' };
  }

  const { data: row, error: insErr } = await admin
    .from('avaliacoes')
    .insert({
      tenant_id: ag.tenant_id as string,
      agendamento_id: ag.id as string,
      paciente_id: ag.paciente_id as string,
      profissional_id: ag.profissional_id as string,
      nota: input.nota,
      gostou: gostou || null,
      melhorar: melhorar || null,
      recomendaria:
        typeof input.recomendaria === 'boolean' ? input.recomendaria : null,
    })
    .select('id')
    .single();
  if (insErr || !row) {
    return { ok: false, error: insErr?.message ?? 'Falha ao registrar.' };
  }

  return { ok: true, id: row.id as string };
}

export type ResumoAvaliacoes = {
  media: number;
  total: number;
  recentes: Array<{
    id: string;
    nota: number;
    paciente_nome: string;
    created_at: string;
  }>;
};

export async function getResumoAvaliacoes(): Promise<Result<ResumoAvaliacoes>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessao expirada.' };

  const admin = createAdminClient();
  const { data: prof } = await admin
    .from('profissionais')
    .select('id, tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };

  const { data: rows, error } = await admin
    .from('avaliacoes')
    .select('id, nota, created_at, paciente_id, pacientes(nome)')
    .eq('profissional_id', prof.id as string)
    .order('created_at', { ascending: false });
  if (error) return { ok: false, error: error.message };

  const lista = rows ?? [];
  const total = lista.length;
  const media =
    total > 0
      ? lista.reduce((acc, r) => acc + ((r.nota as number) ?? 0), 0) / total
      : 0;

  const recentes = lista.slice(0, 3).map((r) => {
    const pac = Array.isArray(r.pacientes) ? r.pacientes[0] : r.pacientes;
    return {
      id: r.id as string,
      nota: r.nota as number,
      paciente_nome: (pac?.nome as string | null) ?? 'Paciente',
      created_at: r.created_at as string,
    };
  });

  return {
    ok: true,
    data: {
      media,
      total,
      recentes,
    },
  };
}

export async function atualizarEnviarAvaliacao(
  enviar: boolean,
): Promise<Result<null>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessao expirada.' };

  const admin = createAdminClient();
  const { error } = await admin
    .from('profissionais')
    .update({ enviar_avaliacao: !!enviar })
    .eq('user_id', user.id);
  if (error) return { ok: false, error: error.message };

  return { ok: true, data: null };
}
