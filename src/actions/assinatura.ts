'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';

export type AssinaturaTenant = {
  planoId: string;
  planoNome: string;
  periodo: 'mensal' | 'anual' | null;
  status: string | null;
  diasTrialRestantes: number | null;
  planoExpiraEm: string | null;
  temAssinaturaAtiva: boolean;
  pagamentoPendente: boolean;
};

const NOMES_PLANO: Record<string, string> = {
  trial: 'Trial (14 dias)',
  individual: 'Individual',
  equipe3: 'Equipe 3',
  equipe5: 'Equipe 5',
  clinica10: 'Clínica 10',
  // Legacy v1 (ainda pode aparecer em dados antigos)
  essencial: 'Individual',
  profissional: 'Equipe 3',
  clinica: 'Clínica 10',
};

export async function getAssinaturaTenant(): Promise<
  { ok: true; data: AssinaturaTenant } | { ok: false; error: string }
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Sessão expirada.' };

    const admin = createAdminClient();
    const { data: prof, error: profErr } = await admin
      .from('profissionais')
      .select('id, tenant_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profErr) return { ok: false, error: profErr.message };
    if (!prof) return { ok: false, error: 'Profissional não encontrado.' };

    const { data: tenant, error: tenantErr } = await admin
      .from('tenants')
      .select(
        'id, plano, periodo_assinatura, assinatura_status, plano_expira_em, trial_expira_em',
      )
      .eq('id', prof.tenant_id as string)
      .maybeSingle();
    if (tenantErr) return { ok: false, error: tenantErr.message };
    if (!tenant) return { ok: false, error: 'Tenant não encontrado.' };

    const planoId = (tenant.plano as string | null) ?? 'trial';
    const status = (tenant.assinatura_status as string | null) ?? null;
    const trialIso = (tenant.trial_expira_em as string | null) ?? null;
    const diasTrialRestantes = trialIso
      ? Math.max(
          0,
          Math.ceil(
            (new Date(trialIso).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : null;

    return {
      ok: true,
      data: {
        planoId,
        planoNome: NOMES_PLANO[planoId] ?? planoId,
        periodo:
          (tenant.periodo_assinatura as 'mensal' | 'anual' | null) ?? null,
        status,
        diasTrialRestantes,
        planoExpiraEm: (tenant.plano_expira_em as string | null) ?? null,
        temAssinaturaAtiva:
          status === 'active' || status === 'trialing',
        pagamentoPendente: status === 'past_due' || status === 'unpaid',
      },
    };
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : 'Erro desconhecido.';
    return { ok: false, error: msg };
  }
}
