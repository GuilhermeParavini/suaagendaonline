import { createAdminClient } from '@/lib/supabase/server';

export type FeriadoRow = {
  id: string;
  tenant_id: string | null;
  data: string;
  nome: string;
  tipo: 'nacional' | 'municipal' | 'custom';
  recorrente: boolean;
};

export type BloqueioRow = {
  id: string;
  tenant_id: string;
  profissional_id: string;
  data_inicio: string;
  data_fim: string;
  motivo: string | null;
  created_at: string;
};

export async function getFeriadosForTenant(
  tenantId: string | null,
  dataInicio: string,
  dataFim: string,
): Promise<FeriadoRow[]> {
  const admin = createAdminClient();

  // Busca feriados nacionais (tenant_id IS NULL) + customizados do tenant
  // em duas queries separadas para evitar problemas com or(is.null,...) no PostgREST.
  const queryNacional = admin
    .from('feriados')
    .select('*')
    .is('tenant_id', null)
    .gte('data', dataInicio)
    .lte('data', dataFim);

  const queryCustom = tenantId
    ? admin
        .from('feriados')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('data', dataInicio)
        .lte('data', dataFim)
    : null;

  const [resNacional, resCustom] = await Promise.all([
    queryNacional,
    queryCustom ? queryCustom : Promise.resolve({ data: [], error: null }),
  ]);

  if (resNacional.error) {
    throw new Error(`getFeriadosForTenant nacional: ${resNacional.error.message}`);
  }
  if (resCustom.error) {
    throw new Error(`getFeriadosForTenant custom: ${resCustom.error.message}`);
  }

  const todos = [
    ...((resNacional.data ?? []) as FeriadoRow[]),
    ...((resCustom.data ?? []) as FeriadoRow[]),
  ];
  todos.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  return todos;
}

export async function getBloqueiosForProfissional(
  profissionalId: string,
  dataInicio: string,
  dataFim: string,
): Promise<BloqueioRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('bloqueios')
    .select('*')
    .eq('profissional_id', profissionalId)
    .lte('data_inicio', dataFim)
    .gte('data_fim', dataInicio)
    .order('data_inicio', { ascending: true });
  if (error) throw new Error(`getBloqueiosForProfissional: ${error.message}`);
  return (data ?? []) as BloqueioRow[];
}

export function bloqueioCobreData(bloqueio: BloqueioRow, data: string): boolean {
  return bloqueio.data_inicio <= data && bloqueio.data_fim >= data;
}

export function expandirDatas(
  feriados: FeriadoRow[],
  bloqueios: BloqueioRow[],
  dataInicio: string,
  dataFim: string,
): Map<string, { feriado?: string; bloqueio?: string | null }> {
  const mapa = new Map<string, { feriado?: string; bloqueio?: string | null }>();

  for (const f of feriados) {
    if (f.data < dataInicio || f.data > dataFim) continue;
    const atual = mapa.get(f.data) ?? {};
    atual.feriado = f.nome;
    mapa.set(f.data, atual);
  }

  for (const b of bloqueios) {
    const inicio = b.data_inicio < dataInicio ? dataInicio : b.data_inicio;
    const fim = b.data_fim > dataFim ? dataFim : b.data_fim;
    let cursor = inicio;
    while (cursor <= fim) {
      const atual = mapa.get(cursor) ?? {};
      if (atual.bloqueio === undefined) atual.bloqueio = b.motivo;
      mapa.set(cursor, atual);
      cursor = somarDia(cursor);
    }
  }

  return mapa;
}

function somarDia(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
