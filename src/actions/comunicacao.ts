"use server";

import { createAdminClient } from "@/lib/supabase/server";
import type { ContatoPreferencial } from "@/actions/pacientes";

// ============================================================
// Tipos
// ============================================================

export interface PacienteAniversariante {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  contato_preferencial: ContatoPreferencial;
  data_nascimento: string;
}

export interface PacienteInativo {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  contato_preferencial: ContatoPreferencial;
  ultimo_agendamento_data: string | null;
}

const CONTATO_VALIDOS: ContatoPreferencial[] = [
  "whatsapp",
  "telefone",
  "email",
  "sms",
];

function parseContato(v: unknown): ContatoPreferencial {
  return CONTATO_VALIDOS.includes(v as ContatoPreferencial)
    ? (v as ContatoPreferencial)
    : "whatsapp";
}

function hojeUTC(): { mes: number; dia: number; iso: string } {
  const d = new Date();
  return {
    mes: d.getUTCMonth() + 1,
    dia: d.getUTCDate(),
    iso: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`,
  };
}

function subDiasIso(diasAtras: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - diasAtras);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// ============================================================
// getAniversariantesHoje
// ============================================================

/**
 * Lista pacientes do tenant cuja data_nascimento bate com hoje (UTC, mes/dia).
 * Filtra status_tratamento != 'inativo' para nao spammar pacientes desligados.
 *
 * Implementacao usa filtro client-side apos buscar `data_nascimento` de todos
 * os pacientes ativos do tenant. Em tenants grandes (>10k pacientes) deve ser
 * substituida por uma RPC que use EXTRACT no Postgres.
 */
export async function getAniversariantesHoje(
  tenantId: string,
): Promise<PacienteAniversariante[]> {
  if (!tenantId) return [];
  const admin = createAdminClient();
  const { mes, dia } = hojeUTC();

  const { data, error } = await admin
    .from("pacientes")
    .select(
      "id, nome, telefone, email, contato_preferencial, data_nascimento, status_tratamento",
    )
    .eq("tenant_id", tenantId)
    .not("data_nascimento", "is", null);
  if (error) {
    console.error("[comunicacao] getAniversariantesHoje:", error.message);
    return [];
  }

  const lista = (data ?? []).filter((p) => {
    const status = (p.status_tratamento as string | null) ?? null;
    if (status === "inativo") return false;
    const nasc = (p.data_nascimento as string | null) ?? null;
    if (!nasc) return false;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(nasc);
    if (!m) return false;
    return Number(m[2]) === mes && Number(m[3]) === dia;
  });

  return lista.map((p) => ({
    id: p.id as string,
    nome: (p.nome as string) ?? "Paciente",
    telefone: (p.telefone as string | null) ?? null,
    email: (p.email as string | null) ?? null,
    contato_preferencial: parseContato(p.contato_preferencial),
    data_nascimento: p.data_nascimento as string,
  }));
}

// ============================================================
// getPacientesInativos
// ============================================================

/**
 * Lista pacientes do tenant SEM agendamentos com data_hora >= (hoje - dias).
 * Exclui pacientes com status_tratamento = 'alta' (fluxo proprio) e 'inativo'.
 *
 * Estrategia (compativel com supabase-js): busca todos os pacientes do tenant
 * que NAO sao alta/inativo, depois busca o ultimo agendamento de cada um e
 * filtra os que estao alem do limite (ou nunca tiveram agendamento — esses
 * tambem entram pois passaram do limite por nunca terem ido).
 */
export async function getPacientesInativos(
  tenantId: string,
  diasInatividade: number = 90,
): Promise<PacienteInativo[]> {
  if (!tenantId) return [];
  const admin = createAdminClient();
  const limiteIso = subDiasIso(diasInatividade);

  const { data: pacientes, error } = await admin
    .from("pacientes")
    .select(
      "id, nome, telefone, email, contato_preferencial, status_tratamento, created_at",
    )
    .eq("tenant_id", tenantId)
    .not("status_tratamento", "in", '("alta","inativo")');
  if (error) {
    console.error("[comunicacao] getPacientesInativos:", error.message);
    return [];
  }

  const lista = pacientes ?? [];
  if (lista.length === 0) return [];

  const ids = lista.map((p) => p.id as string);

  // Busca o ultimo agendamento de cada paciente (status valido — exclui
  // cancelados/reagendados que nao representam contato real).
  const { data: ags, error: agsErr } = await admin
    .from("agendamentos")
    .select("paciente_id, data_hora, status")
    .in("paciente_id", ids)
    .in("status", ["concluido", "agendado", "confirmado", "em_atendimento", "faltou"])
    .order("data_hora", { ascending: false });
  if (agsErr) {
    console.error("[comunicacao] getPacientesInativos ags:", agsErr.message);
    return [];
  }

  const ultimoMap = new Map<string, string>();
  for (const a of ags ?? []) {
    const pid = a.paciente_id as string;
    if (!ultimoMap.has(pid)) {
      ultimoMap.set(pid, (a.data_hora as string).slice(0, 10));
    }
  }

  // Inativos: ultimo agendamento < limite OU nenhum agendamento e cadastro
  // anterior ao limite (caso contrario, paciente recem-criado seria avisado).
  const inativos = lista.filter((p) => {
    const ultimo = ultimoMap.get(p.id as string) ?? null;
    if (ultimo) {
      return ultimo < limiteIso;
    }
    const created = (p.created_at as string | null) ?? null;
    return created ? created.slice(0, 10) < limiteIso : false;
  });

  return inativos.map((p) => ({
    id: p.id as string,
    nome: (p.nome as string) ?? "Paciente",
    telefone: (p.telefone as string | null) ?? null,
    email: (p.email as string | null) ?? null,
    contato_preferencial: parseContato(p.contato_preferencial),
    ultimo_agendamento_data: ultimoMap.get(p.id as string) ?? null,
  }));
}
