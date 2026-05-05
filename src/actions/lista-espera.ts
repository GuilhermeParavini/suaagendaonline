'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient, createClient } from '@/lib/supabase/server';

export type TurnoPreferencia = 'manha' | 'tarde' | 'qualquer';
export type StatusListaEspera = 'aguardando' | 'agendado' | 'cancelado';

export type ItemListaEspera = {
  id: string;
  tenant_id: string;
  profissional_id: string;
  profissional_nome: string | null;
  paciente: {
    id: string;
    nome: string;
    telefone: string;
    email: string | null;
  };
  procedimento: { id: string; nome: string } | null;
  data_preferencia: string | null;
  turno_preferencia: TurnoPreferencia | null;
  observacoes: string | null;
  status: StatusListaEspera;
  created_at: string;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const TURNOS_VALIDOS: TurnoPreferencia[] = ['manha', 'tarde', 'qualquer'];

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
  const { data, error } = await admin
    .from('profissionais')
    .select('id, tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Profissional nao encontrado.' };
  return {
    ok: true,
    tenantId: data.tenant_id as string,
    profissionalId: data.id as string,
  };
}

export type AdicionarListaEsperaInput = {
  pacienteId: string;
  profissionalId: string;
  procedimentoId?: string | null;
  dataPreferencia?: string | null;
  turnoPreferencia?: TurnoPreferencia | null;
  observacoes?: string | null;
};

export async function adicionarListaEspera(
  input: AdicionarListaEsperaInput,
): Promise<Result<{ id: string }>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();

  if (!input.pacienteId || !input.profissionalId) {
    return { ok: false, error: 'Dados invalidos.' };
  }
  // Verifica que o profissional pertence ao tenant
  const { data: prof } = await admin
    .from('profissionais')
    .select('id, tenant_id')
    .eq('id', input.profissionalId)
    .maybeSingle();
  if (!prof || (prof.tenant_id as string) !== ctx.tenantId) {
    return { ok: false, error: 'Profissional invalido.' };
  }

  // Verifica duplicata aguardando
  const { data: jaExiste } = await admin
    .from('lista_espera')
    .select('id')
    .eq('tenant_id', ctx.tenantId)
    .eq('profissional_id', input.profissionalId)
    .eq('paciente_id', input.pacienteId)
    .eq('status', 'aguardando')
    .maybeSingle();
  if (jaExiste) {
    return {
      ok: false,
      error: 'Este paciente ja esta na lista de espera para este profissional.',
    };
  }

  const turno =
    input.turnoPreferencia && TURNOS_VALIDOS.includes(input.turnoPreferencia)
      ? input.turnoPreferencia
      : null;

  const { data: row, error } = await admin
    .from('lista_espera')
    .insert({
      tenant_id: ctx.tenantId,
      profissional_id: input.profissionalId,
      paciente_id: input.pacienteId,
      procedimento_id: input.procedimentoId ?? null,
      data_preferencia: input.dataPreferencia ?? null,
      turno_preferencia: turno,
      observacoes: input.observacoes?.trim() || null,
      status: 'aguardando',
    })
    .select('id')
    .single();
  if (error || !row) {
    return { ok: false, error: error?.message ?? 'Falha ao adicionar.' };
  }

  revalidatePath('/lista-espera');
  revalidatePath('/');
  return { ok: true, data: { id: row.id as string } };
}

export type ListaEsperaFiltros = {
  status?: StatusListaEspera | 'todos';
  profissionalId?: string | 'todos';
};

export async function getListaEspera(
  filtros: ListaEsperaFiltros = {},
): Promise<Result<ItemListaEspera[]>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;
  const admin = createAdminClient();
  let q = admin
    .from('lista_espera')
    .select(
      'id, tenant_id, profissional_id, paciente_id, procedimento_id, data_preferencia, turno_preferencia, observacoes, status, created_at, pacientes(id, nome, telefone, email), procedimentos(id, nome), profissionais(nome)',
    )
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: true });

  if (filtros.status && filtros.status !== 'todos') {
    q = q.eq('status', filtros.status);
  }
  if (filtros.profissionalId && filtros.profissionalId !== 'todos') {
    q = q.eq('profissional_id', filtros.profissionalId);
  }
  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };

  const lista: ItemListaEspera[] = (data ?? []).map((r) => {
    const pac = Array.isArray(r.pacientes) ? r.pacientes[0] : r.pacientes;
    const proc = Array.isArray(r.procedimentos)
      ? r.procedimentos[0]
      : r.procedimentos;
    const prof = Array.isArray(r.profissionais)
      ? r.profissionais[0]
      : r.profissionais;
    return {
      id: r.id as string,
      tenant_id: r.tenant_id as string,
      profissional_id: r.profissional_id as string,
      profissional_nome: (prof?.nome as string | null) ?? null,
      paciente: {
        id: (pac?.id as string) ?? (r.paciente_id as string),
        nome: (pac?.nome as string) ?? 'Paciente',
        telefone: (pac?.telefone as string) ?? '',
        email: (pac?.email as string | null) ?? null,
      },
      procedimento: proc
        ? { id: proc.id as string, nome: proc.nome as string }
        : null,
      data_preferencia: (r.data_preferencia as string | null) ?? null,
      turno_preferencia:
        (r.turno_preferencia as TurnoPreferencia | null) ?? null,
      observacoes: (r.observacoes as string | null) ?? null,
      status: r.status as StatusListaEspera,
      created_at: r.created_at as string,
    };
  });
  return { ok: true, data: lista };
}

export async function removerDaListaEspera(id: string): Promise<Result<null>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;
  const admin = createAdminClient();
  const { error } = await admin
    .from('lista_espera')
    .update({ status: 'cancelado' })
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/lista-espera');
  revalidatePath('/');
  return { ok: true, data: null };
}

export async function marcarComoAgendado(id: string): Promise<Result<null>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;
  const admin = createAdminClient();
  const { error } = await admin
    .from('lista_espera')
    .update({ status: 'agendado' })
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/lista-espera');
  revalidatePath('/');
  return { ok: true, data: null };
}

export async function getContagemListaEspera(): Promise<Result<number>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;
  const admin = createAdminClient();
  const { count, error } = await admin
    .from('lista_espera')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', ctx.tenantId)
    .eq('status', 'aguardando');
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: count ?? 0 };
}
