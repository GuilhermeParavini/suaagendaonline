// Helpers e tipos puros para agendamento recorrente. Compartilhado entre o
// server action e o modal de novo agendamento (client). Nao pode ficar em
// `"use server"` porque server actions so permitem exports async.

export type FrequenciaRecorrencia = "semanal" | "quinzenal" | "mensal";

export interface CriarAgendamentosRecorrentesInput {
  pacienteId: string;
  procedimentoId: string;
  dataInicialIso: string; // yyyy-mm-dd
  hora: string; // HH:mm
  observacoes?: string;
  frequencia: FrequenciaRecorrencia;
  /** Numero de ocorrencias incluindo a primeira (1..52). */
  repeticoes: number;
}

export interface ConflitoData {
  dataIso: string;
  motivo: string;
}

export type CriarAgendamentosRecorrentesResult =
  | {
      ok: true;
      criados: number;
      ids: string[];
      datasCriadas: string[];
      conflitos: ConflitoData[];
    }
  | { ok: false; error: string };

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoLocal(iso: string): Date | null {
  if (!ISO_DATE_RE.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIso(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Calcula as datas seguintes a partir da inicial conforme frequencia.
 * Para "mensal", incrementa em meses civis preservando o dia (cap em ultimo dia
 * do mes quando o dia original nao existe naquele mes).
 */
export function calcularDatasRecorrencia(
  dataInicialIso: string,
  frequencia: FrequenciaRecorrencia,
  repeticoes: number,
): string[] {
  const inicial = parseIsoLocal(dataInicialIso);
  if (!inicial) return [];
  const total = Math.max(1, Math.min(52, Math.floor(repeticoes)));
  const datas: string[] = [];

  if (frequencia === "semanal" || frequencia === "quinzenal") {
    const passoDias = frequencia === "semanal" ? 7 : 14;
    for (let i = 0; i < total; i++) {
      const d = new Date(inicial.getTime());
      d.setUTCDate(d.getUTCDate() + i * passoDias);
      datas.push(toIso(d));
    }
    return datas;
  }

  // Mensal: incrementa mes civil; ajusta para ultimo dia se overflow.
  const diaOriginal = inicial.getUTCDate();
  for (let i = 0; i < total; i++) {
    const ano = inicial.getUTCFullYear();
    const mes = inicial.getUTCMonth() + i;
    const ultimoDoMes = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
    const dia = Math.min(diaOriginal, ultimoDoMes);
    const d = new Date(Date.UTC(ano, mes, dia));
    datas.push(toIso(d));
  }
  return datas;
}
