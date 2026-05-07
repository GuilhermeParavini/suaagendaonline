"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { ContatoPreferencial } from "@/actions/pacientes";

// ============================================================
// Tipos
// ============================================================

export interface InadimplenteResumo {
  pacienteId: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  contato_preferencial: ContatoPreferencial;
  valorPendente: number;
  lancamentosCount: number;
  diasAtraso: number;
  /** Data ISO do lancamento mais antigo (yyyy-mm-dd). */
  dataMaisAntiga: string;
}

export type GetInadimplentesResult =
  | {
      ok: true;
      data: {
        items: InadimplenteResumo[];
        totalPendente: number;
      };
    }
  | { ok: false; error: string };

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

// ============================================================
// getInadimplentes
// ============================================================

/**
 * Lista pacientes com saldo pendente (lancamentos `tipo=receita` e `pago=false`)
 * agregados por `paciente_id`. Retorna ordenado por `valorPendente` DESC.
 *
 * Lancamentos sem `paciente_id` (avulsos) sao ignorados — so aparece quem ja
 * tem ficha cadastrada para que o profissional consiga acionar via WhatsApp.
 */
export async function getInadimplentes(): Promise<GetInadimplentesResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessao expirada." };

  const admin = createAdminClient();
  const { data: prof, error: profErr } = await admin
    .from("profissionais")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profErr) return { ok: false, error: profErr.message };
  if (!prof) return { ok: false, error: "Profissional nao encontrado." };

  const tenantId = prof.tenant_id as string;

  const { data: lancRows, error } = await admin
    .from("financeiro")
    .select("paciente_id, valor, data_lancamento")
    .eq("tenant_id", tenantId)
    .eq("tipo", "receita")
    .eq("pago", false)
    .not("paciente_id", "is", null);
  if (error) return { ok: false, error: error.message };

  const lista = (lancRows ?? []) as Array<{
    paciente_id: string;
    valor: number | string;
    data_lancamento: string;
  }>;
  if (lista.length === 0) {
    return { ok: true, data: { items: [], totalPendente: 0 } };
  }

  // Agrega por paciente_id
  const agreg = new Map<
    string,
    { valor: number; count: number; dataMaisAntiga: string }
  >();
  for (const r of lista) {
    const pid = r.paciente_id;
    if (!pid) continue;
    const valor = Number(r.valor) || 0;
    const data = (r.data_lancamento as string).slice(0, 10);
    const atual = agreg.get(pid);
    if (!atual) {
      agreg.set(pid, { valor, count: 1, dataMaisAntiga: data });
    } else {
      atual.valor += valor;
      atual.count += 1;
      if (data < atual.dataMaisAntiga) atual.dataMaisAntiga = data;
    }
  }

  const pacIds = Array.from(agreg.keys());
  const { data: pacientesRows, error: pacErr } = await admin
    .from("pacientes")
    .select("id, nome, telefone, email, contato_preferencial, ativo")
    .in("id", pacIds);
  if (pacErr) return { ok: false, error: pacErr.message };

  const pacMap = new Map<
    string,
    {
      nome: string;
      telefone: string | null;
      email: string | null;
      contato_preferencial: ContatoPreferencial;
      ativo: boolean;
    }
  >();
  for (const p of pacientesRows ?? []) {
    pacMap.set(p.id as string, {
      nome: (p.nome as string) ?? "Paciente",
      telefone: (p.telefone as string | null) ?? null,
      email: (p.email as string | null) ?? null,
      contato_preferencial: parseContato(p.contato_preferencial),
      ativo: Boolean(p.ativo ?? true),
    });
  }

  const hoje = hojeIsoUTC();
  const items: InadimplenteResumo[] = [];
  let totalPendente = 0;
  for (const [pid, aggr] of agreg.entries()) {
    const pac = pacMap.get(pid);
    if (!pac || !pac.ativo) continue;
    const diasAtraso = Math.max(0, diffDiasIso(hoje, aggr.dataMaisAntiga));
    items.push({
      pacienteId: pid,
      nome: pac.nome,
      telefone: pac.telefone,
      email: pac.email,
      contato_preferencial: pac.contato_preferencial,
      valorPendente: aggr.valor,
      lancamentosCount: aggr.count,
      diasAtraso,
      dataMaisAntiga: aggr.dataMaisAntiga,
    });
    totalPendente += aggr.valor;
  }

  items.sort((a, b) => b.valorPendente - a.valorPendente);

  return {
    ok: true,
    data: {
      items,
      totalPendente,
    },
  };
}
