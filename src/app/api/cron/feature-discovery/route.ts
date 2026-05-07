import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  emailFuncionalidadeNaoUsada,
  type FuncionalidadeKey,
} from "@/lib/email-templates";
import { enviarNotificacaoEmail } from "@/lib/notificacoes";
import { normalizarModulosAtivos } from "@/lib/planos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

function checaAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

interface FuncionalidadeMeta {
  key: FuncionalidadeKey;
  nome: string;
  descricao: string;
  comoUsar: string;
  iconeEmoji: string;
  textoCTA: string;
  caminho: string;
}

const FUNCIONALIDADES: Record<FuncionalidadeKey, FuncionalidadeMeta> = {
  estoque: {
    key: "estoque",
    nome: "Controle de estoque",
    descricao: "Controle seus materiais e produtos com alertas de baixa.",
    comoUsar:
      "Cadastre seus produtos, registre movimentacoes e receba avisos quando estiver acabando.",
    iconeEmoji: "📦",
    textoCTA: "Ir para estoque",
    caminho: "/estoque",
  },
  relatorios: {
    key: "relatorios",
    nome: "Relatorios",
    descricao: "Veja como esta seu consultorio em numeros.",
    comoUsar:
      "Acompanhe atendimentos, faturamento e tendencias para tomar decisoes melhores.",
    iconeEmoji: "📊",
    textoCTA: "Ver relatorios",
    caminho: "/relatorios",
  },
  plano_tratamento: {
    key: "plano_tratamento",
    nome: "Planos de tratamento",
    descricao: "Crie planos de tratamento personalizados para seus pacientes.",
    comoUsar:
      "Encadeie sessoes, controle a evolucao e finalize com alta automatica.",
    iconeEmoji: "🩺",
    textoCTA: "Conhecer planos",
    caminho: "/pacientes",
  },
  transcricao: {
    key: "transcricao",
    nome: "Transcricao de audio",
    descricao: "Grave e transcreva evolucoes com IA enquanto atende.",
    comoUsar:
      "Foque no paciente — a IA escreve a evolucao por voce em segundos.",
    iconeEmoji: "🎙️",
    textoCTA: "Ativar transcricao",
    caminho: "/configuracoes",
  },
  pre_consulta: {
    key: "pre_consulta",
    nome: "Pre-consulta",
    descricao: "Pacientes preenchem dados antes da consulta.",
    comoUsar:
      "Compartilhe um link com seus pacientes — eles preenchem cadastro e anamnese antes do atendimento.",
    iconeEmoji: "📝",
    textoCTA: "Ver link de pre-consulta",
    caminho: "/configuracoes",
  },
};

interface TenantInfo {
  id: string;
  slug: string | null;
  plano: string | null;
  modulos_ativos: unknown;
}

interface ProfInfo {
  id: string;
  user_id: string | null;
  nome: string;
  email: string | null;
  logo_url: string | null;
  // Pode nao existir como coluna; lemos best-effort.
  enviar_dicas_features?: boolean | null;
}

async function detectarOportunidades(
  admin: ReturnType<typeof createAdminClient>,
  tenant: TenantInfo,
): Promise<FuncionalidadeKey[]> {
  const oportunidades: FuncionalidadeKey[] = [];
  const modulos = normalizarModulosAtivos(tenant.modulos_ativos, tenant.plano);

  // Estoque: modulo desligado ou sem produtos
  if (!modulos.estoque) {
    oportunidades.push("estoque");
  } else {
    const { count } = await admin
      .from("produtos_estoque")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id);
    if ((count ?? 0) === 0) oportunidades.push("estoque");
  }

  // Plano de tratamento: modulo desligado ou sem planos cadastrados
  if (!modulos.planos_tratamento) {
    oportunidades.push("plano_tratamento");
  } else {
    const { count } = await admin
      .from("planos_tratamento")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id);
    if ((count ?? 0) === 0) oportunidades.push("plano_tratamento");
  }

  // Transcricao: nunca usou
  try {
    const { count } = await admin
      .from("uso_transcricao")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id);
    if ((count ?? 0) === 0) oportunidades.push("transcricao");
  } catch {
    // tabela pode nao existir em ambientes antigos
  }

  // Pre-consulta: nunca recebeu pre-anamnese (paciente_id em anamneses publicas)
  try {
    const { count } = await admin
      .from("anamneses")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .eq("origem", "pre_consulta");
    if ((count ?? 0) === 0) oportunidades.push("pre_consulta");
  } catch {
    // ignore
  }

  // Relatorios: heuristica simples — sempre ofereceriamos. So sugerimos se
  // o tenant ainda tem poucos atendimentos concluidos (menos de 5).
  try {
    const { count } = await admin
      .from("agendamentos")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .eq("status", "concluido");
    if ((count ?? 0) >= 5) oportunidades.push("relatorios");
  } catch {
    // ignore
  }

  return oportunidades;
}

function escolherFuncionalidade(
  candidatas: FuncionalidadeKey[],
  tenantId: string,
): FuncionalidadeKey | null {
  if (candidatas.length === 0) return null;
  // Rotacao deterministica por (tenant + quinzena) — mesma quinzena nao repete
  // a sugestao para o mesmo tenant em multiplas execucoes.
  const d = new Date();
  const quinzena = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate() < 15 ? "1" : "2"}`;
  let h = 0;
  const seed = `${tenantId}:${quinzena}`;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return candidatas[h % candidatas.length];
}

export async function GET(req: Request) {
  if (!checaAuth(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const admin = createAdminClient();
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  const { data: tenants, error } = await admin
    .from("tenants")
    .select("id, slug, plano, modulos_ativos");
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  let processados = 0;
  let enviados = 0;
  let pulados = 0;

  for (const tRaw of tenants ?? []) {
    processados += 1;
    const tenant = tRaw as TenantInfo;

    // Profissional principal (criador) para destinatario do email.
    const { data: profRows } = await admin
      .from("profissionais")
      .select("id, user_id, nome, email, logo_url, enviar_dicas_features")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: true });
    const prof = (profRows ?? []).find(
      (p) => (p as ProfInfo).user_id,
    ) as ProfInfo | undefined;
    if (!prof || !prof.email) {
      pulados += 1;
      continue;
    }

    // Opt-out: se o profissional desativou explicitamente, nao envia.
    // Default true (envia) — campo pode nao existir e vir undefined.
    if (prof.enviar_dicas_features === false) {
      pulados += 1;
      continue;
    }

    const oportunidades = await detectarOportunidades(admin, tenant);
    const escolhida = escolherFuncionalidade(oportunidades, tenant.id);
    if (!escolhida) {
      pulados += 1;
      continue;
    }

    const meta = FUNCIONALIDADES[escolhida];
    const linkCTA = appUrl
      ? `${appUrl.replace(/\/+$/, "")}${meta.caminho}`
      : meta.caminho;
    const configLink = appUrl
      ? `${appUrl.replace(/\/+$/, "")}/configuracoes`
      : "/configuracoes";

    const tpl = emailFuncionalidadeNaoUsada({
      nome: prof.nome ?? "Profissional",
      funcionalidadeNome: meta.nome,
      iconeEmoji: meta.iconeEmoji,
      descricao: meta.descricao,
      comoUsar: meta.comoUsar,
      linkCTA,
      textoCTA: meta.textoCTA,
      funcionalidadeKey: meta.key,
      configLink,
      logoUrl: prof.logo_url,
    });

    const r = await enviarNotificacaoEmail({
      tenantId: tenant.id,
      agendamentoId: null,
      tipo: "feature_discovery",
      destino: prof.email,
      assunto: tpl.assunto,
      html: tpl.html,
    });
    if (r.ok) enviados += 1;
  }

  return NextResponse.json({
    ok: true,
    processados,
    enviados,
    pulados,
  });
}
