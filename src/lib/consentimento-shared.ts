// Tipos e helpers puros do dominio de consentimento. Nao importa server-only,
// portanto pode ser usado tanto por client components quanto pelo helper
// server-only `lib/consentimento.ts`.

export interface ConsentimentoItem {
  id: string;
  tipo: string;
  aceite: boolean;
  /** Texto base do termo (sem metadata apendada). */
  texto: string;
  /** IP capturado (mascarado para exibicao via `mascaraIp`). */
  ip: string | null;
  /** Versao do termo aceito. */
  versao: string | null;
  created_at: string;
}

/** Mascara IP exibindo apenas o primeiro octeto (ex: "187.x.x.x"). */
export function mascaraIp(ip: string | null): string | null {
  if (!ip) return null;
  if (ip.includes(":")) {
    const partes = ip.split(":");
    return `${partes[0]}:${partes[1] ?? ""}::`.replace(/:$/, "");
  }
  const partes = ip.split(".");
  if (partes.length !== 4) return ip;
  return `${partes[0]}.x.x.x`;
}
