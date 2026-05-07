import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import type { ConsentimentoItem } from "@/lib/consentimento-shared";

export type { ConsentimentoItem } from "@/lib/consentimento-shared";
export { mascaraIp } from "@/lib/consentimento-shared";

// ============================================================
// Tipos
// ============================================================

export type ConsentimentoTipo =
  | "lgpd_geral"
  | "lgpd_menor"
  | "lgpd_agendamento"
  | "lgpd_cadastro"
  | "lgpd_pre_consulta";

export const VERSAO_TERMO = "1.0";

export interface RegistrarConsentimentoInput {
  pacienteId: string;
  tipo: ConsentimentoTipo;
  responsavelId?: string | null;
  /** Texto base do termo aceito. IP/UA/versao sao apendados automaticamente. */
  textoTermo: string;
  /** Sobrescreve a captura automatica de IP via headers (opcional). */
  ip?: string | null;
  /** Sobrescreve a captura automatica de user-agent (opcional). */
  userAgent?: string | null;
}

// ============================================================
// Captura de metadata da requisicao
// ============================================================

/**
 * Le headers da requisicao atual para capturar IP e user-agent. Funciona apenas
 * dentro de server actions / route handlers (precisa de contexto de request).
 *
 * Tenta `x-forwarded-for` primeiro (Vercel encaminha o IP real ai), depois
 * `x-real-ip`. Se nao houver, retorna null.
 */
export async function capturarMetadataRequisicao(): Promise<{
  ip: string | null;
  userAgent: string | null;
}> {
  try {
    const h = await headers();
    const xff = h.get("x-forwarded-for");
    const xri = h.get("x-real-ip");
    const ip = xff?.split(",")[0]?.trim() ?? xri?.trim() ?? null;
    const ua = h.get("user-agent");
    return {
      ip: ip || null,
      userAgent: ua ?? null,
    };
  } catch {
    return { ip: null, userAgent: null };
  }
}

// ============================================================
// Registrar consentimento
// ============================================================

/**
 * Registra um consentimento na tabela `consentimentos`. Embute IP, user-agent e
 * versao do termo no campo `texto_aceito` para garantir rastreabilidade
 * mesmo se o schema nao tiver colunas dedicadas (`ip`, `user_agent`,
 * `versao_termo`).
 *
 * Best-effort: erros sao retornados mas nao lancam — o caller decide se faz
 * rollback do paciente ou apenas loga.
 */
export async function registrarConsentimento(
  input: RegistrarConsentimentoInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.pacienteId || !input.tipo || !input.textoTermo) {
    return { ok: false, error: "Dados obrigatorios ausentes." };
  }

  const meta =
    input.ip !== undefined || input.userAgent !== undefined
      ? { ip: input.ip ?? null, userAgent: input.userAgent ?? null }
      : await capturarMetadataRequisicao();

  // Apenda metadata estruturado ao texto base. Formato chave=valor separado
  // por ' | ' — facilita parser caso seja necessario extrair depois.
  const ipSeguro = meta.ip ? meta.ip.slice(0, 64) : null;
  const uaSeguro = meta.userAgent ? meta.userAgent.slice(0, 256) : null;
  const partesMeta: string[] = [`versao=${VERSAO_TERMO}`];
  if (ipSeguro) partesMeta.push(`ip=${ipSeguro}`);
  if (uaSeguro) partesMeta.push(`ua=${uaSeguro}`);
  const textoCompleto = `${input.textoTermo} | ${partesMeta.join(" | ")}`;

  const admin = createAdminClient();
  const { error } = await admin.from("consentimentos").insert({
    paciente_id: input.pacienteId,
    responsavel_id: input.responsavelId ?? null,
    tipo: input.tipo,
    aceite: true,
    texto_aceito: textoCompleto,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============================================================
// Helpers de leitura (para exibir na ficha do paciente)
// ============================================================

const RE_VERSAO = /versao=([^\s|]+)/i;
const RE_IP = /\bip=([0-9a-f.:,\s]+?)(?=\s\||$)/i;

function parseTexto(texto: string): {
  base: string;
  ip: string | null;
  versao: string | null;
} {
  const ip = texto.match(RE_IP)?.[1]?.trim() ?? null;
  const versao = texto.match(RE_VERSAO)?.[1] ?? null;
  // Remove sufixo de metadata para exibir o texto limpo na UI.
  const base = texto.split(/\s\|\s/)[0] ?? texto;
  return { base, ip, versao };
}

export async function listarConsentimentosPaciente(
  pacienteId: string,
): Promise<ConsentimentoItem[]> {
  if (!pacienteId) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("consentimentos")
    .select("id, tipo, aceite, texto_aceito, created_at")
    .eq("paciente_id", pacienteId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => {
    const texto = (r.texto_aceito as string | null) ?? "";
    const { base, ip, versao } = parseTexto(texto);
    return {
      id: r.id as string,
      tipo: (r.tipo as string) ?? "",
      aceite: Boolean(r.aceite),
      texto: base,
      ip,
      versao,
      created_at: r.created_at as string,
    };
  });
}
