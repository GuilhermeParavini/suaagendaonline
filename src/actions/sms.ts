"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  enviarSMS,
  verificarLimiteSMS,
  type EnviarSMSResult,
  type VerificarLimiteSMSResult,
} from "@/lib/sms-server";
import { templateSMSPersonalizado } from "@/lib/sms-templates";

// ============================================================
// Tipos
// ============================================================

export interface SMSLogItem {
  id: string;
  paciente_id: string | null;
  paciente_nome: string | null;
  telefone: string;
  tipo: string;
  mensagem: string;
  status: string;
  provedor: string | null;
  custo: number;
  created_at: string;
}

// ============================================================
// Helpers
// ============================================================

async function obterContexto(): Promise<
  | { ok: true; tenantId: string; profissionalId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessao expirada." };

  const admin = createAdminClient();
  const { data: prof, error } = await admin
    .from("profissionais")
    .select("id, tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!prof) return { ok: false, error: "Profissional nao encontrado." };
  return {
    ok: true,
    tenantId: prof.tenant_id as string,
    profissionalId: prof.id as string,
  };
}

// ============================================================
// enviarSMSManual — profissional envia SMS personalizado
// ============================================================

export async function enviarSMSManual(input: {
  pacienteId: string;
  mensagem: string;
}): Promise<EnviarSMSResult> {
  const ctx = await obterContexto();
  if (!ctx.ok) return { enviado: false, motivo: "erro_interno" };

  const mensagem = (input.mensagem ?? "").trim();
  if (!mensagem) {
    return { enviado: false, motivo: "Mensagem vazia." };
  }

  const admin = createAdminClient();
  const { data: pac, error: pacErr } = await admin
    .from("pacientes")
    .select("id, telefone, tenant_id")
    .eq("id", input.pacienteId)
    .maybeSingle();
  if (pacErr) return { enviado: false, motivo: pacErr.message };
  if (!pac) return { enviado: false, motivo: "Paciente nao encontrado." };
  if (pac.tenant_id !== ctx.tenantId) {
    return { enviado: false, motivo: "Sem permissao." };
  }
  const telefone = (pac.telefone as string | null) ?? "";
  if (!telefone) {
    return { enviado: false, motivo: "telefone_invalido" };
  }

  return enviarSMS({
    telefone,
    mensagem: templateSMSPersonalizado({ mensagem }),
    tipo: "personalizado",
    pacienteId: input.pacienteId,
    profissionalId: ctx.profissionalId,
    tenantId: ctx.tenantId,
  });
}

// ============================================================
// getHistoricoSMS — lista sms_log do tenant (ou de um paciente)
// ============================================================

export async function getHistoricoSMS(
  pacienteId?: string,
): Promise<
  | { ok: true; data: SMSLogItem[] }
  | { ok: false; error: string }
> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  let query = admin
    .from("sms_log")
    .select(
      "id, paciente_id, telefone, tipo, mensagem, status, provedor, custo, created_at",
    )
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (pacienteId) query = query.eq("paciente_id", pacienteId);

  const { data: rows, error } = await query;
  if (error) return { ok: false, error: error.message };

  const lista = rows ?? [];
  const pacIds = Array.from(
    new Set(
      lista
        .map((r) => r.paciente_id as string | null)
        .filter((v): v is string => Boolean(v)),
    ),
  );
  const pacMap = new Map<string, string>();
  if (pacIds.length > 0) {
    const { data: pacs } = await admin
      .from("pacientes")
      .select("id, nome")
      .in("id", pacIds);
    for (const p of pacs ?? []) {
      pacMap.set(p.id as string, (p.nome as string) ?? "Paciente");
    }
  }

  const data: SMSLogItem[] = lista.map((r) => ({
    id: r.id as string,
    paciente_id: (r.paciente_id as string | null) ?? null,
    paciente_nome: r.paciente_id
      ? pacMap.get(r.paciente_id as string) ?? null
      : null,
    telefone: (r.telefone as string) ?? "",
    tipo: (r.tipo as string) ?? "",
    mensagem: (r.mensagem as string) ?? "",
    status: (r.status as string) ?? "",
    provedor: (r.provedor as string | null) ?? null,
    custo: Number(r.custo ?? 0),
    created_at: r.created_at as string,
  }));

  return { ok: true, data };
}

// ============================================================
// getUsoSMSAtual — wrapper publico de verificarLimiteSMS
// ============================================================

export async function getUsoSMSAtual(): Promise<
  | { ok: true; data: VerificarLimiteSMSResult }
  | { ok: false; error: string }
> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;
  const data = await verificarLimiteSMS(ctx.tenantId);
  return { ok: true, data };
}
