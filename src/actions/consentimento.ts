"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { listarConsentimentosPaciente } from "@/lib/consentimento";
import type { ConsentimentoItem } from "@/lib/consentimento-shared";

/**
 * Lista consentimentos de um paciente para exibir na ficha. Restrita ao tenant
 * do profissional logado.
 */
export async function getConsentimentosPaciente(
  pacienteId: string,
): Promise<
  | { ok: true; data: ConsentimentoItem[] }
  | { ok: false; error: string }
> {
  if (!pacienteId) return { ok: false, error: "Paciente invalido." };

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

  const { data: pac, error: pacErr } = await admin
    .from("pacientes")
    .select("id, tenant_id")
    .eq("id", pacienteId)
    .maybeSingle();
  if (pacErr) return { ok: false, error: pacErr.message };
  if (!pac || pac.tenant_id !== prof.tenant_id) {
    return { ok: false, error: "Sem permissao." };
  }

  const lista = await listarConsentimentosPaciente(pacienteId);
  return { ok: true, data: lista };
}
