"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  ADDONS_IA,
  ADDONS_SMS,
  DEGUSTACAO_IA,
  DEGUSTACAO_SMS,
  getAddon,
  getPlano,
  MODULOS_PADRAO,
  moduloDisponivelNoPlano,
  normalizarModulosAtivos,
  type AddonPacote,
  type AddonTipo,
  type InfoAddon,
  type InfoPlano,
  type ModuloId,
  type ModulosAtivos,
} from "@/lib/planos";
import { traduzirErro } from "@/lib/mensagens-erro";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export type AddonAtivo = {
  id: string;
  tenant_id: string;
  tipo: AddonTipo;
  pacote: AddonPacote;
  preco: number;
  quantidade: number;
  data_inicio: string;
  data_fim: string | null;
  ativo: boolean;
  info: InfoAddon | null;
};

export type PlanoAtual = {
  plano: InfoPlano;
  trialAtivo: boolean;
  trialExpiraEm: string | null;
  addons: AddonAtivo[];
};

export type UsoMensal = {
  usado: number;
  limiteTotal: number;
  limiteGratis: number;
  limiteAddon: number;
  restante: number;
  percentual: number;
  excedeu: boolean;
};

function mesAnoAtual(): string {
  return new Date().toISOString().slice(0, 7);
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function obterContexto(): Promise<
  | { ok: true; tenantId: string; profissionalId: string; userId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessao expirada." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profissionais")
    .select("id, tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return { ok: false, error: traduzirErro(error) };
  if (!data) return { ok: false, error: "Profissional nao encontrado." };
  return {
    ok: true,
    tenantId: data.tenant_id as string,
    profissionalId: data.id as string,
    userId: user.id,
  };
}

async function listarAddonsAtivos(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
): Promise<AddonAtivo[]> {
  const { data } = await admin
    .from("addons_tenant")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("ativo", true)
    .order("data_inicio", { ascending: false });

  const linhas = (data ?? []) as Array<Record<string, unknown>>;
  return linhas.map((row) => {
    const tipo = row.tipo as AddonTipo;
    const pacote = row.pacote as AddonPacote;
    return {
      id: String(row.id),
      tenant_id: String(row.tenant_id),
      tipo,
      pacote,
      preco: Number(row.preco ?? 0),
      quantidade: Number(row.quantidade ?? 0),
      data_inicio: String(row.data_inicio ?? ""),
      data_fim: (row.data_fim as string | null) ?? null,
      ativo: Boolean(row.ativo),
      info: getAddon(tipo, pacote),
    };
  });
}

// ---------------- Plano atual ----------------

export async function getPlanoAtual(): Promise<Result<PlanoAtual>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data: tenant, error } = await admin
    .from("tenants")
    .select("plano, trial_expira_em")
    .eq("id", ctx.tenantId)
    .maybeSingle();
  if (error) return { ok: false, error: traduzirErro(error) };

  const plano = getPlano((tenant?.plano as string | null) ?? "trial");
  const trialExpiraEm = (tenant?.trial_expira_em as string | null) ?? null;
  const trialAtivo =
    plano.id === "trial" &&
    Boolean(trialExpiraEm) &&
    new Date(trialExpiraEm as string).getTime() > Date.now();

  const addons = await listarAddonsAtivos(admin, ctx.tenantId);

  return {
    ok: true,
    data: { plano, trialAtivo, trialExpiraEm, addons },
  };
}

// ---------------- Uso ----------------

async function calcularUso(opts: {
  usado: number;
  limiteGratis: number;
  limiteAddon: number;
}): Promise<UsoMensal> {
  const { usado, limiteGratis, limiteAddon } = opts;
  const limiteTotal = limiteGratis + limiteAddon;
  const restante = Math.max(0, limiteTotal - usado);
  const percentual =
    limiteTotal > 0 ? Math.min(100, (usado / limiteTotal) * 100) : 0;
  return {
    usado,
    limiteTotal,
    limiteGratis,
    limiteAddon,
    restante,
    percentual,
    excedeu: usado >= limiteTotal,
  };
}

async function somarAddonsDoMes(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  tipo: AddonTipo,
  mesAno: string,
): Promise<number> {
  // Quantidade combinada de todos os addons ativos nesse mes.
  const inicioMes = `${mesAno}-01`;
  const { data } = await admin
    .from("addons_tenant")
    .select("quantidade, data_inicio, data_fim, ativo")
    .eq("tenant_id", tenantId)
    .eq("tipo", tipo);

  const linhas = (data ?? []) as Array<Record<string, unknown>>;
  return linhas
    .filter((r) => {
      const di = String(r.data_inicio ?? "");
      const df = (r.data_fim as string | null) ?? null;
      const ativo = Boolean(r.ativo);
      // Considera ativo no mes se nao foi cancelado antes do inicio do mes.
      if (di > `${mesAno}-31`) return false;
      if (df && df < inicioMes) return false;
      return ativo || (df && df >= inicioMes);
    })
    .reduce((acc, r) => acc + Number(r.quantidade ?? 0), 0);
}

export async function getUsoSMS(
  mesAno: string = mesAnoAtual(),
): Promise<Result<UsoMensal>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("uso_sms")
    .select("enviados")
    .eq("tenant_id", ctx.tenantId)
    .eq("mes_ano", mesAno)
    .maybeSingle();
  if (error) return { ok: false, error: traduzirErro(error) };

  const usado = Number(row?.enviados ?? 0);
  const limiteAddon = await somarAddonsDoMes(
    admin,
    ctx.tenantId,
    "sms",
    mesAno,
  );

  const data = await calcularUso({
    usado,
    limiteGratis: DEGUSTACAO_SMS,
    limiteAddon,
  });
  return { ok: true, data };
}

export async function getUsoIA(
  mesAno: string = mesAnoAtual(),
): Promise<Result<UsoMensal>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();

  // Soma assistente + transcricao do mes (ambos contam como "IA").
  const { data: assist } = await admin
    .from("uso_assistente")
    .select("perguntas_usadas")
    .eq("tenant_id", ctx.tenantId)
    .eq("mes_ano", mesAno);

  const usadoAssist = (assist ?? []).reduce(
    (acc, r) => acc + Number(r.perguntas_usadas ?? 0),
    0,
  );

  const { data: trans } = await admin
    .from("uso_transcricao")
    .select("segundos_usados")
    .eq("tenant_id", ctx.tenantId)
    .eq("mes_ano", mesAno);

  // Cada minuto de transcricao conta como 1 unidade.
  const usadoTrans = Math.ceil(
    ((trans ?? []).reduce(
      (acc, r) => acc + Number(r.segundos_usados ?? 0),
      0,
    )) / 60,
  );

  const usado = usadoAssist + usadoTrans;
  const limiteAddon = await somarAddonsDoMes(admin, ctx.tenantId, "ia", mesAno);

  const data = await calcularUso({
    usado,
    limiteGratis: DEGUSTACAO_IA,
    limiteAddon,
  });
  return { ok: true, data };
}

// ---------------- Limite combinado ----------------

export async function getLimiteTotalSMS(
  mesAno: string = mesAnoAtual(),
): Promise<number> {
  const ctx = await obterContexto();
  if (!ctx.ok) return DEGUSTACAO_SMS;
  const admin = createAdminClient();
  const limiteAddon = await somarAddonsDoMes(
    admin,
    ctx.tenantId,
    "sms",
    mesAno,
  );
  return DEGUSTACAO_SMS + limiteAddon;
}

export async function getLimiteTotalIA(
  mesAno: string = mesAnoAtual(),
): Promise<number> {
  const ctx = await obterContexto();
  if (!ctx.ok) return DEGUSTACAO_IA;
  const admin = createAdminClient();
  const limiteAddon = await somarAddonsDoMes(admin, ctx.tenantId, "ia", mesAno);
  return DEGUSTACAO_IA + limiteAddon;
}

export async function verificarLimiteSMS(): Promise<
  Result<{ permitido: boolean; uso: UsoMensal }>
> {
  const r = await getUsoSMS();
  if (!r.ok) return r;
  return { ok: true, data: { permitido: !r.data.excedeu, uso: r.data } };
}

export async function verificarLimiteIA(): Promise<
  Result<{ permitido: boolean; uso: UsoMensal }>
> {
  const r = await getUsoIA();
  if (!r.ok) return r;
  return { ok: true, data: { permitido: !r.data.excedeu, uso: r.data } };
}

// ---------------- Add-ons (CRUD) ----------------

export async function contratarAddon(
  tipo: AddonTipo,
  pacote: AddonPacote,
): Promise<Result<{ id: string }>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const info = getAddon(tipo, pacote);
  if (!info) return { ok: false, error: "Pacote invalido." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("addons_tenant")
    .insert({
      tenant_id: ctx.tenantId,
      tipo: info.tipo,
      pacote: info.pacote,
      preco: info.preco,
      quantidade: info.quantidade,
      data_inicio: hojeIso(),
      ativo: true,
    })
    .select("id")
    .single();

  if (error) {
    console.error("contratarAddon", error);
    return { ok: false, error: traduzirErro(error) };
  }

  revalidatePath("/configuracoes");
  return { ok: true, data: { id: String(data.id) } };
}

export async function cancelarAddon(
  addonId: string,
): Promise<Result<null>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { error } = await admin
    .from("addons_tenant")
    .update({ ativo: false, data_fim: hojeIso() })
    .eq("id", addonId)
    .eq("tenant_id", ctx.tenantId);

  if (error) {
    console.error("cancelarAddon", error);
    return { ok: false, error: traduzirErro(error) };
  }

  revalidatePath("/configuracoes");
  return { ok: true, data: null };
}

export async function trocarPacoteAddon(
  addonId: string,
  novoPacote: AddonPacote,
): Promise<Result<null>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data: atual, error: errAtual } = await admin
    .from("addons_tenant")
    .select("tipo")
    .eq("id", addonId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();

  if (errAtual) return { ok: false, error: traduzirErro(errAtual) };
  if (!atual) return { ok: false, error: "Add-on nao encontrado." };

  const info = getAddon(atual.tipo as AddonTipo, novoPacote);
  if (!info) return { ok: false, error: "Pacote invalido." };

  const { error } = await admin
    .from("addons_tenant")
    .update({
      pacote: info.pacote,
      preco: info.preco,
      quantidade: info.quantidade,
    })
    .eq("id", addonId)
    .eq("tenant_id", ctx.tenantId);

  if (error) {
    console.error("trocarPacoteAddon", error);
    return { ok: false, error: traduzirErro(error) };
  }

  revalidatePath("/configuracoes");
  return { ok: true, data: null };
}

export async function listarPacotes(
  tipo: AddonTipo,
): Promise<InfoAddon[]> {
  const tabela = tipo === "sms" ? ADDONS_SMS : ADDONS_IA;
  return Object.values(tabela);
}

// ---------------- Modulos ----------------

export async function getModulosAtivos(): Promise<Result<ModulosAtivos>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tenants")
    .select("plano, modulos_ativos")
    .eq("id", ctx.tenantId)
    .maybeSingle();

  if (error) return { ok: false, error: traduzirErro(error) };

  const modulos = normalizarModulosAtivos(
    data?.modulos_ativos,
    (data?.plano as string | null) ?? "trial",
  );
  return { ok: true, data: modulos };
}

export async function toggleModulo(
  modulo: ModuloId,
  ativo: boolean,
): Promise<Result<ModulosAtivos>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data: tenant, error: errTenant } = await admin
    .from("tenants")
    .select("plano, modulos_ativos")
    .eq("id", ctx.tenantId)
    .maybeSingle();

  if (errTenant) return { ok: false, error: traduzirErro(errTenant) };
  const plano = (tenant?.plano as string | null) ?? "trial";

  if (ativo && !moduloDisponivelNoPlano(plano, modulo)) {
    return {
      ok: false,
      error: "Modulo indisponivel no seu plano. Faca upgrade para Clinica.",
    };
  }

  const atual = normalizarModulosAtivos(tenant?.modulos_ativos, plano);
  const novos: ModulosAtivos = { ...atual, [modulo]: ativo };

  const { error } = await admin
    .from("tenants")
    .update({ modulos_ativos: novos })
    .eq("id", ctx.tenantId);

  if (error) {
    console.error("toggleModulo", error);
    return { ok: false, error: traduzirErro(error) };
  }

  revalidatePath("/configuracoes");
  revalidatePath("/", "layout");
  return { ok: true, data: novos };
}

// Nao re-exportar constantes/objetos a partir deste arquivo: arquivos
// 'use server' so podem exportar funcoes async. Clientes devem importar
// ADDONS_IA, ADDONS_SMS, DEGUSTACAO_IA, DEGUSTACAO_SMS, MODULOS_PADRAO
// diretamente de '@/lib/planos'.
