import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { recalcularFechamentoInterno } from "@/actions/comissoes";
import {
  emailRelatorioAdmin,
  emailRelatorioProfissional,
  type DadosRelatorioAdminProfissional,
} from "@/lib/email-templates";
import { enviarNotificacaoEmail } from "@/lib/notificacoes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function checaAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function mesAnoAnterior(): string {
  const hoje = new Date();
  const ano = hoje.getUTCFullYear();
  const mes = hoje.getUTCMonth() + 1; // 1-12
  if (mes === 1) return `${ano - 1}-12`;
  return `${ano}-${pad2(mes - 1)}`;
}

const PLANOS_ELEGIVEIS = ["profissional", "clinica"];
const STATUS_ELEGIVEIS = ["ativo", "trial"];

type DetalhamentoFormaJson =
  | Record<string, number>
  | Record<string, { valor: number; quantidade: number }>
  | null;

function getValor(
  detalhamento: DetalhamentoFormaJson,
  forma: string,
): number {
  if (!detalhamento) return 0;
  const v = (detalhamento as Record<string, unknown>)[forma];
  if (typeof v === "number") return v;
  if (v && typeof v === "object") {
    const obj = v as { valor?: number };
    return Number(obj.valor) || 0;
  }
  return 0;
}

function chavesUnicas(detalhamentos: DetalhamentoFormaJson[]): string[] {
  const set = new Set<string>();
  for (const d of detalhamentos) {
    if (!d) continue;
    for (const k of Object.keys(d)) set.add(k);
  }
  return Array.from(set);
}

export async function GET(req: Request) {
  if (!checaAuth(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const admin = createAdminClient();
  const mesAno = mesAnoAnterior();

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  // 1) Tenants elegiveis
  const { data: tenants, error: tenantErr } = await admin
    .from("tenants")
    .select("id, nome_empresa, plano, status_assinatura")
    .in("plano", PLANOS_ELEGIVEIS)
    .in("status_assinatura", STATUS_ELEGIVEIS);
  if (tenantErr) {
    console.error("[fechamento-comissoes] erro tenants:", tenantErr.message);
    return NextResponse.json(
      { ok: false, error: tenantErr.message },
      { status: 500 },
    );
  }

  let tenantsProcessados = 0;
  let profissionaisProcessados = 0;
  let emailsEnviados = 0;
  const erros: string[] = [];

  for (const tenant of tenants ?? []) {
    const tenantId = tenant.id as string;
    const nomeEmpresa = (tenant.nome_empresa as string) ?? "Sua clinica";
    tenantsProcessados += 1;

    try {
      // 2) Profissionais com comissao ativa
      const { data: configs, error: cfgErr } = await admin
        .from("comissoes_profissional")
        .select("profissional_id")
        .eq("tenant_id", tenantId)
        .eq("ativo", true);
      if (cfgErr) {
        erros.push(`tenant ${tenantId} configs: ${cfgErr.message}`);
        continue;
      }

      const profIds = (configs ?? [])
        .map((c) => c.profissional_id as string)
        .filter(Boolean);

      // Logo + admin do tenant
      const { data: profs } = await admin
        .from("profissionais")
        .select("id, nome, email, role, ativo, logo_url")
        .eq("tenant_id", tenantId);
      const profMap = new Map<
        string,
        {
          id: string;
          nome: string;
          email: string | null;
          role: string;
          ativo: boolean;
          logo_url: string | null;
        }
      >();
      for (const p of profs ?? []) {
        profMap.set(p.id as string, {
          id: p.id as string,
          nome: (p.nome as string) ?? "",
          email: (p.email as string | null) ?? null,
          role: (p.role as string) ?? "profissional",
          ativo: Boolean(p.ativo),
          logo_url: (p.logo_url as string | null) ?? null,
        });
      }

      // Pega logo da clinica do primeiro admin (fallback)
      let logoUrlTenant: string | null = null;
      const adminProf = (profs ?? []).find(
        (p) => p.role === "admin" && p.ativo,
      );
      if (adminProf) {
        logoUrlTenant = (adminProf.logo_url as string | null) ?? null;
      }

      // 3) Recalcular fechamento de cada profissional
      const resumoProfissionais: DadosRelatorioAdminProfissional[] = [];
      for (const profId of profIds) {
        const prof = profMap.get(profId);
        if (!prof || !prof.ativo) continue;
        profissionaisProcessados += 1;

        const r = await recalcularFechamentoInterno(tenantId, profId, mesAno);
        if (!r.ok) {
          erros.push(`prof ${profId}: ${r.error}`);
          continue;
        }
        const fech = r.data;

        // Email do profissional
        try {
          if (prof.email) {
            const tpl = emailRelatorioProfissional({
              nome: prof.nome,
              mesAno,
              faturamentoBruto: fech.faturamento_bruto,
              totalAtendimentos: fech.total_atendimentos,
              detalhamentoPagamentos: fech.detalhamento_pagamentos,
              percentual: fech.percentual_aplicado,
              valorComissaoPercentual: fech.valor_comissao_percentual,
              valorFixoMensal: fech.valor_fixo_mensal,
              totalComissao: fech.total_comissao,
              valorLiquido: fech.valor_liquido,
              totalDespesas: fech.total_despesas,
              detalhamentoDespesas: fech.detalhamento_despesas,
              lucroReal: fech.lucro_real,
              appUrl,
              logoUrl: prof.logo_url ?? logoUrlTenant,
            });
            const env = await enviarNotificacaoEmail({
              tenantId,
              agendamentoId: null,
              tipo: "feedback",
              destino: prof.email,
              assunto: tpl.assunto,
              html: tpl.html,
            });
            if (env.ok) {
              emailsEnviados += 1;
              await admin
                .from("comissoes_mensais")
                .update({ email_profissional_enviado: true })
                .eq("id", fech.id);
            } else if (env.erro) {
              erros.push(`email prof ${profId}: ${env.erro}`);
            }
          }
        } catch (e) {
          console.error(
            "[fechamento-comissoes] erro email profissional:",
            e,
          );
          erros.push(
            `email prof ${profId}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }

        resumoProfissionais.push({
          nome: prof.nome,
          faturado: fech.faturamento_bruto,
          percentual: fech.percentual_aplicado,
          comissao: fech.valor_comissao_percentual,
          fixo: fech.valor_fixo_mensal,
          total: fech.total_comissao,
          status: fech.status,
        });
      }

      // 4) Email consolidado para o admin
      if (adminProf?.email) {
        try {
          // Dados consolidados
          const fechRows = await admin
            .from("comissoes_mensais")
            .select(
              "id, profissional_id, faturamento_bruto, total_atendimentos, detalhamento_pagamentos, valor_comissao_percentual, valor_fixo_mensal, total_comissao, status",
            )
            .eq("tenant_id", tenantId)
            .eq("mes_ano", mesAno);
          const fechs = fechRows.data ?? [];

          const faturamentoTotal = fechs.reduce(
            (acc, f) => acc + (Number(f.faturamento_bruto) || 0),
            0,
          );
          const totalAtendimentosGeral = fechs.reduce(
            (acc, f) => acc + (Number(f.total_atendimentos) || 0),
            0,
          );
          const ticketMedio =
            totalAtendimentosGeral > 0
              ? faturamentoTotal / totalAtendimentosGeral
              : 0;
          const totalComissoesReceber = fechs.reduce(
            (acc, f) =>
              acc +
              (f.status !== "pago"
                ? Number(f.valor_comissao_percentual) || 0
                : 0),
            0,
          );
          const totalFixosReceber = fechs.reduce(
            (acc, f) =>
              acc +
              (f.status !== "pago" ? Number(f.valor_fixo_mensal) || 0 : 0),
            0,
          );

          // Detalhamento agregado de pagamentos
          const detalhamentos = fechs.map(
            (f) =>
              f.detalhamento_pagamentos as DetalhamentoFormaJson,
          );
          const formas = chavesUnicas(detalhamentos);
          const detalhamentoPagamentosGeral: Record<string, number> = {};
          for (const forma of formas) {
            const total = detalhamentos.reduce(
              (acc, d) => acc + getValor(d, forma),
              0,
            );
            if (total > 0) detalhamentoPagamentosGeral[forma] = total;
          }

          // Admin tambem atende?
          const adminFech = fechs.find(
            (f) => f.profissional_id === adminProf.id,
          );
          const adminAtende = !!adminFech;
          const adminAtendimentos = adminFech
            ? Number(adminFech.total_atendimentos) || 0
            : 0;
          const adminFaturamento = adminFech
            ? Number(adminFech.faturamento_bruto) || 0
            : 0;

          const tpl = emailRelatorioAdmin({
            nomeAdmin: (adminProf.nome as string) ?? nomeEmpresa,
            mesAno,
            faturamentoTotal,
            totalAtendimentosGeral,
            ticketMedio,
            profissionais: resumoProfissionais,
            totalComissoesReceber,
            totalFixosReceber,
            detalhamentoPagamentosGeral:
              Object.keys(detalhamentoPagamentosGeral).length > 0
                ? detalhamentoPagamentosGeral
                : null,
            adminAtende,
            adminAtendimentos,
            adminFaturamento,
            appUrl,
            logoUrl: logoUrlTenant,
          });

          const env = await enviarNotificacaoEmail({
            tenantId,
            agendamentoId: null,
            tipo: "feedback",
            destino: adminProf.email as string,
            assunto: tpl.assunto,
            html: tpl.html,
          });
          if (env.ok) {
            emailsEnviados += 1;
            // Marca flag em todos os fechamentos do mes deste tenant
            await admin
              .from("comissoes_mensais")
              .update({ email_admin_enviado: true })
              .eq("tenant_id", tenantId)
              .eq("mes_ano", mesAno);
          } else if (env.erro) {
            erros.push(`email admin ${tenantId}: ${env.erro}`);
          }
        } catch (e) {
          console.error("[fechamento-comissoes] erro email admin:", e);
          erros.push(
            `email admin ${tenantId}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    } catch (e) {
      console.error("[fechamento-comissoes] erro tenant:", tenantId, e);
      erros.push(
        `tenant ${tenantId}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return NextResponse.json({
    ok: true,
    mes_ano: mesAno,
    tenants_processados: tenantsProcessados,
    profissionais_processados: profissionaisProcessados,
    emails_enviados: emailsEnviados,
    erros: erros.length > 0 ? erros : undefined,
  });
}
