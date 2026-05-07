import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  capitalizeNome,
  dataPorExtenso,
  emailFollowupConsulta,
} from "@/lib/email-templates";
import { enviarNotificacaoEmail } from "@/lib/notificacoes";
import { getTenantEmailSignature } from "@/lib/tenant-email-signature";
import {
  getAniversariantesHoje,
  getPacientesInativos,
} from "@/actions/comunicacao";
import {
  mensagemAniversario,
  mensagemSentimosFalta,
} from "@/lib/whatsapp-templates";
import type { ContatoPreferencial } from "@/actions/pacientes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

function escapeHtmlSimple(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function diffDiasIso(aIso: string, bIso: string): number {
  const [ay, am, ad] = aIso.split("-").map(Number);
  const [by, bm, bd] = bIso.split("-").map(Number);
  const a = Date.UTC(ay, am - 1, ad);
  const b = Date.UTC(by, bm - 1, bd);
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}

function hojeIsoUTC(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function checaAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!checaAuth(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const admin = createAdminClient();

  // Janela: agendamentos concluidos de "ontem" (UTC)
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setUTCDate(ontem.getUTCDate() - 1);
  const yyyy = ontem.getUTCFullYear();
  const mm = String(ontem.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(ontem.getUTCDate()).padStart(2, "0");
  const dataAlvo = `${yyyy}-${mm}-${dd}`;
  const inicio = `${dataAlvo}T00:00:00.000Z`;
  const fim = `${dataAlvo}T23:59:59.999Z`;

  const { data: agendamentos, error } = await admin
    .from("agendamentos")
    .select(
      "id, data_hora, status, tenant_id, paciente_id, profissional_id",
    )
    .eq("status", "concluido")
    .gte("data_hora", inicio)
    .lte("data_hora", fim);
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const lista = agendamentos ?? [];
  if (lista.length === 0) {
    return NextResponse.json({ ok: true, processados: 0, enviados: 0 });
  }

  const ids = lista.map((a) => a.id as string);
  const { data: jaEnviadas } = await admin
    .from("notificacoes")
    .select("agendamento_id")
    .in("agendamento_id", ids)
    .eq("tipo", "followup")
    .eq("status", "enviado");
  const jaSet = new Set(
    (jaEnviadas ?? []).map((n) => n.agendamento_id as string),
  );

  const pendentes = lista.filter((a) => !jaSet.has(a.id as string));
  if (pendentes.length === 0) {
    return NextResponse.json({ ok: true, processados: 0, enviados: 0 });
  }

  const pacIds = Array.from(
    new Set(pendentes.map((a) => a.paciente_id as string)),
  );
  const profIds = Array.from(
    new Set(pendentes.map((a) => a.profissional_id as string)),
  );

  const [{ data: pacientes }, { data: profissionais }] = await Promise.all([
    admin.from("pacientes").select("id, nome, email").in("id", pacIds),
    admin
      .from("profissionais")
      .select(
        "id, nome, telefone, logo_url, enviar_followup, followup_mensagem",
      )
      .in("id", profIds),
  ]);

  const pacMap = new Map<string, { nome: string; email: string | null }>();
  for (const p of pacientes ?? []) {
    pacMap.set(p.id as string, {
      nome: (p.nome as string) ?? "Paciente",
      email: (p.email as string | null) ?? null,
    });
  }
  const profMap = new Map<
    string,
    {
      nome: string;
      telefone: string | null;
      logoUrl: string | null;
      enviar: boolean;
      mensagem: string | null;
    }
  >();
  for (const p of profissionais ?? []) {
    profMap.set(p.id as string, {
      nome: (p.nome as string) ?? "Profissional",
      telefone: (p.telefone as string | null) ?? null,
      logoUrl: (p.logo_url as string | null) ?? null,
      enviar: (p.enviar_followup as boolean | null) === false ? false : true,
      mensagem: (p.followup_mensagem as string | null) ?? null,
    });
  }

  let enviados = 0;
  for (const ag of pendentes) {
    const pac = pacMap.get(ag.paciente_id as string);
    if (!pac?.email) continue;
    const profInfo = profMap.get(ag.profissional_id as string);
    if (!profInfo || !profInfo.enviar) continue;

    const dataHoraIso = ag.data_hora as string;
    const dataIso = dataHoraIso.slice(0, 10);

    const assinatura = await getTenantEmailSignature(
      ag.tenant_id as string,
      ag.profissional_id as string,
    );
    const tpl = emailFollowupConsulta({
      pacienteNome: pac.nome,
      profissionalNome: profInfo.nome,
      dataIso,
      telefoneProfissional: profInfo.telefone,
      mensagemPersonalizada: profInfo.mensagem,
      logoUrl: profInfo.logoUrl,
      assinatura,
    });
    const result = await enviarNotificacaoEmail({
      tenantId: ag.tenant_id as string,
      agendamentoId: ag.id as string,
      tipo: "followup",
      destino: pac.email,
      assunto: tpl.assunto,
      html: tpl.html,
    });
    if (result.ok) enviados += 1;
  }

  // ============================================================
  // Mensagens automaticas de planos de tratamento
  // ============================================================
  let planosProcessados = 0;
  let planosEnviados = 0;

  try {
    const { data: planos } = await admin
      .from("planos_tratamento")
      .select(
        "id, tenant_id, profissional_id, paciente_id, nome, periodicidade_dias, mensagem_automatica, mensagem_texto",
      )
      .eq("status", "ativo")
      .eq("mensagem_automatica", true);

    const planosLista = planos ?? [];
    const hojeIso = hojeIsoUTC();
    const tresDiasAdiante = new Date();
    tresDiasAdiante.setUTCDate(tresDiasAdiante.getUTCDate() + 3);
    const limiteAdianteIso = `${tresDiasAdiante.getUTCFullYear()}-${String(tresDiasAdiante.getUTCMonth() + 1).padStart(2, "0")}-${String(tresDiasAdiante.getUTCDate()).padStart(2, "0")}`;

    // Cache de pacientes/profissionais/tenant nao reaproveitavel facilmente; busca individual
    for (const plano of planosLista) {
      planosProcessados += 1;

      // Proxima sessao pendente (status pendente, data >= hoje)
      const { data: proxPendente } = await admin
        .from("sessoes_plano")
        .select("id, data_prevista, status")
        .eq("plano_id", plano.id as string)
        .eq("status", "pendente")
        .gte("data_prevista", hojeIso)
        .lte("data_prevista", limiteAdianteIso)
        .order("data_prevista", { ascending: true })
        .limit(1)
        .maybeSingle();

      // Ultima sessao realizada (para mensagem personalizada)
      const { data: ultimaRealizada } = await admin
        .from("sessoes_plano")
        .select("data_prevista, status")
        .eq("plano_id", plano.id as string)
        .eq("status", "realizada")
        .order("data_prevista", { ascending: false })
        .limit(1)
        .maybeSingle();

      const periodicidade = Number(plano.periodicidade_dias) || 0;
      const mensagemTexto = (plano.mensagem_texto as string | null) ?? null;
      const haMensagemPersonalizada =
        Boolean(mensagemTexto) &&
        ultimaRealizada &&
        periodicidade > 0 &&
        diffDiasIso(
          hojeIso,
          ultimaRealizada.data_prevista as string,
        ) >= Math.floor(periodicidade / 2);

      if (!proxPendente && !haMensagemPersonalizada) continue;

      // Carrega paciente + profissional + tenant
      const [{ data: pac }, { data: prof }, { data: tenant }] =
        await Promise.all([
          admin
            .from("pacientes")
            .select("nome, email")
            .eq("id", plano.paciente_id as string)
            .maybeSingle(),
          admin
            .from("profissionais")
            .select("nome, logo_url, telefone")
            .eq("id", plano.profissional_id as string)
            .maybeSingle(),
          admin
            .from("tenants")
            .select("nome_empresa")
            .eq("id", plano.tenant_id as string)
            .maybeSingle(),
        ]);
      const destino = (pac?.email as string | null) ?? null;
      if (!destino) continue;

      const nome = capitalizeNome((pac?.nome as string | null) ?? "Paciente");
      const profNome = capitalizeNome(
        (prof?.nome as string | null) ?? "Profissional",
      );
      const empresaNome =
        (tenant?.nome_empresa as string | null) ?? "Sua clinica";

      const partes: string[] = [
        `<p style="margin:0 0 12px 0;font-size:16px;font-weight:600;">Ola, ${escapeHtmlSimple(nome)}!</p>`,
      ];

      if (proxPendente) {
        const dataExt = dataPorExtenso(
          proxPendente.data_prevista as string,
        );
        partes.push(
          `<p style="margin:0 0 12px 0;color:#0F172A;">Sua proxima sessao do plano <strong>${escapeHtmlSimple((plano.nome as string) ?? "tratamento")}</strong> esta prevista para <strong>${escapeHtmlSimple(dataExt)}</strong>. Entre em contato para agendar!</p>`,
        );
      }

      if (haMensagemPersonalizada && mensagemTexto) {
        partes.push(
          `<p style="margin:16px 0 0 0;padding:12px;background-color:#F0FDFA;border-left:3px solid #0D9488;color:#0F172A;">${escapeHtmlSimple(mensagemTexto)}</p>`,
        );
      }

      partes.push(
        `<p style="margin:20px 0 0 0;color:#475569;font-size:13px;">Atenciosamente,<br>${escapeHtmlSimple(profNome)} — ${escapeHtmlSimple(empresaNome)}</p>`,
      );

      const html = `<!DOCTYPE html><html lang="pt-BR"><body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0F172A;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F8FAFC;padding:24px 0;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;"><tr><td style="background:#0D9488;padding:18px 24px;"><p style="margin:0;color:#FFFFFF;font-size:14px;font-weight:600;">Sua Agenda Online</p></td></tr><tr><td style="padding:24px;font-size:14px;line-height:1.6;">${partes.join("")}</td></tr><tr><td style="padding:16px 24px;background:#F1F5F9;border-top:1px solid #E2E8F0;text-align:center;"><p style="margin:0;color:#64748B;font-size:12px;">Sua Agenda Online</p></td></tr></table></td></tr></table></body></html>`;

      const assunto = proxPendente
        ? `Proxima sessao: ${(plano.nome as string) ?? "Plano"}`
        : `Continue seu tratamento — ${(plano.nome as string) ?? "Plano"}`;

      const env = await enviarNotificacaoEmail({
        tenantId: plano.tenant_id as string,
        agendamentoId: null,
        tipo: "followup",
        destino,
        assunto,
        html,
      });
      if (env.ok) planosEnviados += 1;
    }
  } catch (e) {
    console.error("[cron/followup] erro planos:", e);
  }

  // ============================================================
  // Tarefas de aniversario + pacientes inativos por tenant
  // ============================================================
  let aniversarioCriadas = 0;
  let inativosCriados = 0;

  try {
    const { data: tenants } = await admin
      .from("tenants")
      .select("id, slug");
    const tenantsLista = (tenants ?? []) as Array<{
      id: string;
      slug: string | null;
    }>;

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
    const hojeIso = hojeIsoUTC();
    const limiteSentimosFaltaIso = (() => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - 30);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    })();

    for (const tenant of tenantsLista) {
      // Profissional principal do tenant para vincular as tarefas. Se houver
      // mais de um, escolhemos o primeiro com user_id (criador). Tarefas
      // ficam visiveis ao profissional dono.
      const { data: profsTenant } = await admin
        .from("profissionais")
        .select("id, user_id")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: true });
      const profDono = (profsTenant ?? []).find((p) => p.user_id) ??
        (profsTenant ?? [])[0];
      if (!profDono) continue;

      const linkAgendamento =
        appUrl && tenant.slug
          ? `${appUrl.replace(/\/+$/, "")}/agendar/${tenant.slug}`
          : null;

      // ----- Aniversariantes -----
      const aniversariantes = await getAniversariantesHoje(tenant.id);
      if (aniversariantes.length > 0) {
        const pacIdsAniv = aniversariantes.map((p) => p.id);
        const { data: jaAniv } = await admin
          .from("aftercare_tarefas")
          .select("paciente_id")
          .eq("tenant_id", tenant.id)
          .eq("tipo", "personalizado")
          .eq("data_prevista", hojeIso)
          .in("paciente_id", pacIdsAniv)
          .ilike("mensagem", "%feliz aniversario%");
        const jaSetAniv = new Set(
          (jaAniv ?? []).map((r) => r.paciente_id as string),
        );
        const novosAniv = aniversariantes.filter(
          (p) => !jaSetAniv.has(p.id),
        );
        if (novosAniv.length > 0) {
          const linhas = novosAniv.map((p) => ({
            tenant_id: tenant.id,
            profissional_id: profDono.id as string,
            paciente_id: p.id,
            agendamento_id: null,
            dia_sequencia: 0,
            tipo: "personalizado",
            mensagem: mensagemAniversario({ nome: p.nome }),
            canal: p.contato_preferencial as ContatoPreferencial,
            status: "pendente",
            data_prevista: hojeIso,
          }));
          const { error: insErr } = await admin
            .from("aftercare_tarefas")
            .insert(linhas);
          if (insErr) {
            console.error("[cron/followup] aniv insert:", insErr.message);
          } else {
            aniversarioCriadas += linhas.length;
          }
        }
      }

      // ----- Pacientes inativos (>90 dias) -----
      const inativos = await getPacientesInativos(tenant.id, 90);
      if (inativos.length > 0) {
        const pacIdsInat = inativos.map((p) => p.id);
        const { data: jaInat } = await admin
          .from("aftercare_tarefas")
          .select("paciente_id")
          .eq("tenant_id", tenant.id)
          .eq("tipo", "personalizado")
          .gte("data_prevista", limiteSentimosFaltaIso)
          .in("paciente_id", pacIdsInat)
          .ilike("mensagem", "%sentimos sua falta%");
        const jaSetInat = new Set(
          (jaInat ?? []).map((r) => r.paciente_id as string),
        );
        const novosInat = inativos.filter((p) => !jaSetInat.has(p.id));
        if (novosInat.length > 0) {
          const linhas = novosInat.map((p) => {
            const dias = p.ultimo_agendamento_data
              ? diffDiasIso(hojeIso, p.ultimo_agendamento_data)
              : 90;
            return {
              tenant_id: tenant.id,
              profissional_id: profDono.id as string,
              paciente_id: p.id,
              agendamento_id: null,
              dia_sequencia: 0,
              tipo: "personalizado",
              mensagem: mensagemSentimosFalta({
                nome: p.nome,
                diasInativo: dias,
                linkAgendamento,
              }),
              canal: p.contato_preferencial as ContatoPreferencial,
              status: "pendente",
              data_prevista: hojeIso,
            };
          });
          const { error: insErr } = await admin
            .from("aftercare_tarefas")
            .insert(linhas);
          if (insErr) {
            console.error("[cron/followup] inat insert:", insErr.message);
          } else {
            inativosCriados += linhas.length;
          }
        }
      }
    }
  } catch (e) {
    console.error("[cron/followup] erro aniv/inativos:", e);
  }

  return NextResponse.json({
    ok: true,
    processados: pendentes.length,
    enviados,
    planos_processados: planosProcessados,
    planos_enviados: planosEnviados,
    aniversario_criadas: aniversarioCriadas,
    inativos_criados: inativosCriados,
  });
}
