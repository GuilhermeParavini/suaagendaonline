"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  registrarAcesso as registrarAcessoLib,
  type AcaoLogAcesso,
} from "@/lib/log-acesso";

/**
 * Server action expoe `registrarAcesso` para chamadas a partir de
 * componentes client. Sempre fire-and-forget no caller — esta funcao
 * nunca lanca, sempre resolve void.
 */
export async function registrarAcessoAction(input: {
  acao: AcaoLogAcesso;
  recurso: string;
  recursoId?: string | null;
}): Promise<void> {
  await registrarAcessoLib(input);
}

// ============================================================
// Listagem de logs (admin only)
// ============================================================

export interface LogAcessoItem {
  id: string;
  created_at: string;
  acao: AcaoLogAcesso | string;
  recurso: string;
  recurso_id: string | null;
  ip: string | null;
  user_agent: string | null;
  profissional: { id: string; nome: string } | null;
}

export interface ProfissionalOpcaoLog {
  id: string;
  nome: string;
}

export type ListarLogsAcessoResult =
  | {
      ok: true;
      data: {
        items: LogAcessoItem[];
        profissionais: ProfissionalOpcaoLog[];
        total: number;
      };
    }
  | { ok: false; error: string };

const PAGE_SIZE = 100;

export async function listarLogsAcesso(filtros?: {
  profissionalId?: string | null;
  dataInicio?: string | null; // ISO date (yyyy-mm-dd)
  dataFim?: string | null;
  page?: number;
}): Promise<ListarLogsAcessoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessao expirada." };

  const admin = createAdminClient();
  const { data: prof, error: profErr } = await admin
    .from("profissionais")
    .select("id, tenant_id, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profErr) return { ok: false, error: profErr.message };
  if (!prof) return { ok: false, error: "Profissional nao encontrado." };
  if (prof.role !== "admin") {
    return { ok: false, error: "Apenas administradores podem ver o log." };
  }

  const tenantId = prof.tenant_id as string;
  const page = Math.max(1, filtros?.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = admin
    .from("log_acesso")
    .select(
      "id, created_at, acao, recurso, recurso_id, ip, user_agent, profissional_id",
      { count: "exact" },
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filtros?.profissionalId) {
    query = query.eq("profissional_id", filtros.profissionalId);
  }
  if (filtros?.dataInicio && /^\d{4}-\d{2}-\d{2}$/.test(filtros.dataInicio)) {
    query = query.gte("created_at", `${filtros.dataInicio}T00:00:00.000Z`);
  }
  if (filtros?.dataFim && /^\d{4}-\d{2}-\d{2}$/.test(filtros.dataFim)) {
    query = query.lte("created_at", `${filtros.dataFim}T23:59:59.999Z`);
  }

  const { data: rows, error, count } = await query;
  if (error) return { ok: false, error: error.message };

  const lista = rows ?? [];
  const profIds = Array.from(
    new Set(
      lista
        .map((r) => (r.profissional_id as string | null) ?? null)
        .filter((v): v is string => Boolean(v)),
    ),
  );
  const { data: profsData } = profIds.length
    ? await admin
        .from("profissionais")
        .select("id, nome")
        .in("id", profIds)
    : { data: [] as { id: string; nome: string }[] };
  const profMap = new Map<string, string>();
  for (const p of profsData ?? []) {
    profMap.set(p.id as string, (p.nome as string) ?? "Profissional");
  }

  const items: LogAcessoItem[] = lista.map((r) => ({
    id: r.id as string,
    created_at: r.created_at as string,
    acao: (r.acao as string) ?? "",
    recurso: (r.recurso as string) ?? "",
    recurso_id: (r.recurso_id as string | null) ?? null,
    ip: (r.ip as string | null) ?? null,
    user_agent: (r.user_agent as string | null) ?? null,
    profissional: r.profissional_id
      ? {
          id: r.profissional_id as string,
          nome: profMap.get(r.profissional_id as string) ?? "Profissional",
        }
      : null,
  }));

  // Lista todos os profissionais do tenant para o filtro.
  const { data: profsAll } = await admin
    .from("profissionais")
    .select("id, nome")
    .eq("tenant_id", tenantId)
    .order("nome", { ascending: true });
  const profissionais: ProfissionalOpcaoLog[] = (profsAll ?? []).map((p) => ({
    id: p.id as string,
    nome: (p.nome as string) ?? "Profissional",
  }));

  return {
    ok: true,
    data: {
      items,
      profissionais,
      total: count ?? items.length,
    },
  };
}
