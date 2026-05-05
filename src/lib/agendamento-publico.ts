import { createAdminClient } from '@/lib/supabase/server';
import {
  getBloqueiosForProfissional,
  getFeriadosForTenant,
} from '@/lib/feriados-bloqueios';

export type Procedimento = {
  id: string;
  nome: string;
  duracao_min: number;
  valor: number | null;
};

export type ProfissionalPublico = {
  tenantId: string;
  tenantNome: string;
  profissional: {
    id: string;
    nome: string;
    especialidade: string;
    duracao_padrao_min: number;
    tolerancia_atraso_min: number;
    logo_url: string | null;
  };
  procedimentos: Procedimento[];
};

export type ProfissionalListItem = {
  id: string;
  nome: string;
  especialidade: string;
  logo_url: string | null;
  bio: string | null;
};

export async function getProfissionaisAtivosBySlug(
  slug: string,
): Promise<
  | { ok: true; tenantId: string; tenantNome: string; profissionais: ProfissionalListItem[] }
  | { ok: false; error: string }
> {
  const cleanSlug = slug.trim().toLowerCase();
  if (!cleanSlug || !/^[a-z0-9-]+$/.test(cleanSlug)) {
    return { ok: false, error: 'Link inválido.' };
  }
  const admin = createAdminClient();
  const { data: tenant, error: tenantErr } = await admin
    .from('tenants')
    .select('id, nome_empresa')
    .eq('slug', cleanSlug)
    .maybeSingle();
  if (tenantErr) return { ok: false, error: tenantErr.message };
  if (!tenant) return { ok: false, error: 'Profissional não encontrado.' };

  const { data: profs, error: profErr } = await admin
    .from('profissionais')
    .select('id, nome, especialidade, logo_url, bio')
    .eq('tenant_id', tenant.id as string)
    .eq('ativo', true)
    .order('nome', { ascending: true });
  if (profErr) return { ok: false, error: profErr.message };

  return {
    ok: true,
    tenantId: tenant.id as string,
    tenantNome: tenant.nome_empresa as string,
    profissionais: (profs ?? []).map((r) => ({
      id: r.id as string,
      nome: r.nome as string,
      especialidade: r.especialidade as string,
      logo_url: (r.logo_url as string | null) ?? null,
      bio: (r.bio as string | null) ?? null,
    })),
  };
}

export async function getProfissionalBySlug(
  slug: string,
  profissionalId?: string,
): Promise<{ ok: true; data: ProfissionalPublico } | { ok: false; error: string }> {
  const cleanSlug = slug.trim().toLowerCase();
  if (!cleanSlug || !/^[a-z0-9-]+$/.test(cleanSlug)) {
    return { ok: false, error: 'Link inválido.' };
  }

  const admin = createAdminClient();

  const { data: tenant, error: tenantErr } = await admin
    .from('tenants')
    .select('id, nome_empresa')
    .eq('slug', cleanSlug)
    .maybeSingle();
  if (tenantErr) return { ok: false, error: tenantErr.message };
  if (!tenant) return { ok: false, error: 'Profissional não encontrado.' };

  let profQuery = admin
    .from('profissionais')
    .select(
      'id, nome, especialidade, duracao_padrao_min, tolerancia_atraso_min, logo_url',
    )
    .eq('tenant_id', tenant.id)
    .eq('ativo', true);
  if (profissionalId) {
    profQuery = profQuery.eq('id', profissionalId);
  } else {
    profQuery = profQuery.order('created_at', { ascending: true });
  }
  const { data: prof, error: profErr } = await profQuery.limit(1).maybeSingle();
  if (profErr) return { ok: false, error: profErr.message };
  if (!prof) return { ok: false, error: 'Profissional não encontrado.' };

  const { data: procs, error: procsErr } = await admin
    .from('procedimentos')
    .select('id, nome, duracao_min, valor')
    .eq('tenant_id', tenant.id)
    .eq('ativo', true)
    .order('nome', { ascending: true });
  if (procsErr) return { ok: false, error: procsErr.message };

  return {
    ok: true,
    data: {
      tenantId: tenant.id as string,
      tenantNome: tenant.nome_empresa as string,
      profissional: {
        id: prof.id as string,
        nome: prof.nome as string,
        especialidade: prof.especialidade as string,
        duracao_padrao_min: (prof.duracao_padrao_min as number) ?? 30,
        tolerancia_atraso_min: (prof.tolerancia_atraso_min as number) ?? 5,
        logo_url: (prof.logo_url as string | null) ?? null,
      },
      procedimentos: (procs ?? []).map((p) => ({
        id: p.id as string,
        nome: p.nome as string,
        duracao_min: p.duracao_min as number,
        valor: p.valor !== null ? Number(p.valor) : null,
      })),
    },
  };
}

export async function getDiasSemanaDisponiveis(
  profissionalId: string,
): Promise<number[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('horarios_disponiveis')
    .select('dia_semana')
    .eq('profissional_id', profissionalId)
    .eq('ativo', true);
  if (error) return [];
  return Array.from(new Set((data ?? []).map((r) => r.dia_semana as number)));
}

function somarDiasIso(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + dias);
  return date.toISOString().slice(0, 10);
}

export async function getDatasIndisponiveis(
  tenantId: string,
  profissionalId: string,
  dataInicio: string,
  dataFim: string,
): Promise<string[]> {
  const [feriados, bloqueios] = await Promise.all([
    getFeriadosForTenant(tenantId, dataInicio, dataFim),
    getBloqueiosForProfissional(profissionalId, dataInicio, dataFim),
  ]);

  const datas = new Set<string>();
  for (const f of feriados) datas.add(f.data);

  for (const b of bloqueios) {
    const inicio = b.data_inicio < dataInicio ? dataInicio : b.data_inicio;
    const fim = b.data_fim > dataFim ? dataFim : b.data_fim;
    let cursor = inicio;
    while (cursor <= fim) {
      datas.add(cursor);
      cursor = somarDiasIso(cursor, 1);
    }
  }

  return Array.from(datas).sort();
}
