'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { cleanCPF } from '@/lib/masks';
import { validateCPF } from '@/lib/validators';
import { enviarNotificacaoEmail } from '@/lib/notificacoes';
import { emailNovaListaEspera } from '@/lib/email-templates';
import { getTenantEmailSignature } from '@/lib/tenant-email-signature';

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

// ============================================================
// Publico: paciente entra na lista pelo agendamento online
// ============================================================

export type AdicionarListaEsperaPublicaInput = {
  slug: string;
  profissionalId: string;
  cpf: string;
  procedimentoId?: string | null;
  dataPreferencia?: string | null;
  turnoPreferencia?: TurnoPreferencia | null;
  observacoes?: string | null;
};

export type AdicionarListaEsperaPublicaResult =
  | { ok: true; id: string }
  | { ok: false; error: string; precisaCadastro?: boolean };

export async function adicionarListaEsperaPublica(
  input: AdicionarListaEsperaPublicaInput,
): Promise<AdicionarListaEsperaPublicaResult> {
  const slug = input.slug?.trim().toLowerCase() ?? '';
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return { ok: false, error: 'Link invalido.' };
  }
  const cpfDigits = cleanCPF(input.cpf ?? '');
  if (!validateCPF(cpfDigits)) {
    return { ok: false, error: 'CPF invalido.' };
  }

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (!tenant) return { ok: false, error: 'Profissional nao encontrado.' };
  const tenantId = tenant.id as string;

  // Profissional deve pertencer ao tenant e estar ativo
  const { data: prof } = await admin
    .from('profissionais')
    .select('id, nome, email, especialidade, logo_url')
    .eq('id', input.profissionalId)
    .eq('tenant_id', tenantId)
    .eq('ativo', true)
    .maybeSingle();
  if (!prof) {
    return { ok: false, error: 'Profissional invalido.' };
  }

  // Resolve paciente (precisa estar cadastrado)
  const { data: paciente } = await admin
    .from('pacientes')
    .select('id, nome')
    .eq('tenant_id', tenantId)
    .eq('cpf', cpfDigits)
    .maybeSingle();
  if (!paciente) {
    return {
      ok: false,
      error:
        'Não encontramos seu cadastro. Faça seu cadastro pelo link da clínica antes de entrar na lista de espera.',
      precisaCadastro: true,
    };
  }
  const pacienteId = paciente.id as string;

  // Verifica duplicata aguardando
  const { data: jaExiste } = await admin
    .from('lista_espera')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('profissional_id', input.profissionalId)
    .eq('paciente_id', pacienteId)
    .eq('status', 'aguardando')
    .maybeSingle();
  if (jaExiste) {
    return {
      ok: false,
      error: 'Você já está na lista de espera para este profissional.',
    };
  }

  const turno =
    input.turnoPreferencia && TURNOS_VALIDOS.includes(input.turnoPreferencia)
      ? input.turnoPreferencia
      : null;

  const { data: row, error } = await admin
    .from('lista_espera')
    .insert({
      tenant_id: tenantId,
      profissional_id: input.profissionalId,
      paciente_id: pacienteId,
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

  // Notifica profissional por email (best-effort)
  try {
    let procNome: string | null = null;
    if (input.procedimentoId) {
      const { data: proc } = await admin
        .from('procedimentos')
        .select('nome')
        .eq('id', input.procedimentoId)
        .maybeSingle();
      procNome = (proc?.nome as string | null) ?? null;
    }
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
    const linkLista = baseUrl
      ? `${baseUrl.replace(/\/+$/, '')}/lista-espera`
      : '/lista-espera';

    const assinatura = await getTenantEmailSignature(tenantId);
    const tpl = emailNovaListaEspera({
      profissionalNome: (prof.nome as string) ?? 'Profissional',
      pacienteNome: (paciente.nome as string) ?? 'Paciente',
      procedimentoNome: procNome,
      dataPreferencia: input.dataPreferencia ?? null,
      turnoPreferencia: turno,
      observacoes: input.observacoes ?? null,
      linkLista,
      logoUrl: (prof.logo_url as string | null) ?? null,
      assinatura,
    });
    await enviarNotificacaoEmail({
      tenantId,
      agendamentoId: null,
      tipo: 'lista_espera',
      destino: prof.email as string,
      assunto: tpl.assunto,
      html: tpl.html,
    });
  } catch (e) {
    console.error('[lista-espera] erro ao notificar profissional:', e);
  }

  return { ok: true, id: row.id as string };
}

// ============================================================
// Helper: pacientes na lista de espera para uma data/turno
// ============================================================

function turnoDeHora(hora: string): TurnoPreferencia {
  const [h] = hora.split(':').map(Number);
  if (Number.isFinite(h) && h < 12) return 'manha';
  return 'tarde';
}

export type SugestaoListaEspera = {
  id: string;
  pacienteNome: string;
  pacienteTelefone: string;
  procedimentoNome: string | null;
  observacoes: string | null;
};

export async function buscarSugestoesListaEspera(input: {
  profissionalId: string;
  dataIso: string;
  hora: string;
}): Promise<Result<SugestaoListaEspera[]>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;
  const turno = turnoDeHora(input.hora);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('lista_espera')
    .select(
      'id, observacoes, data_preferencia, turno_preferencia, pacientes(nome, telefone), procedimentos(nome)',
    )
    .eq('tenant_id', ctx.tenantId)
    .eq('profissional_id', input.profissionalId)
    .eq('status', 'aguardando')
    .order('created_at', { ascending: true });
  if (error) return { ok: false, error: error.message };

  const lista: SugestaoListaEspera[] = [];
  for (const r of data ?? []) {
    const dataPref = (r.data_preferencia as string | null) ?? null;
    const turnoPref =
      (r.turno_preferencia as TurnoPreferencia | null) ?? null;
    if (dataPref && dataPref !== input.dataIso) continue;
    if (
      turnoPref &&
      turnoPref !== 'qualquer' &&
      turnoPref !== turno
    )
      continue;
    const pac = Array.isArray(r.pacientes) ? r.pacientes[0] : r.pacientes;
    const proc = Array.isArray(r.procedimentos)
      ? r.procedimentos[0]
      : r.procedimentos;
    lista.push({
      id: r.id as string,
      pacienteNome: (pac?.nome as string) ?? 'Paciente',
      pacienteTelefone: (pac?.telefone as string) ?? '',
      procedimentoNome: (proc?.nome as string | null) ?? null,
      observacoes: (r.observacoes as string | null) ?? null,
    });
  }
  return { ok: true, data: lista };
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
