'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getFeriadosForTenant, type FeriadoRow } from '@/lib/feriados-bloqueios';

export type BloqueioTipo = 'ferias' | 'folga' | 'feriado' | 'outro';

export type Bloqueio = {
  id: string;
  tenant_id: string;
  profissional_id: string;
  data_inicio: string;
  data_fim: string;
  motivo: string | null;
  tipo: BloqueioTipo;
  created_at: string;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

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

export async function getBloqueios(): Promise<Result<Bloqueio[]>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('bloqueios')
    .select('*')
    .eq('profissional_id', ctx.profissionalId)
    .order('data_inicio', { ascending: false });
  if (error) return { ok: false, error: error.message };

  return { ok: true, data: (data ?? []) as Bloqueio[] };
}

export async function getBloqueiosRange(
  dataInicio: string,
  dataFim: string,
): Promise<Bloqueio[]> {
  const ctx = await obterContexto();
  if (!ctx.ok) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('bloqueios')
    .select('*')
    .eq('profissional_id', ctx.profissionalId)
    .lte('data_inicio', dataFim)
    .gte('data_fim', dataInicio)
    .order('data_inicio', { ascending: true });
  if (error) return [];
  return (data ?? []) as Bloqueio[];
}

export async function isDataBloqueada(
  data: string,
): Promise<{ bloqueado: boolean; motivo?: string | null }> {
  const ctx = await obterContexto();
  if (!ctx.ok) return { bloqueado: false };

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from('bloqueios')
    .select('motivo')
    .eq('profissional_id', ctx.profissionalId)
    .lte('data_inicio', data)
    .gte('data_fim', data)
    .limit(1);
  if (error || !rows || rows.length === 0) return { bloqueado: false };

  return { bloqueado: true, motivo: (rows[0].motivo as string | null) ?? null };
}

export type CriarBloqueioInput = {
  data_inicio: string;
  data_fim: string;
  motivo?: string;
  tipo?: BloqueioTipo;
};

export async function criarBloqueio(
  input: CriarBloqueioInput,
): Promise<Result<Bloqueio>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.data_inicio)) {
    return { ok: false, error: 'Data de inicio invalida.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.data_fim)) {
    return { ok: false, error: 'Data de fim invalida.' };
  }
  if (input.data_inicio > input.data_fim) {
    return { ok: false, error: 'Data de fim deve ser maior ou igual a data de inicio.' };
  }

  const motivo = input.motivo?.trim() ?? '';
  if (motivo.length > 200) {
    return { ok: false, error: 'Motivo acima de 200 caracteres.' };
  }

  const tipo: BloqueioTipo = input.tipo ?? 'ferias';
  if (!['ferias', 'folga', 'feriado', 'outro'].includes(tipo)) {
    return { ok: false, error: 'Tipo de bloqueio invalido.' };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('bloqueios')
    .insert({
      tenant_id: ctx.tenantId,
      profissional_id: ctx.profissionalId,
      data_inicio: input.data_inicio,
      data_fim: input.data_fim,
      motivo: motivo || null,
      tipo,
    })
    .select('*')
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Falha ao criar bloqueio.' };
  }

  revalidatePath('/configuracoes');
  revalidatePath('/agenda');
  return { ok: true, data: data as Bloqueio };
}

export async function getBloqueiosEFeriados(
  ano?: number,
): Promise<
  Result<{ bloqueios: Bloqueio[]; feriados: FeriadoRow[] }>
> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();

  const anoAlvo = ano ?? new Date().getFullYear();
  const dataInicio = `${anoAlvo}-01-01`;
  const dataFim = `${anoAlvo + 1}-12-31`;

  try {
    const [{ data: bloqs, error: bErr }, feriados] = await Promise.all([
      admin
        .from('bloqueios')
        .select('*')
        .eq('profissional_id', ctx.profissionalId)
        .gte('data_fim', dataInicio)
        .order('data_inicio', { ascending: true }),
      getFeriadosForTenant(ctx.tenantId, dataInicio, dataFim),
    ]);
    if (bErr) return { ok: false, error: bErr.message };
    return {
      ok: true,
      data: {
        bloqueios: (bloqs ?? []) as Bloqueio[],
        feriados,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function excluirBloqueio(id: string): Promise<Result<null>> {
  if (!id) return { ok: false, error: 'Bloqueio invalido.' };
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data: row, error: getErr } = await admin
    .from('bloqueios')
    .select('id, profissional_id, tenant_id')
    .eq('id', id)
    .maybeSingle();
  if (getErr) return { ok: false, error: getErr.message };
  if (!row) return { ok: false, error: 'Bloqueio nao encontrado.' };
  if (row.tenant_id !== ctx.tenantId || row.profissional_id !== ctx.profissionalId) {
    return { ok: false, error: 'Sem permissao.' };
  }

  const { error } = await admin.from('bloqueios').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/configuracoes');
  revalidatePath('/agenda');
  return { ok: true, data: null };
}
