'use server';

import { createAdminClient, createClient } from '@/lib/supabase/server';

export type ChecklistPassoId =
  | 'horarios'
  | 'procedimentos'
  | 'logo'
  | 'assinatura'
  | 'paciente'
  | 'agendamento'
  | 'link_compartilhado'
  | 'plano';

export type ChecklistStatus = {
  // Cada passo cujo estado o servidor consegue determinar. O passo
  // 'link_compartilhado' depende de uma flag client-side (localStorage) e
  // por isso nao aparece aqui — o componente mescla o estado dele.
  horarios: boolean;
  procedimentos: boolean;
  logo: boolean;
  assinatura: boolean;
  paciente: boolean;
  agendamento: boolean;
  plano: boolean;
};

export type ChecklistStatusResult =
  | { ok: true; data: ChecklistStatus }
  | { ok: false; error: string };

/**
 * Verifica de uma so vez todos os passos do checklist de primeiro uso
 * que dependem do banco. A flag de "link compartilhado" e mantida no
 * cliente (localStorage), portanto NAO esta aqui.
 */
export async function getChecklistStatus(): Promise<ChecklistStatusResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Sessão expirada.' };

    const admin = createAdminClient();

    // 1. Resolver o profissional logado + tenant
    const { data: prof, error: profErr } = await admin
      .from('profissionais')
      .select('id, tenant_id, logo_url')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profErr) return { ok: false, error: profErr.message };
    if (!prof) return { ok: false, error: 'Profissional não encontrado.' };

    const profissionalId = prof.id as string;
    const tenantId = prof.tenant_id as string;

    // 2. Buscar colunas "opcionais" do profissional (podem nao existir em
    //    prod antigo). Em caso de erro, considera campo nulo.
    let assinaturaConfigurada = false;
    try {
      const { data: profExtra } = await admin
        .from('profissionais')
        .select('assinatura_tipo, assinatura_fonte, assinatura_url')
        .eq('id', profissionalId)
        .maybeSingle();
      if (profExtra) {
        const tipo =
          (profExtra.assinatura_tipo as string | null) ?? null;
        const fonte =
          (profExtra.assinatura_fonte as string | null) ?? null;
        const url =
          (profExtra.assinatura_url as string | null) ?? null;
        assinaturaConfigurada =
          (tipo === 'fonte' && Boolean(fonte)) ||
          (tipo === 'imagem' && Boolean(url));
      }
    } catch {
      assinaturaConfigurada = false;
    }

    // 3. Contagens e plano em paralelo
    const [
      { count: horariosCount },
      { count: procedimentosCount },
      { count: pacientesCount },
      { count: agendamentosCount },
      { data: tenant },
    ] = await Promise.all([
      admin
        .from('horarios_disponiveis')
        .select('id', { count: 'exact', head: true })
        .eq('profissional_id', profissionalId)
        .eq('ativo', true),
      admin
        .from('procedimentos')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('ativo', true),
      admin
        .from('pacientes')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('ativo', true),
      admin
        .from('agendamentos')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      admin
        .from('tenants')
        .select('plano, assinatura_status')
        .eq('id', tenantId)
        .maybeSingle(),
    ]);

    const plano = (tenant?.plano as string | null) ?? 'trial';
    const assinaturaStatus =
      (tenant?.assinatura_status as string | null) ?? null;
    const planoOk = plano !== 'trial' || assinaturaStatus === 'active';

    return {
      ok: true,
      data: {
        horarios: (horariosCount ?? 0) > 0,
        procedimentos: (procedimentosCount ?? 0) > 0,
        logo: Boolean((prof.logo_url as string | null) ?? null),
        assinatura: assinaturaConfigurada,
        paciente: (pacientesCount ?? 0) > 0,
        agendamento: (agendamentosCount ?? 0) > 0,
        plano: planoOk,
      },
    };
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : 'Erro desconhecido.';
    return { ok: false, error: msg };
  }
}
