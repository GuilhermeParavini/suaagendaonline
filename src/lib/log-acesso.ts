import "server-only";
import { createAdminClient, createClient } from "@/lib/supabase/server";

// ============================================================
// Tipos
// ============================================================

export type AcaoLogAcesso =
  | "visualizar_paciente"
  | "editar_paciente"
  | "exportar_pdf"
  | "visualizar_evolucao"
  | "exportar_dados";

export interface LogAcessoInput {
  acao: AcaoLogAcesso;
  recurso: string;
  recursoId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

// ============================================================
// registrarAcesso (fire-and-forget)
// ============================================================

/**
 * Registra um evento de acesso a dado sensivel na tabela `log_acesso` para
 * fins de conformidade LGPD. Funcao "best-effort": qualquer falha na
 * autenticacao, no banco ou no resolvedor de tenant e suprimida — nunca
 * deve quebrar a acao principal do usuario.
 *
 * Resolve `tenant_id` e `profissional_id` da sessao atual (cookie). Se nao
 * houver sessao, o registro e ignorado silenciosamente.
 */
export async function registrarAcesso(input: LogAcessoInput): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const admin = createAdminClient();
    const { data: prof } = await admin
      .from("profissionais")
      .select("id, tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!prof) return;

    await admin.from("log_acesso").insert({
      tenant_id: prof.tenant_id,
      profissional_id: prof.id,
      acao: input.acao,
      recurso: input.recurso,
      recurso_id: input.recursoId ?? null,
      ip: input.ip ?? null,
      user_agent: input.userAgent ?? null,
    });
  } catch (e) {
    // Suprime — log e cosmetico, nao deve interromper o fluxo principal.
    console.error("[log-acesso] Falha ao registrar:", e);
  }
}
