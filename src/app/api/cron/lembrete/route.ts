import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  emailLembrete24h,
  horarioFromIso,
  montarLinkAgendamento,
} from "@/lib/email-templates";
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
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const agora = new Date();
  const amanha = new Date(agora);
  amanha.setUTCDate(amanha.getUTCDate() + 1);
  const yyyy = amanha.getUTCFullYear();
  const mm = String(amanha.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(amanha.getUTCDate()).padStart(2, "0");
  const dataAlvo = `${yyyy}-${mm}-${dd}`;
  const inicio = `${dataAlvo}T00:00:00.000Z`;
  const fim = `${dataAlvo}T23:59:59.999Z`;

  const { data: agendamentos, error } = await admin
    .from("agendamentos")
    .select(
      "id, data_hora, status, tenant_id, paciente_id, profissional_id",
    )
    .in("status", ["agendado", "confirmado"])
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
    .eq("tipo", "lembrete_24h")
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
  const tenantIds = Array.from(
    new Set(pendentes.map((a) => a.tenant_id as string)),
  );

  const [
    { data: pacientes },
    { data: profissionais },
    { data: tenants },
  ] = await Promise.all([
    admin.from("pacientes").select("id, nome, email").in("id", pacIds),
    admin.from("profissionais").select("id, nome, logo_url").in("id", profIds),
    admin
      .from("tenants")
      .select("id, slug, endereco, cidade, estado")
      .in("id", tenantIds),
  ]);

  const pacMap = new Map<string, { nome: string; email: string | null }>();
  for (const p of pacientes ?? []) {
    pacMap.set(p.id as string, {
      nome: (p.nome as string) ?? "Paciente",
      email: (p.email as string | null) ?? null,
    });
  }
  const profMap = new Map<string, { nome: string; logoUrl: string | null }>();
  for (const p of profissionais ?? []) {
    profMap.set(p.id as string, {
      nome: (p.nome as string) ?? "Profissional",
      logoUrl: (p.logo_url as string | null) ?? null,
    });
  }
  const tenantMap = new Map<
    string,
    {
      slug: string | null;
      endereco: string | null;
      cidade: string | null;
      estado: string | null;
    }
  >();
  for (const t of tenants ?? []) {
    tenantMap.set(t.id as string, {
      slug: (t.slug as string | null) ?? null,
      endereco: (t.endereco as string | null) ?? null,
      cidade: (t.cidade as string | null) ?? null,
      estado: (t.estado as string | null) ?? null,
    });
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  let enviados = 0;
  for (const ag of pendentes) {
    const pac = pacMap.get(ag.paciente_id as string);
    if (!pac?.email) continue;
    const profInfo = profMap.get(ag.profissional_id as string);
    const profNome = profInfo?.nome ?? "Profissional";
    const dataHoraIso = ag.data_hora as string;
    const tenantInfo = tenantMap.get(ag.tenant_id as string);
    const slug = tenantInfo?.slug ?? null;
    const linkAgendamento = montarLinkAgendamento(appUrl, slug);
    const tpl = emailLembrete24h({
      pacienteNome: pac.nome,
      profissionalNome: profNome,
      horario: horarioFromIso(dataHoraIso),
      linkAgendamento,
      logoUrl: profInfo?.logoUrl ?? null,
      endereco: tenantInfo?.endereco ?? null,
      cidade: tenantInfo?.cidade ?? null,
      estado: tenantInfo?.estado ?? null,
    });
    const result = await enviarNotificacaoEmail({
      tenantId: ag.tenant_id as string,
      agendamentoId: ag.id as string,
      tipo: "lembrete_24h",
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
