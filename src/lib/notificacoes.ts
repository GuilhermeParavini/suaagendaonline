import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";

type TipoNotificacao =
  | "confirmacao"
  | "lembrete_24h"
  | "cancelamento"
  | "feedback"
  | "boas_vindas";

type EnviarNotificacaoInput = {
  tenantId: string;
  agendamentoId: string | null;
  tipo: TipoNotificacao;
  destino: string;
  assunto: string;
  html: string;
};

export async function enviarNotificacaoEmail(
  input: EnviarNotificacaoInput,
): Promise<{ ok: boolean; erro: string | null }> {
  const admin = createAdminClient();

  const result = await sendEmail(input.destino, input.assunto, input.html);

  const status = result.ok ? "enviado" : "falhou";
  const enviadoEm = result.ok ? new Date().toISOString() : null;
  const erro = result.ok ? null : result.error;

  const { error: insErr } = await admin.from("notificacoes").insert({
    tenant_id: input.tenantId,
    agendamento_id: input.agendamentoId,
    tipo: input.tipo,
    canal: "email",
    destino: input.destino,
    assunto: input.assunto,
    conteudo: input.html,
    status,
    enviado_em: enviadoEm,
    erro,
  });
  if (insErr) {
    console.error("[notificacoes] Falha ao registrar:", insErr.message);
  }

  return { ok: result.ok, erro };
}
