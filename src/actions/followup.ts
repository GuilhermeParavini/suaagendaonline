'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient, createClient } from '@/lib/supabase/server';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export type AtualizarFollowupInput = {
  enviar_followup?: boolean;
  mostrar_acompanhamento?: boolean;
  followup_mensagem?: string;
};

export async function atualizarPreferenciasFollowup(
  input: AtualizarFollowupInput,
): Promise<Result<null>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessao expirada.' };

  const update: Record<string, unknown> = {};
  if (typeof input.enviar_followup === 'boolean') {
    update.enviar_followup = input.enviar_followup;
  }
  if (typeof input.mostrar_acompanhamento === 'boolean') {
    update.mostrar_acompanhamento = input.mostrar_acompanhamento;
  }
  if (typeof input.followup_mensagem === 'string') {
    const msg = input.followup_mensagem.trim();
    if (msg.length > 500) {
      return { ok: false, error: 'Mensagem acima de 500 caracteres.' };
    }
    update.followup_mensagem = msg || null;
  }

  if (Object.keys(update).length === 0) {
    return { ok: true, data: null };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('profissionais')
    .update(update)
    .eq('user_id', user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/configuracoes');
  revalidatePath('/');
  return { ok: true, data: null };
}

export type PacienteAcompanhamento = {
  agendamentoId: string;
  pacienteId: string;
  nome: string;
  telefone: string | null;
  procedimentoNome: string | null;
};

function ontemRangeIso(): { inicio: string; fim: string } {
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setUTCDate(ontem.getUTCDate() - 1);
  const yyyy = ontem.getUTCFullYear();
  const mm = String(ontem.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(ontem.getUTCDate()).padStart(2, '0');
  const data = `${yyyy}-${mm}-${dd}`;
  return {
    inicio: `${data}T00:00:00.000Z`,
    fim: `${data}T23:59:59.999Z`,
  };
}

export async function getPacientesParaAcompanhar(): Promise<
  Result<PacienteAcompanhamento[]>
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessao expirada.' };

  const admin = createAdminClient();
  const { data: prof } = await admin
    .from('profissionais')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };

  const { inicio, fim } = ontemRangeIso();
  const { data: ags, error } = await admin
    .from('agendamentos')
    .select(
      'id, paciente_id, pacientes(nome, telefone), procedimentos(nome)',
    )
    .eq('profissional_id', prof.id as string)
    .eq('status', 'concluido')
    .gte('data_hora', inicio)
    .lte('data_hora', fim)
    .order('data_hora', { ascending: true });
  if (error) return { ok: false, error: error.message };

  const lista = ags ?? [];
  if (lista.length === 0) return { ok: true, data: [] };

  const ids = lista.map((a) => a.id as string);
  const { data: jaAcompanhados } = await admin
    .from('notificacoes')
    .select('agendamento_id')
    .in('agendamento_id', ids)
    .eq('tipo', 'followup_whatsapp');
  const jaSet = new Set(
    (jaAcompanhados ?? []).map((n) => n.agendamento_id as string),
  );

  const result: PacienteAcompanhamento[] = lista
    .filter((a) => !jaSet.has(a.id as string))
    .map((a) => {
      const pac = Array.isArray(a.pacientes) ? a.pacientes[0] : a.pacientes;
      const proc = Array.isArray(a.procedimentos)
        ? a.procedimentos[0]
        : a.procedimentos;
      return {
        agendamentoId: a.id as string,
        pacienteId: a.paciente_id as string,
        nome: (pac?.nome as string | null) ?? 'Paciente',
        telefone: (pac?.telefone as string | null) ?? null,
        procedimentoNome: (proc?.nome as string | null) ?? null,
      };
    });

  return { ok: true, data: result };
}

export async function marcarAcompanhado(
  agendamentoId: string,
): Promise<Result<null>> {
  if (!agendamentoId) {
    return { ok: false, error: 'Agendamento invalido.' };
  }

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

  const { data: ag } = await admin
    .from('agendamentos')
    .select('id, tenant_id, profissional_id, paciente_id, pacientes(telefone)')
    .eq('id', agendamentoId)
    .maybeSingle();
  if (!ag) return { ok: false, error: 'Agendamento nao encontrado.' };
  if (
    ag.tenant_id !== prof.tenant_id ||
    ag.profissional_id !== prof.id
  ) {
    return { ok: false, error: 'Sem permissao.' };
  }

  const pac = Array.isArray(ag.pacientes) ? ag.pacientes[0] : ag.pacientes;
  const destino = (pac?.telefone as string | null) ?? '';

  const { error: insErr } = await admin.from('notificacoes').insert({
    tenant_id: ag.tenant_id as string,
    agendamento_id: ag.id as string,
    tipo: 'followup_whatsapp',
    canal: 'sms',
    destino,
    assunto: 'Acompanhamento via WhatsApp',
    conteudo: 'Acompanhamento registrado via Dashboard.',
    status: 'enviado',
    enviado_em: new Date().toISOString(),
  });
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath('/');
  return { ok: true, data: null };
}
