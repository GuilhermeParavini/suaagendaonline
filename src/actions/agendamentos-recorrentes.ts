"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  capitalizeNome,
  emailAgendamentosRecorrentes,
  montarLinkAgendamento,
} from "@/lib/email-templates";
import { enviarNotificacaoEmail } from "@/lib/notificacoes";
import {
  getBloqueiosForProfissional,
  getFeriadosForTenant,
} from "@/lib/feriados-bloqueios";
import { getTenantEmailSignature } from "@/lib/tenant-email-signature";
import {
  calcularDatasRecorrencia,
  type ConflitoData,
  type CriarAgendamentosRecorrentesInput,
  type CriarAgendamentosRecorrentesResult,
  type FrequenciaRecorrencia,
} from "@/lib/recorrencia-utils";

// ============================================================
// Helpers
// ============================================================

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_HORA_RE = /^\d{2}:\d{2}$/;

function buildIsoDateTime(dataIso: string, hora: string): string {
  return `${dataIso}T${hora}:00.000Z`;
}

// ============================================================
// previewRecorrencia (server action chamado pelo client)
// ============================================================

export async function previewRecorrencia(input: {
  dataInicialIso: string;
  frequencia: FrequenciaRecorrencia;
  repeticoes: number;
}): Promise<{ ok: true; datas: string[] } | { ok: false; error: string }> {
  if (!ISO_DATE_RE.test(input.dataInicialIso)) {
    return { ok: false, error: "Data invalida." };
  }
  if (
    input.frequencia !== "semanal" &&
    input.frequencia !== "quinzenal" &&
    input.frequencia !== "mensal"
  ) {
    return { ok: false, error: "Frequencia invalida." };
  }
  const datas = calcularDatasRecorrencia(
    input.dataInicialIso,
    input.frequencia,
    input.repeticoes,
  );
  return { ok: true, datas };
}

// ============================================================
// criarAgendamentosRecorrentes
// ============================================================

export async function criarAgendamentosRecorrentes(
  input: CriarAgendamentosRecorrentesInput,
): Promise<CriarAgendamentosRecorrentesResult> {
  if (!ISO_DATE_RE.test(input.dataInicialIso)) {
    return { ok: false, error: "Data invalida." };
  }
  if (!ISO_HORA_RE.test(input.hora)) {
    return { ok: false, error: "Horario invalido." };
  }
  if (
    input.frequencia !== "semanal" &&
    input.frequencia !== "quinzenal" &&
    input.frequencia !== "mensal"
  ) {
    return { ok: false, error: "Frequencia invalida." };
  }
  const repeticoes = Math.max(1, Math.min(52, Math.floor(input.repeticoes)));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessao expirada." };

  const admin = createAdminClient();
  const { data: prof, error: profErr } = await admin
    .from("profissionais")
    .select(
      "id, tenant_id, tolerancia_atraso_min, intervalo_entre_consultas_min, nome, logo_url",
    )
    .eq("user_id", user.id)
    .maybeSingle();
  if (profErr) return { ok: false, error: profErr.message };
  if (!prof) return { ok: false, error: "Profissional nao encontrado." };

  const tenantId = prof.tenant_id as string;
  const profissionalId = prof.id as string;
  const intervaloEntreMin =
    (prof.intervalo_entre_consultas_min as number | null) ?? 0;
  const tolerancia = (prof.tolerancia_atraso_min as number | null) ?? 5;

  // Paciente
  const { data: pac, error: pacErr } = await admin
    .from("pacientes")
    .select("id, nome, email, tenant_id")
    .eq("id", input.pacienteId)
    .maybeSingle();
  if (pacErr) return { ok: false, error: pacErr.message };
  if (!pac || pac.tenant_id !== tenantId) {
    return { ok: false, error: "Paciente nao encontrado." };
  }

  // Procedimento
  const { data: proc, error: procErr } = await admin
    .from("procedimentos")
    .select("id, nome, duracao_min, tenant_id, ativo")
    .eq("id", input.procedimentoId)
    .maybeSingle();
  if (procErr) return { ok: false, error: procErr.message };
  if (!proc || proc.tenant_id !== tenantId || !proc.ativo) {
    return { ok: false, error: "Procedimento indisponivel." };
  }
  const duracaoMin = (proc.duracao_min as number) ?? 30;

  const datas = calcularDatasRecorrencia(
    input.dataInicialIso,
    input.frequencia,
    repeticoes,
  );
  if (datas.length === 0) {
    return { ok: false, error: "Nenhuma data calculada." };
  }

  // Carrega feriados e bloqueios cobrindo todo o range
  const dataInicio = datas[0];
  const dataFim = datas[datas.length - 1];
  const [feriados, bloqueios] = await Promise.all([
    getFeriadosForTenant(tenantId, dataInicio, dataFim).catch(() => []),
    getBloqueiosForProfissional(profissionalId, dataInicio, dataFim).catch(
      () => [],
    ),
  ]);
  const feriadosSet = new Set(feriados.map((f) => f.data));
  const isBloqueado = (iso: string) =>
    bloqueios.some((b) => iso >= b.data_inicio && iso <= b.data_fim);

  // Carrega agendamentos existentes que possam conflitar
  const { data: existentes, error: existErr } = await admin
    .from("agendamentos")
    .select("data_hora, duracao_min, status")
    .eq("profissional_id", profissionalId)
    .gte("data_hora", `${dataInicio}T00:00:00.000Z`)
    .lte("data_hora", `${dataFim}T23:59:59.999Z`)
    .neq("status", "cancelado");
  if (existErr) return { ok: false, error: existErr.message };

  const ocupados = (existentes ?? []).map((row) => {
    const start = new Date(row.data_hora as string).getTime();
    const dur = (row.duracao_min as number) ?? 30;
    return {
      start,
      end: start + (dur + intervaloEntreMin) * 60_000,
    };
  });

  const observacoes = input.observacoes?.trim() || null;
  const conflitos: ConflitoData[] = [];
  const linhasInsert: Array<Record<string, unknown>> = [];
  const datasParaInserir: string[] = [];
  const agora = Date.now();

  for (const dataIso of datas) {
    if (feriadosSet.has(dataIso)) {
      conflitos.push({ dataIso, motivo: "Feriado." });
      continue;
    }
    if (isBloqueado(dataIso)) {
      conflitos.push({ dataIso, motivo: "Bloqueio do profissional." });
      continue;
    }
    const slotIso = buildIsoDateTime(dataIso, input.hora);
    const startMs = new Date(slotIso).getTime();
    if (startMs <= agora) {
      conflitos.push({ dataIso, motivo: "Horario ja passou." });
      continue;
    }
    const endMs = startMs + (duracaoMin + intervaloEntreMin) * 60_000;
    const conflito = ocupados.some(
      (o) => startMs < o.end && endMs > o.start,
    );
    if (conflito) {
      conflitos.push({ dataIso, motivo: "Horario ja ocupado." });
      continue;
    }
    // Reserva no array de ocupados para que datas seguintes da mesma sequencia
    // detectem conflitos com outras datas que ja foram aceitas.
    ocupados.push({ start: startMs, end: endMs });

    linhasInsert.push({
      tenant_id: tenantId,
      profissional_id: profissionalId,
      paciente_id: pac.id as string,
      procedimento_id: proc.id as string,
      data_hora: slotIso,
      duracao_min: duracaoMin,
      status: "agendado",
      tolerancia_min: tolerancia,
      observacoes,
    });
    datasParaInserir.push(dataIso);
  }

  if (linhasInsert.length === 0) {
    return {
      ok: true,
      criados: 0,
      ids: [],
      datasCriadas: [],
      conflitos,
    };
  }

  const { data: inseridos, error: insErr } = await admin
    .from("agendamentos")
    .insert(linhasInsert)
    .select("id, data_hora");
  if (insErr) {
    return { ok: false, error: insErr.message };
  }

  const ids = (inseridos ?? []).map((r) => r.id as string);
  const datasCriadasOrdenadas = (inseridos ?? [])
    .map((r) => (r.data_hora as string).slice(0, 10))
    .sort();

  // Email consolidado ao paciente
  try {
    const destino = (pac.email as string | null) ?? null;
    if (destino && datasCriadasOrdenadas.length > 0) {
      const { data: tenant } = await admin
        .from("tenants")
        .select("slug")
        .eq("id", tenantId)
        .maybeSingle();
      const slug = (tenant?.slug as string | null) ?? null;
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ??
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
      const linkAgendamento = montarLinkAgendamento(baseUrl, slug);
      const assinatura = await getTenantEmailSignature(
        tenantId,
        profissionalId,
      );
      const tpl = emailAgendamentosRecorrentes({
        pacienteNome: capitalizeNome((pac.nome as string) ?? "Paciente"),
        profissionalNome: capitalizeNome(
          (prof.nome as string) ?? "Profissional",
        ),
        procedimentoNome: (proc.nome as string) ?? null,
        horario: input.hora,
        datasIso: datasCriadasOrdenadas,
        linkAgendamento,
        logoUrl: (prof.logo_url as string | null) ?? null,
        assinatura,
      });
      // Vincula a primeira ocorrencia para rastreabilidade
      await enviarNotificacaoEmail({
        tenantId,
        agendamentoId: ids[0] ?? null,
        tipo: "confirmacao",
        destino,
        assunto: tpl.assunto,
        html: tpl.html,
      });
    }
  } catch (e) {
    console.error("[recorrentes] erro email consolidado:", e);
  }

  revalidatePath("/agenda");

  return {
    ok: true,
    criados: ids.length,
    ids,
    datasCriadas: datasCriadasOrdenadas,
    conflitos,
  };
}
