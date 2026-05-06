'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { obterContextoAutenticado } from '@/lib/auth-context';

export type CategoriaEstoque = 'descartaveis' | 'equipamentos' | 'outros';
export type UnidadeEstoque =
  | 'unidade'
  | 'ml'
  | 'litro'
  | 'kg'
  | 'pacote'
  | 'caixa'
  | 'rolo'
  | 'par';
export type TipoMovimentacao = 'entrada' | 'saida' | 'ajuste';

const CATEGORIAS_VALIDAS: CategoriaEstoque[] = [
  'descartaveis',
  'equipamentos',
  'outros',
];
const UNIDADES_VALIDAS: UnidadeEstoque[] = [
  'unidade',
  'ml',
  'litro',
  'kg',
  'pacote',
  'caixa',
  'rolo',
  'par',
];
const TIPOS_VALIDOS: TipoMovimentacao[] = ['entrada', 'saida', 'ajuste'];

export type ProdutoEstoque = {
  id: string;
  tenant_id: string;
  profissional_id: string;
  nome: string;
  categoria: CategoriaEstoque;
  quantidade: number;
  quantidade_minima: number;
  unidade: UnidadeEstoque;
  valor_unitario: number | null;
  fornecedor_padrao: string | null;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  alerta?: boolean;
};

export type MovimentacaoEstoque = {
  id: string;
  tenant_id: string;
  produto_id: string;
  profissional_id: string;
  tipo: TipoMovimentacao;
  quantidade: number;
  quantidade_anterior: number;
  quantidade_posterior: number;
  financeiro_id: string | null;
  agendamento_id: string | null;
  motivo: string | null;
  created_at: string;
  nome_produto?: string | null;
};

export type CriarProdutoInput = {
  nome: string;
  categoria: CategoriaEstoque;
  quantidade: number;
  quantidadeMinima: number;
  unidade: UnidadeEstoque;
  valorUnitario?: number | null;
  fornecedorPadrao?: string | null;
  observacoes?: string | null;
};

export type AtualizarProdutoInput = Partial<{
  nome: string;
  categoria: CategoriaEstoque;
  quantidadeMinima: number;
  unidade: UnidadeEstoque;
  valorUnitario: number | null;
  fornecedorPadrao: string | null;
  observacoes: string | null;
  ativo: boolean;
}>;

export type MovimentacaoInput = {
  produtoId: string;
  tipo: TipoMovimentacao;
  quantidade: number;
  motivo?: string | null;
  financeiroId?: string | null;
  agendamentoId?: string | null;
};

export type EstoqueFiltros = {
  categoria?: CategoriaEstoque | 'todas';
  busca?: string;
  apenasAlerta?: boolean;
  profissionalId?: string;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function mapProduto(row: Record<string, unknown>): ProdutoEstoque {
  const qtd = Number(row.quantidade) || 0;
  const min = Number(row.quantidade_minima) || 0;
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    profissional_id: row.profissional_id as string,
    nome: row.nome as string,
    categoria: (row.categoria as CategoriaEstoque) ?? 'outros',
    quantidade: qtd,
    quantidade_minima: min,
    unidade: (row.unidade as UnidadeEstoque) ?? 'unidade',
    valor_unitario:
      row.valor_unitario === null || row.valor_unitario === undefined
        ? null
        : Number(row.valor_unitario),
    fornecedor_padrao: (row.fornecedor_padrao as string | null) ?? null,
    ativo: row.ativo === false ? false : true,
    observacoes: (row.observacoes as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    alerta: qtd <= min,
  };
}

function mapMovimentacao(row: Record<string, unknown>): MovimentacaoEstoque {
  const prodRaw = row.estoque_produtos as
    | { nome: string }
    | { nome: string }[]
    | null
    | undefined;
  const prod = Array.isArray(prodRaw) ? prodRaw[0] : prodRaw;
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    produto_id: row.produto_id as string,
    profissional_id: row.profissional_id as string,
    tipo: (row.tipo as TipoMovimentacao) ?? 'ajuste',
    quantidade: Number(row.quantidade) || 0,
    quantidade_anterior: Number(row.quantidade_anterior) || 0,
    quantidade_posterior: Number(row.quantidade_posterior) || 0,
    financeiro_id: (row.financeiro_id as string | null) ?? null,
    agendamento_id: (row.agendamento_id as string | null) ?? null,
    motivo: (row.motivo as string | null) ?? null,
    created_at: row.created_at as string,
    nome_produto: prod?.nome ?? null,
  };
}

const PRODUTO_COLS =
  'id, tenant_id, profissional_id, nome, categoria, quantidade, quantidade_minima, unidade, valor_unitario, fornecedor_padrao, ativo, observacoes, created_at, updated_at';
const MOV_COLS =
  'id, tenant_id, produto_id, profissional_id, tipo, quantidade, quantidade_anterior, quantidade_posterior, financeiro_id, agendamento_id, motivo, created_at';

// ============================================================
// a) criarProduto
// ============================================================
export async function criarProduto(
  input: CriarProdutoInput,
): Promise<Result<ProdutoEstoque>> {
  const ctx = await obterContextoAutenticado();
  if (!ctx.ok) return ctx;

  const nome = input.nome?.trim() ?? '';
  if (nome.length < 2) {
    return { ok: false, error: 'Nome do produto obrigatorio.' };
  }
  if (!CATEGORIAS_VALIDAS.includes(input.categoria)) {
    return { ok: false, error: 'Categoria invalida.' };
  }
  if (!UNIDADES_VALIDAS.includes(input.unidade)) {
    return { ok: false, error: 'Unidade invalida.' };
  }
  const quantidade = Number(input.quantidade);
  if (!Number.isFinite(quantidade) || quantidade < 0) {
    return { ok: false, error: 'Quantidade invalida.' };
  }
  const quantidadeMinima = Number(input.quantidadeMinima);
  if (!Number.isFinite(quantidadeMinima) || quantidadeMinima < 0) {
    return { ok: false, error: 'Quantidade minima invalida.' };
  }
  const valorUnitario =
    input.valorUnitario === null || input.valorUnitario === undefined
      ? null
      : Number(input.valorUnitario);
  if (valorUnitario !== null && (!Number.isFinite(valorUnitario) || valorUnitario < 0)) {
    return { ok: false, error: 'Valor unitario invalido.' };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('estoque_produtos')
    .insert({
      tenant_id: ctx.tenantId,
      profissional_id: ctx.profissionalId,
      nome,
      categoria: input.categoria,
      quantidade,
      quantidade_minima: quantidadeMinima,
      unidade: input.unidade,
      valor_unitario: valorUnitario,
      fornecedor_padrao: input.fornecedorPadrao?.trim() || null,
      observacoes: input.observacoes?.trim() || null,
      ativo: true,
    })
    .select(PRODUTO_COLS)
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Falha ao criar produto.' };
  }

  // Movimentacao inicial de entrada se quantidade > 0
  if (quantidade > 0) {
    await admin.from('estoque_movimentacoes').insert({
      tenant_id: ctx.tenantId,
      produto_id: data.id as string,
      profissional_id: ctx.profissionalId,
      tipo: 'entrada',
      quantidade,
      quantidade_anterior: 0,
      quantidade_posterior: quantidade,
      motivo: 'Cadastro inicial',
    });
  }

  revalidatePath('/estoque');
  return { ok: true, data: mapProduto(data) };
}

// ============================================================
// b) atualizarProduto
// ============================================================
export async function atualizarProduto(
  produtoId: string,
  input: AtualizarProdutoInput,
): Promise<Result<null>> {
  if (!produtoId) return { ok: false, error: 'Produto invalido.' };
  const ctx = await obterContextoAutenticado();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data: prod, error: prodErr } = await admin
    .from('estoque_produtos')
    .select('id, tenant_id, profissional_id')
    .eq('id', produtoId)
    .maybeSingle();
  if (prodErr) return { ok: false, error: prodErr.message };
  if (!prod) return { ok: false, error: 'Produto nao encontrado.' };
  if (prod.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Sem permissao.' };
  }
  if (
    ctx.role !== 'admin' &&
    prod.profissional_id !== ctx.profissionalId
  ) {
    return { ok: false, error: 'Sem permissao.' };
  }

  const update: Record<string, unknown> = {};
  if (input.nome !== undefined) {
    const nome = input.nome.trim();
    if (nome.length < 2) return { ok: false, error: 'Nome invalido.' };
    update.nome = nome;
  }
  if (input.categoria !== undefined) {
    if (!CATEGORIAS_VALIDAS.includes(input.categoria)) {
      return { ok: false, error: 'Categoria invalida.' };
    }
    update.categoria = input.categoria;
  }
  if (input.unidade !== undefined) {
    if (!UNIDADES_VALIDAS.includes(input.unidade)) {
      return { ok: false, error: 'Unidade invalida.' };
    }
    update.unidade = input.unidade;
  }
  if (input.quantidadeMinima !== undefined) {
    const n = Number(input.quantidadeMinima);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: 'Quantidade minima invalida.' };
    }
    update.quantidade_minima = n;
  }
  if (input.valorUnitario !== undefined) {
    if (input.valorUnitario === null) {
      update.valor_unitario = null;
    } else {
      const n = Number(input.valorUnitario);
      if (!Number.isFinite(n) || n < 0) {
        return { ok: false, error: 'Valor unitario invalido.' };
      }
      update.valor_unitario = n;
    }
  }
  if (input.fornecedorPadrao !== undefined) {
    update.fornecedor_padrao = input.fornecedorPadrao?.trim() || null;
  }
  if (input.observacoes !== undefined) {
    update.observacoes = input.observacoes?.trim() || null;
  }
  if (input.ativo !== undefined) {
    update.ativo = Boolean(input.ativo);
  }

  if (Object.keys(update).length === 0) {
    return { ok: true, data: null };
  }
  update.updated_at = new Date().toISOString();

  const { error } = await admin
    .from('estoque_produtos')
    .update(update)
    .eq('id', produtoId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/estoque');
  return { ok: true, data: null };
}

// ============================================================
// c) excluirProduto (soft delete)
// ============================================================
export async function excluirProduto(
  produtoId: string,
): Promise<Result<null>> {
  return atualizarProduto(produtoId, { ativo: false });
}

// ============================================================
// d) getEstoque
// ============================================================
export async function getEstoque(
  filtros: EstoqueFiltros = {},
): Promise<Result<ProdutoEstoque[]>> {
  const ctx = await obterContextoAutenticado();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  let q = admin
    .from('estoque_produtos')
    .select(PRODUTO_COLS)
    .eq('tenant_id', ctx.tenantId)
    .eq('ativo', true);

  if (ctx.role === 'admin') {
    if (filtros.profissionalId) {
      q = q.eq('profissional_id', filtros.profissionalId);
    }
  } else {
    q = q.eq('profissional_id', ctx.profissionalId);
  }

  if (
    filtros.categoria &&
    filtros.categoria !== 'todas' &&
    CATEGORIAS_VALIDAS.includes(filtros.categoria)
  ) {
    q = q.eq('categoria', filtros.categoria);
  }
  const busca = filtros.busca?.trim() ?? '';
  if (busca.length > 0) {
    const safe = busca.replace(/[,()*]/g, ' ').trim();
    q = q.ilike('nome', `%${safe}%`);
  }

  const { data, error } = await q.order('nome', { ascending: true });
  if (error) return { ok: false, error: error.message };

  let lista = (data ?? []).map((r) => mapProduto(r));
  if (filtros.apenasAlerta) {
    lista = lista.filter((p) => p.alerta);
  }
  return { ok: true, data: lista };
}

// ============================================================
// e) getProduto
// ============================================================
export async function getProduto(
  produtoId: string,
): Promise<Result<ProdutoEstoque>> {
  if (!produtoId) return { ok: false, error: 'Produto invalido.' };
  const ctx = await obterContextoAutenticado();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('estoque_produtos')
    .select(PRODUTO_COLS)
    .eq('id', produtoId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Produto nao encontrado.' };
  if (data.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Sem permissao.' };
  }
  if (
    ctx.role !== 'admin' &&
    data.profissional_id !== ctx.profissionalId
  ) {
    return { ok: false, error: 'Sem permissao.' };
  }
  return { ok: true, data: mapProduto(data) };
}

// ============================================================
// f) getProdutosAlerta
// ============================================================
export type ProdutoAlerta = {
  id: string;
  nome: string;
  categoria: CategoriaEstoque;
  quantidade: number;
  quantidadeMinima: number;
  unidade: UnidadeEstoque;
};

export async function getProdutosAlerta(): Promise<Result<ProdutoAlerta[]>> {
  const ctx = await obterContextoAutenticado();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  let q = admin
    .from('estoque_produtos')
    .select('id, nome, categoria, quantidade, quantidade_minima, unidade')
    .eq('tenant_id', ctx.tenantId)
    .eq('ativo', true);

  if (ctx.role !== 'admin') {
    q = q.eq('profissional_id', ctx.profissionalId);
  }

  const { data, error } = await q.order('nome', { ascending: true });
  if (error) return { ok: false, error: error.message };

  const lista: ProdutoAlerta[] = (data ?? [])
    .filter(
      (r) =>
        Number(r.quantidade) <= Number(r.quantidade_minima),
    )
    .map((r) => ({
      id: r.id as string,
      nome: r.nome as string,
      categoria: (r.categoria as CategoriaEstoque) ?? 'outros',
      quantidade: Number(r.quantidade) || 0,
      quantidadeMinima: Number(r.quantidade_minima) || 0,
      unidade: (r.unidade as UnidadeEstoque) ?? 'unidade',
    }));
  return { ok: true, data: lista };
}

// ============================================================
// g) registrarMovimentacao
// ============================================================
export type MovimentacaoResult = {
  movimentacao: MovimentacaoEstoque;
  produto: ProdutoEstoque;
};

export async function registrarMovimentacao(
  input: MovimentacaoInput,
): Promise<Result<MovimentacaoResult>> {
  const ctx = await obterContextoAutenticado();
  if (!ctx.ok) return ctx;

  if (!input.produtoId) {
    return { ok: false, error: 'Produto invalido.' };
  }
  if (!TIPOS_VALIDOS.includes(input.tipo)) {
    return { ok: false, error: 'Tipo de movimentacao invalido.' };
  }
  const qtd = Number(input.quantidade);
  if (!Number.isFinite(qtd) || qtd < 0) {
    return { ok: false, error: 'Quantidade invalida.' };
  }
  if (input.tipo !== 'ajuste' && qtd <= 0) {
    return { ok: false, error: 'Quantidade deve ser maior que zero.' };
  }

  const admin = createAdminClient();
  const { data: prod, error: prodErr } = await admin
    .from('estoque_produtos')
    .select(PRODUTO_COLS)
    .eq('id', input.produtoId)
    .maybeSingle();
  if (prodErr) return { ok: false, error: prodErr.message };
  if (!prod) return { ok: false, error: 'Produto nao encontrado.' };
  if (prod.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Sem permissao.' };
  }
  if (
    ctx.role !== 'admin' &&
    prod.profissional_id !== ctx.profissionalId
  ) {
    return { ok: false, error: 'Sem permissao.' };
  }

  const quantidadeAnterior = Number(prod.quantidade) || 0;
  let quantidadePosterior: number;
  if (input.tipo === 'entrada') {
    quantidadePosterior = quantidadeAnterior + qtd;
  } else if (input.tipo === 'saida') {
    if (quantidadeAnterior - qtd < 0) {
      return {
        ok: false,
        error: `Estoque insuficiente. Disponivel: ${quantidadeAnterior}.`,
      };
    }
    quantidadePosterior = quantidadeAnterior - qtd;
  } else {
    // ajuste: qtd e o novo valor absoluto
    quantidadePosterior = qtd;
  }

  // Valida vinculacoes opcionais
  let financeiroId: string | null = null;
  if (input.financeiroId) {
    const { data: fin } = await admin
      .from('financeiro')
      .select('id, tenant_id')
      .eq('id', input.financeiroId)
      .maybeSingle();
    if (fin && fin.tenant_id === ctx.tenantId) {
      financeiroId = fin.id as string;
    }
  }
  let agendamentoId: string | null = null;
  if (input.agendamentoId) {
    const { data: ag } = await admin
      .from('agendamentos')
      .select('id, tenant_id')
      .eq('id', input.agendamentoId)
      .maybeSingle();
    if (ag && ag.tenant_id === ctx.tenantId) {
      agendamentoId = ag.id as string;
    }
  }

  const { data: movRow, error: movErr } = await admin
    .from('estoque_movimentacoes')
    .insert({
      tenant_id: ctx.tenantId,
      produto_id: input.produtoId,
      profissional_id: ctx.profissionalId,
      tipo: input.tipo,
      quantidade: qtd,
      quantidade_anterior: quantidadeAnterior,
      quantidade_posterior: quantidadePosterior,
      financeiro_id: financeiroId,
      agendamento_id: agendamentoId,
      motivo: input.motivo?.trim() || null,
    })
    .select(MOV_COLS)
    .single();
  if (movErr || !movRow) {
    return {
      ok: false,
      error: movErr?.message ?? 'Falha ao registrar movimentacao.',
    };
  }

  const { data: prodAtualizado, error: updErr } = await admin
    .from('estoque_produtos')
    .update({
      quantidade: quantidadePosterior,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.produtoId)
    .select(PRODUTO_COLS)
    .single();
  if (updErr || !prodAtualizado) {
    return {
      ok: false,
      error: updErr?.message ?? 'Falha ao atualizar quantidade.',
    };
  }

  revalidatePath('/estoque');
  return {
    ok: true,
    data: {
      movimentacao: mapMovimentacao(movRow),
      produto: mapProduto(prodAtualizado),
    },
  };
}

// ============================================================
// h) getMovimentacoes
// ============================================================
export type MovimentacoesFiltros = {
  tipo?: TipoMovimentacao | 'todos';
  limite?: number;
};

export async function getMovimentacoes(
  produtoId: string,
  filtros: MovimentacoesFiltros = {},
): Promise<Result<MovimentacaoEstoque[]>> {
  if (!produtoId) return { ok: false, error: 'Produto invalido.' };
  const ctx = await obterContextoAutenticado();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data: prod } = await admin
    .from('estoque_produtos')
    .select('id, tenant_id, profissional_id')
    .eq('id', produtoId)
    .maybeSingle();
  if (!prod) return { ok: false, error: 'Produto nao encontrado.' };
  if (prod.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Sem permissao.' };
  }
  if (
    ctx.role !== 'admin' &&
    prod.profissional_id !== ctx.profissionalId
  ) {
    return { ok: false, error: 'Sem permissao.' };
  }

  let q = admin
    .from('estoque_movimentacoes')
    .select(`${MOV_COLS}, estoque_produtos(nome)`)
    .eq('produto_id', produtoId)
    .order('created_at', { ascending: false });

  if (
    filtros.tipo &&
    filtros.tipo !== 'todos' &&
    TIPOS_VALIDOS.includes(filtros.tipo as TipoMovimentacao)
  ) {
    q = q.eq('tipo', filtros.tipo);
  }
  const limite =
    typeof filtros.limite === 'number' && filtros.limite > 0
      ? Math.min(500, Math.round(filtros.limite))
      : 50;
  q = q.limit(limite);

  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map((r) => mapMovimentacao(r)) };
}

// ============================================================
// i) getRelatorioEstoque
// ============================================================
export type RelatorioEstoqueFiltros = {
  periodoInicio?: string; // ISO YYYY-MM-DD
  periodoFim?: string; // ISO YYYY-MM-DD
  profissionalId?: string;
};

export type RelatorioEstoque = {
  totalProdutos: number;
  produtosAlerta: number;
  movimentacoesPeriodo: number;
  topMovimentados: Array<{
    produtoId: string;
    nome: string;
    totalSaidas: number;
  }>;
  valorTotalEstoque: number;
};

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function getRelatorioEstoque(
  filtros: RelatorioEstoqueFiltros = {},
): Promise<Result<RelatorioEstoque>> {
  const ctx = await obterContextoAutenticado();
  if (!ctx.ok) return ctx;

  // Periodo: default ultimos 30 dias
  const hoje = new Date();
  const trintaDiasAtras = new Date(hoje);
  trintaDiasAtras.setUTCDate(trintaDiasAtras.getUTCDate() - 30);
  const inicio =
    filtros.periodoInicio && isIsoDate(filtros.periodoInicio)
      ? `${filtros.periodoInicio}T00:00:00.000Z`
      : trintaDiasAtras.toISOString();
  const fim =
    filtros.periodoFim && isIsoDate(filtros.periodoFim)
      ? `${filtros.periodoFim}T23:59:59.999Z`
      : hoje.toISOString();

  // Apenas admin pode filtrar por profissionalId
  const profissionalAlvo =
    ctx.role === 'admin'
      ? filtros.profissionalId ?? null
      : ctx.profissionalId;

  const admin = createAdminClient();

  // Produtos do escopo
  let prodQ = admin
    .from('estoque_produtos')
    .select('id, quantidade, quantidade_minima, valor_unitario')
    .eq('tenant_id', ctx.tenantId)
    .eq('ativo', true);
  if (profissionalAlvo) {
    prodQ = prodQ.eq('profissional_id', profissionalAlvo);
  }
  const { data: produtos, error: prodErr } = await prodQ;
  if (prodErr) return { ok: false, error: prodErr.message };

  const produtosLista = produtos ?? [];
  const totalProdutos = produtosLista.length;
  const produtosAlerta = produtosLista.filter(
    (p) => Number(p.quantidade) <= Number(p.quantidade_minima),
  ).length;
  const valorTotalEstoque = produtosLista.reduce((acc, p) => {
    const qtd = Number(p.quantidade) || 0;
    const valor = Number(p.valor_unitario) || 0;
    return acc + qtd * valor;
  }, 0);

  // Movimentacoes do periodo
  let movQ = admin
    .from('estoque_movimentacoes')
    .select('id, produto_id, tipo, quantidade, estoque_produtos(nome)')
    .eq('tenant_id', ctx.tenantId)
    .gte('created_at', inicio)
    .lte('created_at', fim);
  if (profissionalAlvo) {
    movQ = movQ.eq('profissional_id', profissionalAlvo);
  }
  const { data: movs, error: movErr } = await movQ;
  if (movErr) return { ok: false, error: movErr.message };

  const movimentacoesPeriodo = (movs ?? []).length;

  const saidasPorProduto = new Map<
    string,
    { nome: string; totalSaidas: number }
  >();
  for (const m of movs ?? []) {
    if (m.tipo !== 'saida') continue;
    const id = m.produto_id as string;
    const prodRaw = m.estoque_produtos as
      | { nome: string }
      | { nome: string }[]
      | null;
    const prod = Array.isArray(prodRaw) ? prodRaw[0] : prodRaw;
    const atual = saidasPorProduto.get(id);
    const nome = (prod?.nome as string | null) ?? 'Produto';
    const total = (atual?.totalSaidas ?? 0) + (Number(m.quantidade) || 0);
    saidasPorProduto.set(id, { nome, totalSaidas: total });
  }
  const topMovimentados = Array.from(saidasPorProduto.entries())
    .map(([produtoId, v]) => ({
      produtoId,
      nome: v.nome,
      totalSaidas: v.totalSaidas,
    }))
    .sort((a, b) => b.totalSaidas - a.totalSaidas)
    .slice(0, 5);

  return {
    ok: true,
    data: {
      totalProdutos,
      produtosAlerta,
      movimentacoesPeriodo,
      topMovimentados,
      valorTotalEstoque: Math.round(valorTotalEstoque * 100) / 100,
    },
  };
}
