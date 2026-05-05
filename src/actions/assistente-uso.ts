'use server';

import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getInfoPlano, getLimiteAssistente } from '@/lib/planos';

export type UsoAssistente = {
  perguntasUsadas: number;
  limite: number;
  percentual: number;
  plano: string;
  nomePlano: string;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function mesAnoAtual(): string {
  return new Date().toISOString().slice(0, 7);
}

export async function getUsoAssistente(
  tenantId: string,
  profissionalId: string,
): Promise<UsoAssistente> {
  const admin = createAdminClient();

  const { data: tenant } = await admin
    .from('tenants')
    .select('plano')
    .eq('id', tenantId)
    .maybeSingle();
  const plano = (tenant?.plano as string | null) ?? 'trial';
  const info = getInfoPlano(plano);
  const limite = getLimiteAssistente(plano);

  const { data: row } = await admin
    .from('uso_assistente')
    .select('perguntas_usadas')
    .eq('tenant_id', tenantId)
    .eq('profissional_id', profissionalId)
    .eq('tipo', 'profissional')
    .eq('mes_ano', mesAnoAtual())
    .maybeSingle();

  const perguntasUsadas = Number(row?.perguntas_usadas ?? 0);
  const percentual =
    limite > 0 ? Math.min(100, (perguntasUsadas / limite) * 100) : 0;

  return {
    perguntasUsadas,
    limite,
    percentual,
    plano,
    nomePlano: info.nome,
  };
}

export async function getUsoAssistenteAtual(): Promise<Result<UsoAssistente>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessao expirada.' };

  const admin = createAdminClient();
  const { data: prof, error } = await admin
    .from('profissionais')
    .select('id, tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };

  const data = await getUsoAssistente(
    prof.tenant_id as string,
    prof.id as string,
  );
  return { ok: true, data };
}
