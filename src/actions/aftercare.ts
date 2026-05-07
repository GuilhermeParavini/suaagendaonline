"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { ContatoPreferencial } from "@/actions/pacientes";

// ============================================================
// Tipos
// ============================================================

export type AftercareTipo =
  | "como_esta"
  | "lembrete_cuidados"
  | "retorno"
  | "personalizado";
export type AftercareCanal = ContatoPreferencial;
export type AftercareStatus = "pendente" | "enviado" | "pulado";

/**
 * Subtipo derivado da mensagem para tarefas com `tipo='personalizado'`.
 * Permite que a UI escolha icone/cor sem precisar de coluna extra no banco.
 */
export type AftercareSubtipo = "aniversario" | "sentimos_falta" | "personalizado";

function inferirSubtipo(
  tipo: AftercareTipo,
  mensagem: string,
): AftercareSubtipo | null {
  if (tipo !== "personalizado") return null;
  const m = mensagem.toLowerCase();
  if (m.includes("feliz aniversario")) return "aniversario";
  if (m.includes("sentimos sua falta") || m.includes("nao nos vemos"))
    return "sentimos_falta";
  return "personalizado";
}

export interface AftercareTarefa {
  id: string;
  tenant_id: string;
  profissional_id: string;
  paciente_id: string;
  agendamento_id: string;
  dia_sequencia: number;
  tipo: AftercareTipo;
  mensagem: string;
  canal: AftercareCanal;
  status: AftercareStatus;
  data_prevista: string;
  data_enviado: string | null;
  created_at: string;
}

export interface AftercarePendenteItem {
  id: string;
  agendamento_id: string | null;
  dia_sequencia: number;
  tipo: AftercareTipo;
  subtipo: AftercareSubtipo | null;
  mensagem: string;
  canal: AftercareCanal;
  status: AftercareStatus;
  data_prevista: string;
  data_consulta: string | null;
  diasDesdeConsulta: number | null;
  paciente: {
    id: string;
    nome: string;
    telefone: string | null;
    email: string | null;
  };
}

interface DadosAgendamentoParaAftercare {
  id: string;
  data_hora: string;
  paciente_id: string;
  profissional_id: string;
  tenant_id: string;
}

const TIPOS_VALIDOS: AftercareTipo[] = [
  "como_esta",
  "lembrete_cuidados",
  "retorno",
  "personalizado",
];

const STATUS_VALIDOS: AftercareStatus[] = [
  "pendente",
  "enviado",
  "pulado",
];

const CANAIS_VALIDOS: AftercareCanal[] = [
  "whatsapp",
  "telefone",
  "email",
  "sms",
];

function parseTipo(v: unknown): AftercareTipo {
  return TIPOS_VALIDOS.includes(v as AftercareTipo)
    ? (v as AftercareTipo)
    : "como_esta";
}

function parseStatus(v: unknown): AftercareStatus {
  return STATUS_VALIDOS.includes(v as AftercareStatus)
    ? (v as AftercareStatus)
    : "pendente";
}

function parseCanal(v: unknown): AftercareCanal {
  return CANAIS_VALIDOS.includes(v as AftercareCanal)
    ? (v as AftercareCanal)
    : "whatsapp";
}

function primeiroNome(nome: string): string {
  const t = nome.trim();
  if (!t) return "";
  return t.split(/\s+/)[0];
}

function addDiasIso(dataIso: string, dias: number): string {
  const [y, m, d] = dataIso.split("-").map(Number);
  const base = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  base.setUTCDate(base.getUTCDate() + dias);
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}-${String(base.getUTCDate()).padStart(2, "0")}`;
}

function dataIsoFromTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function diffDiasIso(aIso: string, bIso: string): number {
  const [ay, am, ad] = aIso.split("-").map(Number);
  const [by, bm, bd] = bIso.split("-").map(Number);
  const a = Date.UTC(ay, (am ?? 1) - 1, ad ?? 1);
  const b = Date.UTC(by, (bm ?? 1) - 1, bd ?? 1);
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}

function hojeIsoUTC(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

interface MensagemDef {
  dia: number;
  tipo: AftercareTipo;
  build: (ctx: { nomePaciente: string; linkAgendamento: string | null }) => string;
}

const SEQUENCIA: MensagemDef[] = [
  {
    dia: 1,
    tipo: "como_esta",
    build: ({ nomePaciente }) =>
      `Ola ${primeiroNome(nomePaciente)}! Como voce esta se sentindo apos a consulta de ontem? Qualquer duvida, estou a disposicao!`,
  },
  {
    dia: 3,
    tipo: "lembrete_cuidados",
    build: ({ nomePaciente }) =>
      `Ola ${primeiroNome(nomePaciente)}! Lembrete sobre os cuidados pos-consulta. Siga as orientacoes e qualquer duvida me procure!`,
  },
  {
    dia: 7,
    tipo: "retorno",
    build: ({ nomePaciente, linkAgendamento }) => {
      const base = `Ola ${primeiroNome(nomePaciente)}! Ja faz uma semana desde sua consulta. Que tal agendar um retorno?`;
      return linkAgendamento ? `${base} ${linkAgendamento}` : base;
    },
  },
];

function montarLinkAgendamento(slug: string | null): string | null {
  if (!slug) return null;
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/agendar/${slug}`;
}

// ============================================================
// criarSequenciaAftercare
// ============================================================

export type CriarAftercareResult =
  | { ok: true; criadas: number; jaExistia: boolean }
  | { ok: false; error: string };

/**
 * Cria 3 tarefas (dia 1, 3, 7) para o agendamento. Idempotente: se ja existirem
 * tarefas para o mesmo agendamento_id, retorna sem criar.
 */
export async function criarSequenciaAftercare(
  agendamentoId: string,
): Promise<CriarAftercareResult> {
  if (!agendamentoId || typeof agendamentoId !== "string") {
    return { ok: false, error: "Agendamento invalido." };
  }

  const admin = createAdminClient();

  // Idempotencia: se ja ha tarefas para esse agendamento, nao cria de novo.
  const { data: existentes, error: existentesErr } = await admin
    .from("aftercare_tarefas")
    .select("id")
    .eq("agendamento_id", agendamentoId)
    .limit(1);
  if (existentesErr) return { ok: false, error: existentesErr.message };
  if (existentes && existentes.length > 0) {
    return { ok: true, criadas: 0, jaExistia: true };
  }

  const { data: ag, error: agErr } = await admin
    .from("agendamentos")
    .select("id, data_hora, paciente_id, profissional_id, tenant_id")
    .eq("id", agendamentoId)
    .maybeSingle();
  if (agErr) return { ok: false, error: agErr.message };
  if (!ag) return { ok: false, error: "Agendamento nao encontrado." };

  const dadosAg = ag as DadosAgendamentoParaAftercare;

  const [{ data: paciente }, { data: tenant }] = await Promise.all([
    admin
      .from("pacientes")
      .select("id, nome, contato_preferencial")
      .eq("id", dadosAg.paciente_id)
      .maybeSingle(),
    admin
      .from("tenants")
      .select("slug")
      .eq("id", dadosAg.tenant_id)
      .maybeSingle(),
  ]);
  if (!paciente) return { ok: false, error: "Paciente nao encontrado." };

  const nomePaciente = (paciente.nome as string | null) ?? "Paciente";
  const canal = parseCanal(paciente.contato_preferencial);
  const slug = (tenant?.slug as string | null) ?? null;
  const linkAgendamento = montarLinkAgendamento(slug);
  const dataConsulta = dataIsoFromTimestamp(dadosAg.data_hora);

  const linhas = SEQUENCIA.map((s) => ({
    tenant_id: dadosAg.tenant_id,
    profissional_id: dadosAg.profissional_id,
    paciente_id: dadosAg.paciente_id,
    agendamento_id: dadosAg.id,
    dia_sequencia: s.dia,
    tipo: s.tipo,
    mensagem: s.build({ nomePaciente, linkAgendamento }),
    canal,
    status: "pendente" as AftercareStatus,
    data_prevista: addDiasIso(dataConsulta, s.dia),
  }));

  const { error: insertErr } = await admin
    .from("aftercare_tarefas")
    .insert(linhas);
  if (insertErr) return { ok: false, error: insertErr.message };

  return { ok: true, criadas: linhas.length, jaExistia: false };
}

// ============================================================
// getAftercarePendente
// ============================================================

export type GetAftercarePendenteResult =
  | { ok: true; data: AftercarePendenteItem[] }
  | { ok: false; error: string };

/**
 * Lista tarefas com status='pendente' e data_prevista <= hoje. Restrita ao
 * profissional logado (resolvido pela sessao). Usa createAdminClient para
 * leitura cross-tabela (com filtros por profissional_id manual para isolar).
 */
export async function getAftercarePendente(
  data?: string,
): Promise<GetAftercarePendenteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessao expirada." };

  const admin = createAdminClient();
  const { data: prof, error: profErr } = await admin
    .from("profissionais")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profErr) return { ok: false, error: profErr.message };
  if (!prof) return { ok: false, error: "Profissional nao encontrado." };

  const limite = data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : hojeIsoUTC();

  const { data: tarefas, error: tarefasErr } = await admin
    .from("aftercare_tarefas")
    .select(
      "id, agendamento_id, dia_sequencia, tipo, mensagem, canal, status, data_prevista, paciente_id",
    )
    .eq("profissional_id", prof.id as string)
    .eq("status", "pendente")
    .lte("data_prevista", limite)
    .order("data_prevista", { ascending: true });
  if (tarefasErr) return { ok: false, error: tarefasErr.message };

  const lista = tarefas ?? [];
  if (lista.length === 0) return { ok: true, data: [] };

  const pacIds = Array.from(
    new Set(lista.map((t) => t.paciente_id as string)),
  );
  const agIds = Array.from(
    new Set(
      lista
        .map((t) => t.agendamento_id as string | null)
        .filter((v): v is string => Boolean(v)),
    ),
  );

  const [{ data: pacientes }, agendamentosRes] = await Promise.all([
    admin
      .from("pacientes")
      .select("id, nome, telefone, email")
      .in("id", pacIds),
    agIds.length > 0
      ? admin
          .from("agendamentos")
          .select("id, data_hora")
          .in("id", agIds)
      : Promise.resolve({ data: [] as { id: string; data_hora: string }[] }),
  ]);
  const agendamentos = agendamentosRes.data;

  const pacMap = new Map<
    string,
    { nome: string; telefone: string | null; email: string | null }
  >();
  for (const p of pacientes ?? []) {
    pacMap.set(p.id as string, {
      nome: (p.nome as string) ?? "Paciente",
      telefone: (p.telefone as string | null) ?? null,
      email: (p.email as string | null) ?? null,
    });
  }
  const agMap = new Map<string, string>();
  for (const a of agendamentos ?? []) {
    agMap.set(a.id as string, a.data_hora as string);
  }

  const hoje = hojeIsoUTC();
  const itens: AftercarePendenteItem[] = lista.map((t) => {
    const agId = (t.agendamento_id as string | null) ?? null;
    const dhConsulta = agId ? agMap.get(agId) ?? null : null;
    const dataConsultaIso = dhConsulta ? dataIsoFromTimestamp(dhConsulta) : null;
    const dias = dataConsultaIso ? diffDiasIso(hoje, dataConsultaIso) : null;
    const pac = pacMap.get(t.paciente_id as string) ?? {
      nome: "Paciente",
      telefone: null,
      email: null,
    };
    const tipoTarefa = parseTipo(t.tipo);
    const mensagem = (t.mensagem as string) ?? "";
    return {
      id: t.id as string,
      agendamento_id: agId,
      dia_sequencia: Number(t.dia_sequencia ?? 0),
      tipo: tipoTarefa,
      subtipo: inferirSubtipo(tipoTarefa, mensagem),
      mensagem,
      canal: parseCanal(t.canal),
      status: parseStatus(t.status),
      data_prevista: t.data_prevista as string,
      data_consulta: dataConsultaIso,
      diasDesdeConsulta: dias,
      paciente: {
        id: t.paciente_id as string,
        nome: pac.nome,
        telefone: pac.telefone,
        email: pac.email,
      },
    };
  });

  return { ok: true, data: itens };
}

// ============================================================
// marcarAftercare
// ============================================================

export type MarcarAftercareResult = { ok: true } | { ok: false; error: string };

export async function marcarAftercare(
  tarefaId: string,
  status: "enviado" | "pulado",
): Promise<MarcarAftercareResult> {
  if (!tarefaId || typeof tarefaId !== "string") {
    return { ok: false, error: "Tarefa invalida." };
  }
  if (status !== "enviado" && status !== "pulado") {
    return { ok: false, error: "Status invalido." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessao expirada." };

  const admin = createAdminClient();
  const { data: prof, error: profErr } = await admin
    .from("profissionais")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profErr) return { ok: false, error: profErr.message };
  if (!prof) return { ok: false, error: "Profissional nao encontrado." };

  const { data: tarefa, error: tarefaErr } = await admin
    .from("aftercare_tarefas")
    .select("id, profissional_id")
    .eq("id", tarefaId)
    .maybeSingle();
  if (tarefaErr) return { ok: false, error: tarefaErr.message };
  if (!tarefa) return { ok: false, error: "Tarefa nao encontrada." };
  if (tarefa.profissional_id !== prof.id) {
    return { ok: false, error: "Sem permissao para esta tarefa." };
  }

  const { error: updErr } = await admin
    .from("aftercare_tarefas")
    .update({
      status,
      data_enviado: status === "enviado" ? new Date().toISOString() : null,
    })
    .eq("id", tarefaId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath("/");
  return { ok: true };
}

// ============================================================
// getAftercarePorPaciente
// ============================================================

export type GetAftercarePorPacienteResult =
  | { ok: true; data: AftercareTarefa[] }
  | { ok: false; error: string };

export async function getAftercarePorPaciente(
  pacienteId: string,
): Promise<GetAftercarePorPacienteResult> {
  if (!pacienteId || typeof pacienteId !== "string") {
    return { ok: false, error: "Paciente invalido." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessao expirada." };

  const admin = createAdminClient();
  const { data: prof, error: profErr } = await admin
    .from("profissionais")
    .select("id, tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profErr) return { ok: false, error: profErr.message };
  if (!prof) return { ok: false, error: "Profissional nao encontrado." };

  const { data: rows, error } = await admin
    .from("aftercare_tarefas")
    .select(
      "id, tenant_id, profissional_id, paciente_id, agendamento_id, dia_sequencia, tipo, mensagem, canal, status, data_prevista, data_enviado, created_at",
    )
    .eq("paciente_id", pacienteId)
    .eq("tenant_id", prof.tenant_id as string)
    .order("data_prevista", { ascending: false });
  if (error) return { ok: false, error: error.message };

  const data: AftercareTarefa[] = (rows ?? []).map((r) => ({
    id: r.id as string,
    tenant_id: r.tenant_id as string,
    profissional_id: r.profissional_id as string,
    paciente_id: r.paciente_id as string,
    agendamento_id: r.agendamento_id as string,
    dia_sequencia: Number(r.dia_sequencia ?? 0),
    tipo: parseTipo(r.tipo),
    mensagem: (r.mensagem as string) ?? "",
    canal: parseCanal(r.canal),
    status: parseStatus(r.status),
    data_prevista: r.data_prevista as string,
    data_enviado: (r.data_enviado as string | null) ?? null,
    created_at: r.created_at as string,
  }));

  return { ok: true, data };
}
