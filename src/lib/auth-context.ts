import { createAdminClient, createClient } from '@/lib/supabase/server';
import type { Role } from '@/lib/permissoes';

export type ContextoAutenticado = {
  ok: true;
  userId: string;
  tenantId: string;
  profissionalId: string;
  role: Role;
};

export type ContextoFalha = { ok: false; error: string };

export async function obterContextoAutenticado(): Promise<
  ContextoAutenticado | ContextoFalha
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessao expirada.' };

  const admin = createAdminClient();
  const { data: prof, error } = await admin
    .from('profissionais')
    .select('id, tenant_id, role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };

  return {
    ok: true,
    userId: user.id,
    tenantId: prof.tenant_id as string,
    profissionalId: prof.id as string,
    role: ((prof.role as string) ?? 'profissional') as Role,
  };
}

export async function exigirAdmin(): Promise<
  ContextoAutenticado | ContextoFalha
> {
  const ctx = await obterContextoAutenticado();
  if (!ctx.ok) return ctx;
  if (ctx.role !== 'admin') {
    return { ok: false, error: 'Apenas administradores podem executar esta acao.' };
  }
  return ctx;
}

export async function isAdmin(): Promise<boolean> {
  const ctx = await obterContextoAutenticado();
  return ctx.ok && ctx.role === 'admin';
}
