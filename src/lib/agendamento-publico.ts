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

export type HorarioFaixa = {
  dias: number[]; // 0=Dom..6=Sab
  hora_inicio: string; // HH:MM
  hora_fim: string;
};

export type AvaliacaoResumo = {
  media: number; // 0-5
  total: number;
};

export type ProfissionalPublico = {
  tenantId: string;
  tenantNome: string;
  tenant: {
    telefone: string | null;
    endereco: string | null;
    cidade: string | null;
    estado: string | null;
  };
  profissional: {
    id: string;
    nome: string;
    especialidade: string;
    duracao_padrao_min: number;
    tolerancia_atraso_min: number;
    logo_url: string | null;
    avatar_url: string | null;
    registro_profissional: string | null;
    bio: string | null;
    telefone: string | null;
  };
  procedimentos: Procedimento[];
  horarios: HorarioFaixa[];
  avaliacao: AvaliacaoResumo | null;
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
    .select('id, nome_empresa, telefone, endereco, cidade, estado')
    .eq('slug', cleanSlug)
    .maybeSingle();
  if (tenantErr) return { ok: false, error: tenantErr.message };
  if (!tenant) return { ok: false, error: 'Profissional não encontrado.' };

  let profQuery = admin
    .from('profissionais')
    .select(
      'id, nome, especialidade, duracao_padrao_min, tolerancia_atraso_min, logo_url, avatar_url, registro_profissional, bio, telefone',
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

  const profissionalIdReal = prof.id as string;

  const [
    { data: procs, error: procsErr },
    { data: horariosRaw },
    { data: avaliacoesRaw },
  ] = await Promise.all([
    admin
      .from('procedimentos')
      .select('id, nome, duracao_min, valor')
      .eq('tenant_id', tenant.id)
      .eq('ativo', true)
      .order('nome', { ascending: true }),
    admin
      .from('horarios_disponiveis')
      .select('dia_semana, hora_inicio, hora_fim')
      .eq('profissional_id', profissionalIdReal)
      .eq('ativo', true)
      .order('dia_semana', { ascending: true })
      .order('hora_inicio', { ascending: true }),
    admin
      .from('avaliacoes')
      .select('nota')
      .eq('profissional_id', profissionalIdReal),
  ]);
  if (procsErr) return { ok: false, error: procsErr.message };

  const horarios = agruparHorariosFaixas(
    (horariosRaw ?? []).map((r) => ({
      dia_semana: Number(r.dia_semana),
      hora_inicio: String(r.hora_inicio).slice(0, 5),
      hora_fim: String(r.hora_fim).slice(0, 5),
    })),
  );

  const notas = (avaliacoesRaw ?? [])
    .map((r) => Number(r.nota))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);
  const avaliacao =
    notas.length > 0
      ? {
          media:
            Math.round(
              (notas.reduce((acc, n) => acc + n, 0) / notas.length) * 10,
            ) / 10,
          total: notas.length,
        }
      : null;

  return {
    ok: true,
    data: {
      tenantId: tenant.id as string,
      tenantNome: tenant.nome_empresa as string,
      tenant: {
        telefone: (tenant.telefone as string | null) ?? null,
        endereco: (tenant.endereco as string | null) ?? null,
        cidade: (tenant.cidade as string | null) ?? null,
        estado: (tenant.estado as string | null) ?? null,
      },
      profissional: {
        id: profissionalIdReal,
        nome: prof.nome as string,
        especialidade: prof.especialidade as string,
        duracao_padrao_min: (prof.duracao_padrao_min as number) ?? 30,
        tolerancia_atraso_min: (prof.tolerancia_atraso_min as number) ?? 5,
        logo_url: (prof.logo_url as string | null) ?? null,
        avatar_url: (prof.avatar_url as string | null) ?? null,
        registro_profissional:
          (prof.registro_profissional as string | null) ?? null,
        bio: (prof.bio as string | null) ?? null,
        telefone: (prof.telefone as string | null) ?? null,
      },
      procedimentos: (procs ?? []).map((p) => ({
        id: p.id as string,
        nome: p.nome as string,
        duracao_min: p.duracao_min as number,
        valor: p.valor !== null ? Number(p.valor) : null,
      })),
      horarios,
      avaliacao,
    },
  };
}

/**
 * Agrupa registros de horarios_disponiveis (um por dia/faixa) em faixas que
 * compartilham o mesmo `hora_inicio`-`hora_fim` para exibir como
 * "Seg-Sex 8:00-18:00" em vez de listar 5 linhas iguais.
 *
 * Mantem a ordem dos dias (0-6) e devolve faixas ordenadas pela primeira hora
 * de inicio. Dias consecutivos com mesma faixa formam uma unica entrada
 * (a renderizacao decide como exibir um intervalo "Seg-Sex").
 */
function agruparHorariosFaixas(
  blocos: Array<{ dia_semana: number; hora_inicio: string; hora_fim: string }>,
): HorarioFaixa[] {
  const mapa = new Map<string, Set<number>>();
  for (const b of blocos) {
    const chave = `${b.hora_inicio}-${b.hora_fim}`;
    if (!mapa.has(chave)) mapa.set(chave, new Set());
    mapa.get(chave)!.add(b.dia_semana);
  }
  const faixas: HorarioFaixa[] = [];
  for (const [chave, dias] of mapa) {
    const [hora_inicio, hora_fim] = chave.split('-');
    faixas.push({
      dias: Array.from(dias).sort((a, b) => a - b),
      hora_inicio,
      hora_fim,
    });
  }
  faixas.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  return faixas;
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
