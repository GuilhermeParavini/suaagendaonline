import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { cleanPhone } from "@/lib/masks";
import { DEGUSTACAO_SMS } from "@/lib/planos";

// ============================================================
// Tipos
// ============================================================

export type TipoSMS =
  | "confirmacao"
  | "lembrete"
  | "retorno"
  | "aniversario"
  | "personalizado"
  | "aftercare"
  | "inativo";

export type StatusSMS = "enviado" | "entregue" | "falha" | "pendente";

export type MotivoFalhaSMS =
  | "telefone_invalido"
  | "limite_excedido"
  | "modulo_inativo"
  | "provedor_indisponivel"
  | "erro_provedor"
  | "erro_interno";

export interface EnviarSMSInput {
  telefone: string;
  mensagem: string;
  tipo: TipoSMS;
  pacienteId: string | null;
  profissionalId: string;
  tenantId: string;
}

export interface EnviarSMSResult {
  enviado: boolean;
  motivo?: MotivoFalhaSMS | string;
  smsLogId?: string;
}

export interface VerificarLimiteSMSResult {
  usado: number;
  limite: number;
  disponivel: number;
  percentual: number;
}

// Custo estimado em R$ por SMS para fins de relatorio. Nao e preco
// publico — apenas o quanto a clinica "consome" do credito.
const CUSTO_SMS = 0.1;

const PROVEDOR_PADRAO: "zenvia" | "twilio" =
  (process.env.SMS_PROVEDOR as "zenvia" | "twilio" | undefined) ?? "zenvia";

const ZENVIA_FROM = process.env.ZENVIA_SMS_FROM ?? "SuaAgenda";
const ZENVIA_URL = "https://api.zenvia.com/v2/channels/sms/messages";

// ============================================================
// Helpers
// ============================================================

/** Converte telefone para E.164 brasileiro (+55XXXXXXXXXXX). */
export function paraE164BR(telefone: string): string | null {
  const digits = cleanPhone(telefone ?? "");
  if (!digits) return null;
  // Aceita 10 digitos (fixo), 11 (celular), 12 ou 13 (com codigo de pais)
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if (digits.length === 12 && digits.startsWith("55")) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith("55")) return `+${digits}`;
  return null;
}

function mesAnoAtual(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Soma `quantidade` de todos os addons SMS ativos do tenant para o mes.
 * Reproduz a logica de `actions/planos.ts:somarAddonsDoMes` aqui (server-only,
 * sem depender de contexto de sessao).
 */
async function somarAddonsSMS(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  mesAno: string,
): Promise<number> {
  const inicioMes = `${mesAno}-01`;
  const { data } = await admin
    .from("addons_tenant")
    .select("quantidade, data_inicio, data_fim, ativo")
    .eq("tenant_id", tenantId)
    .eq("tipo", "sms");

  const linhas = (data ?? []) as Array<Record<string, unknown>>;
  return linhas
    .filter((r) => {
      const di = String(r.data_inicio ?? "");
      const df = (r.data_fim as string | null) ?? null;
      const ativo = Boolean(r.ativo);
      if (di > `${mesAno}-31`) return false;
      if (df && df < inicioMes) return false;
      return ativo || (df && df >= inicioMes);
    })
    .reduce((acc, r) => acc + Number(r.quantidade ?? 0), 0);
}

// ============================================================
// verificarLimiteSMS — versao raw, sem contexto de sessao
// ============================================================

/**
 * Calcula uso/limite de SMS para um tenant especifico no mes corrente.
 * Funciona em server actions e CRONs (sem precisar de cookie de sessao).
 */
export async function verificarLimiteSMS(
  tenantId: string,
  mesAno: string = mesAnoAtual(),
): Promise<VerificarLimiteSMSResult> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("uso_sms")
    .select("enviados")
    .eq("tenant_id", tenantId)
    .eq("mes_ano", mesAno)
    .maybeSingle();

  const usado = Number(row?.enviados ?? 0);
  const limiteAddon = await somarAddonsSMS(admin, tenantId, mesAno);
  const limite = DEGUSTACAO_SMS + limiteAddon;
  const disponivel = Math.max(0, limite - usado);
  const percentual = limite > 0 ? Math.min(100, (usado / limite) * 100) : 0;
  return { usado, limite, disponivel, percentual };
}

// ============================================================
// Provedor: Zenvia
// ============================================================

interface ProvedorResposta {
  ok: boolean;
  providerId: string | null;
  erro: string | null;
}

async function enviarViaZenvia(
  telefoneE164: string,
  mensagem: string,
): Promise<ProvedorResposta> {
  const token = process.env.ZENVIA_API_TOKEN;
  if (!token) {
    // Modo desenvolvimento: simula envio com sucesso e loga no console
    // para que o profissional possa testar o fluxo end-to-end sem custo real.
    console.log("[sms-server] DEV mode (sem ZENVIA_API_TOKEN):", {
      to: telefoneE164,
      texto: mensagem.slice(0, 60),
    });
    return {
      ok: true,
      providerId: `dev-${Date.now()}`,
      erro: null,
    };
  }

  try {
    const res = await fetch(ZENVIA_URL, {
      method: "POST",
      headers: {
        "X-API-TOKEN": token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        from: ZENVIA_FROM,
        to: telefoneE164.replace(/^\+/, ""),
        contents: [{ type: "text", text: mensagem }],
      }),
    });
    const json = (await res.json().catch(() => null)) as {
      id?: string;
      message?: string;
    } | null;
    if (!res.ok) {
      return {
        ok: false,
        providerId: null,
        erro: json?.message ?? `Zenvia respondeu ${res.status}`,
      };
    }
    return {
      ok: true,
      providerId: (json?.id as string | undefined) ?? null,
      erro: null,
    };
  } catch (e) {
    return {
      ok: false,
      providerId: null,
      erro: e instanceof Error ? e.message : String(e),
    };
  }
}

// ============================================================
// enviarSMS — entry point principal
// ============================================================

export async function enviarSMS(
  input: EnviarSMSInput,
): Promise<EnviarSMSResult> {
  const admin = createAdminClient();
  const mesAno = mesAnoAtual();

  // a) Valida telefone para E.164
  const telefoneE164 = paraE164BR(input.telefone);
  if (!telefoneE164) {
    return { enviado: false, motivo: "telefone_invalido" };
  }

  // b) Verifica limite ANTES de enviar
  const { usado, limite } = await verificarLimiteSMS(input.tenantId, mesAno);
  if (usado >= limite) {
    return { enviado: false, motivo: "limite_excedido" };
  }

  // c) Chama provedor (apenas Zenvia por enquanto)
  const provedorNome = PROVEDOR_PADRAO;
  const resp =
    provedorNome === "zenvia"
      ? await enviarViaZenvia(telefoneE164, input.mensagem)
      : { ok: false, providerId: null, erro: "Provedor nao implementado" };

  const status: StatusSMS = resp.ok ? "enviado" : "falha";

  // d) Persiste sms_log apos resposta do provedor
  let smsLogId: string | undefined;
  try {
    const { data, error } = await admin
      .from("sms_log")
      .insert({
        tenant_id: input.tenantId,
        profissional_id: input.profissionalId,
        paciente_id: input.pacienteId,
        telefone: telefoneE164,
        tipo: input.tipo,
        mensagem: input.mensagem,
        status,
        provedor: provedorNome,
        provedor_id: resp.providerId,
        custo: resp.ok ? CUSTO_SMS : 0,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[sms-server] insert sms_log:", error.message);
    } else {
      smsLogId = data?.id as string | undefined;
    }
  } catch (e) {
    console.error("[sms-server] insert sms_log throw:", e);
  }

  // d.2) Atualiza contadores em uso_sms (UPSERT manual: read-then-write)
  if (resp.ok) {
    try {
      const { data: existente } = await admin
        .from("uso_sms")
        .select("id, enviados")
        .eq("tenant_id", input.tenantId)
        .eq("mes_ano", mesAno)
        .maybeSingle();

      if (existente?.id) {
        await admin
          .from("uso_sms")
          .update({
            enviados: Number(existente.enviados ?? 0) + 1,
          })
          .eq("id", existente.id);
      } else {
        await admin.from("uso_sms").insert({
          tenant_id: input.tenantId,
          profissional_id: input.profissionalId,
          mes_ano: mesAno,
          enviados: 1,
        });
      }
    } catch (e) {
      console.error("[sms-server] update uso_sms:", e);
    }
  }

  // e) Retorna resultado
  if (!resp.ok) {
    return {
      enviado: false,
      motivo: resp.erro ?? "erro_provedor",
      smsLogId,
    };
  }
  return { enviado: true, smsLogId };
}
