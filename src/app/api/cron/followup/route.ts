import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { emailFollowupConsulta } from "@/lib/email-templates";
import { enviarNotificacaoEmail } from "@/lib/notificacoes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

    const tpl = emailFollowupConsulta({
      pacienteNome: pac.nome,
      profissionalNome: profInfo.nome,
      dataIso,
      telefoneProfissional: profInfo.telefone,
      mensagemPersonalizada: profInfo.mensagem,
      logoUrl: profInfo.logoUrl,
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

  return NextResponse.json({
    ok: true,
    processados: pendentes.length,
    enviados,
  });
}
