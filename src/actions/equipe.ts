'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getMaxProfissionais } from '@/lib/planos';

export type ProfissionalEquipe = {
  id: string;
  nome: string;
  email: string;
  especialidade: string;
  role: string;
  ativo: boolean;
  is_self: boolean;
};

export type ResumoEquipe = {
  ativos: number;
  pendentes: number;
  max: number;
  plano: string;
};

export type ProfissionalOpcaoTenant = {
  id: string;
  nome: string;
  especialidade: string;
  is_self: boolean;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function obterContextoAdmin(): Promise<
  | {
      ok: true;
      tenantId: string;
      profissionalId: string;
      role: string;
    }
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
    .select('id, tenant_id, role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Profissional nao encontrado.' };
  return {
    ok: true,
    tenantId: data.tenant_id as string,
    profissionalId: data.id as string,
    role: (data.role as string) ?? '',
  };
}

export async function listarEquipe(): Promise<Result<ProfissionalEquipe[]>> {
  const ctx = await obterContextoAdmin();
  if (!ctx.ok) return ctx;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('profissionais')
    .select('id, nome, email, especialidade, role, ativo')
    .eq('tenant_id', ctx.tenantId)
    .order('ativo', { ascending: false })
    .order('nome', { ascending: true });
  if (error) return { ok: false, error: error.message };

  const lista: ProfissionalEquipe[] = (data ?? []).map((r) => ({
    id: r.id as string,
    nome: r.nome as string,
    email: r.email as string,
    especialidade: r.especialidade as string,
    role: r.role as string,
    ativo: Boolean(r.ativo),
    is_self: (r.id as string) === ctx.profissionalId,
  }));
  return { ok: true, data: lista };
}

export async function getResumoEquipe(): Promise<Result<ResumoEquipe>> {
  const ctx = await obterContextoAdmin();
  if (!ctx.ok) return ctx;
  const admin = createAdminClient();

  const [{ data: tenant }, { count: ativos }, { count: pendentes }] =
    await Promise.all([
      admin
        .from('tenants')
        .select('plano')
        .eq('id', ctx.tenantId)
        .maybeSingle(),
      admin
        .from('profissionais')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', ctx.tenantId)
        .eq('ativo', true),
      admin
        .from('convites_profissional')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', ctx.tenantId)
        .eq('status', 'pendente'),
    ]);

  const plano = (tenant?.plano as string | null) ?? 'trial';
  return {
    ok: true,
    data: {
      ativos: ativos ?? 0,
      pendentes: pendentes ?? 0,
      max: getMaxProfissionais(plano),
      plano,
    },
  };
}

export async function listarProfissionaisAtivosTenant(): Promise<
  Result<ProfissionalOpcaoTenant[]>
> {
  const ctx = await obterContextoAdmin();
  if (!ctx.ok) return ctx;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('profissionais')
    .select('id, nome, especialidade')
    .eq('tenant_id', ctx.tenantId)
    .eq('ativo', true)
    .order('nome', { ascending: true });
  if (error) return { ok: false, error: error.message };
  const lista: ProfissionalOpcaoTenant[] = (data ?? []).map((r) => ({
    id: r.id as string,
    nome: r.nome as string,
    especialidade: r.especialidade as string,
    is_self: (r.id as string) === ctx.profissionalId,
  }));
  return { ok: true, data: lista };
}

export async function alterarRole(
  profissionalId: string,
  novoRole: 'admin' | 'profissional' | 'secretaria',
): Promise<Result<null>> {
  const ctx = await obterContextoAdmin();
  if (!ctx.ok) return ctx;
  if (ctx.role !== 'admin') {
    return { ok: false, error: 'Apenas administradores podem alterar funções.' };
  }

  if (profissionalId === ctx.profissionalId && novoRole !== 'admin') {
    return {
      ok: false,
      error: 'Você não pode remover sua própria função de administrador.',
    };
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('profissionais')
    .select('id, tenant_id')
    .eq('id', profissionalId)
    .maybeSingle();
  if (!row || (row.tenant_id as string) !== ctx.tenantId) {
    return { ok: false, error: 'Profissional nao encontrado.' };
  }

  const { error } = await admin
    .from('profissionais')
    .update({ role: novoRole })
    .eq('id', profissionalId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/configuracoes');
  return { ok: true, data: null };
}

export async function alterarAtivoProfissional(
  profissionalId: string,
  ativo: boolean,
): Promise<Result<null>> {
  const ctx = await obterContextoAdmin();
  if (!ctx.ok) return ctx;
  if (ctx.role !== 'admin') {
    return { ok: false, error: 'Apenas administradores podem alterar status.' };
  }

  if (profissionalId === ctx.profissionalId && !ativo) {
    return { ok: false, error: 'Você não pode se desativar.' };
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('profissionais')
    .select('id, tenant_id')
    .eq('id', profissionalId)
    .maybeSingle();
  if (!row || (row.tenant_id as string) !== ctx.tenantId) {
    return { ok: false, error: 'Profissional nao encontrado.' };
  }

  const { error } = await admin
    .from('profissionais')
    .update({ ativo })
    .eq('id', profissionalId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/configuracoes');
  return { ok: true, data: null };
}
