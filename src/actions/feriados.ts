'use server';

import { createAdminClient, createClient } from '@/lib/supabase/server';

export type Feriado = {
  id: string;
  tenant_id: string | null;
  data: string;
  nome: string;
  tipo: 'nacional' | 'municipal' | 'custom';
  recorrente: boolean;
};

const FERIADOS_NACIONAIS: Array<{ data: string; nome: string; recorrente: boolean }> = [
  { data: '2026-01-01', nome: 'Confraternizacao Universal', recorrente: true },
  { data: '2026-02-16', nome: 'Carnaval', recorrente: false },
  { data: '2026-02-17', nome: 'Carnaval', recorrente: false },
  { data: '2026-04-03', nome: 'Sexta-feira Santa', recorrente: false },
  { data: '2026-04-21', nome: 'Tiradentes', recorrente: true },
  { data: '2026-05-01', nome: 'Dia do Trabalho', recorrente: true },
  { data: '2026-06-04', nome: 'Corpus Christi', recorrente: false },
  { data: '2026-09-07', nome: 'Independencia do Brasil', recorrente: true },
  { data: '2026-10-12', nome: 'Nossa Senhora Aparecida', recorrente: true },
  { data: '2026-11-02', nome: 'Finados', recorrente: true },
  { data: '2026-11-15', nome: 'Proclamacao da Republica', recorrente: true },
  { data: '2026-11-20', nome: 'Consciencia Negra', recorrente: true },
  { data: '2026-12-25', nome: 'Natal', recorrente: true },

  { data: '2027-01-01', nome: 'Confraternizacao Universal', recorrente: true },
  { data: '2027-02-08', nome: 'Carnaval', recorrente: false },
  { data: '2027-02-09', nome: 'Carnaval', recorrente: false },
  { data: '2027-03-26', nome: 'Sexta-feira Santa', recorrente: false },
  { data: '2027-04-21', nome: 'Tiradentes', recorrente: true },
  { data: '2027-05-01', nome: 'Dia do Trabalho', recorrente: true },
  { data: '2027-05-27', nome: 'Corpus Christi', recorrente: false },
  { data: '2027-09-07', nome: 'Independencia do Brasil', recorrente: true },
  { data: '2027-10-12', nome: 'Nossa Senhora Aparecida', recorrente: true },
  { data: '2027-11-02', nome: 'Finados', recorrente: true },
  { data: '2027-11-15', nome: 'Proclamacao da Republica', recorrente: true },
  { data: '2027-11-20', nome: 'Consciencia Negra', recorrente: true },
  { data: '2027-12-25', nome: 'Natal', recorrente: true },
];

async function getCurrentTenantId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return null;

  const { data, error } = await supabase
    .from('profissionais')
    .select('tenant_id')
    .eq('user_id', userResp.user.id)
    .maybeSingle();

  if (error || !data) return null;
  return data.tenant_id as string;
}

export async function getFeriados(ano: number): Promise<Feriado[]> {
  return getFeriadosRange(`${ano}-01-01`, `${ano}-12-31`);
}

export async function getFeriadosRange(
  dataInicio: string,
  dataFim: string,
): Promise<Feriado[]> {
  const supabase = createAdminClient();
  const tenantId = await getCurrentTenantId();

  let query = supabase
    .from('feriados')
    .select('*')
    .gte('data', dataInicio)
    .lte('data', dataFim);

  if (tenantId) {
    query = query.or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);
  } else {
    query = query.is('tenant_id', null);
  }

  const { data, error } = await query.order('data', { ascending: true });
  if (error) throw new Error(`getFeriadosRange: ${error.message}`);
  return (data ?? []) as Feriado[];
}

export async function isFeriado(
  data: string,
): Promise<{ feriado: boolean; nome?: string }> {
  const feriados = await getFeriadosRange(data, data);
  if (feriados.length === 0) return { feriado: false };
  return { feriado: true, nome: feriados[0].nome };
}

export async function seedFeriadosNacionais(
  ano: number,
): Promise<{ inseridos: number; existentes: number }> {
  const supabase = createAdminClient();
  const itens = FERIADOS_NACIONAIS.filter((f) => f.data.startsWith(`${ano}-`));
  if (itens.length === 0) {
    return { inseridos: 0, existentes: 0 };
  }

  const { data: existentes, error: errBusca } = await supabase
    .from('feriados')
    .select('data')
    .is('tenant_id', null)
    .eq('tipo', 'nacional')
    .gte('data', `${ano}-01-01`)
    .lte('data', `${ano}-12-31`);
  if (errBusca) throw new Error(`seedFeriadosNacionais busca: ${errBusca.message}`);

  const jaExistentes = new Set((existentes ?? []).map((r) => r.data as string));
  const aInserir = itens
    .filter((f) => !jaExistentes.has(f.data))
    .map((f) => ({
      tenant_id: null,
      data: f.data,
      nome: f.nome,
      tipo: 'nacional',
      recorrente: f.recorrente,
    }));

  if (aInserir.length === 0) {
    return { inseridos: 0, existentes: itens.length };
  }

  const { error } = await supabase.from('feriados').insert(aInserir);
  if (error) throw new Error(`seedFeriadosNacionais insert: ${error.message}`);

  return {
    inseridos: aInserir.length,
    existentes: itens.length - aInserir.length,
  };
}

export async function criarFeriadoCustom(dados: {
  data: string;
  nome: string;
  tipo?: 'municipal' | 'custom';
}): Promise<Feriado> {
  const supabase = createAdminClient();
  const tenantId = await getCurrentTenantId();
  if (!tenantId) throw new Error('Tenant nao identificado.');

  const { data, error } = await supabase
    .from('feriados')
    .insert({
      tenant_id: tenantId,
      data: dados.data,
      nome: dados.nome,
      tipo: dados.tipo ?? 'custom',
      recorrente: false,
    })
    .select()
    .single();
  if (error) throw new Error(`criarFeriadoCustom: ${error.message}`);
  return data as Feriado;
}

export async function excluirFeriado(id: string): Promise<void> {
  const supabase = createAdminClient();
  const tenantId = await getCurrentTenantId();
  if (!tenantId) throw new Error('Tenant nao identificado.');

  const { data: feriado, error: errBusca } = await supabase
    .from('feriados')
    .select('id, tenant_id, tipo')
    .eq('id', id)
    .maybeSingle();
  if (errBusca) throw new Error(`excluirFeriado busca: ${errBusca.message}`);
  if (!feriado) throw new Error('Feriado nao encontrado.');

  if (feriado.tenant_id === null || feriado.tipo === 'nacional') {
    throw new Error('Feriado nacional nao pode ser excluido.');
  }
  if (feriado.tenant_id !== tenantId) {
    throw new Error('Feriado nao pertence ao seu tenant.');
  }

  const { error } = await supabase.from('feriados').delete().eq('id', id);
  if (error) throw new Error(`excluirFeriado: ${error.message}`);
}
