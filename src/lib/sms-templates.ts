// Templates de SMS — todos cabem em 160 caracteres GSM-7. Sem caracteres
// acentuados nem emoji para evitar fragmentacao em multiplos SMS pelo
// provedor. Mantido como modulo client-safe (sem `server-only`) para que
// possa ser pre-visualizado em formularios do painel.

function primeiroNome(nome: string | null | undefined): string {
  if (!nome) return "";
  const t = nome.trim();
  if (!t) return "";
  return t.split(/\s+/)[0];
}

function truncar160(s: string): string {
  // SMS GSM-7 padrao = 160 chars. Trunca com "..." preservando palavra inteira
  // quando possivel.
  if (s.length <= 160) return s;
  const corte = s.lastIndexOf(" ", 157);
  return `${s.slice(0, corte > 0 ? corte : 157)}...`;
}

// ============================================================
// confirmacao
// ============================================================

export interface DadosSMSConfirmacao {
  nome: string;
  /** Data ja formatada (ex: "05/06"). */
  data: string;
  /** Hora ja formatada (ex: "14:30"). */
  hora: string;
  profissional: string;
}

export function templateSMSConfirmacao(d: DadosSMSConfirmacao): string {
  const nome = primeiroNome(d.nome);
  const prof = primeiroNome(d.profissional);
  return truncar160(
    `Ola ${nome}! Consulta confirmada: ${d.data} as ${d.hora} com ${prof}. Duvidas? Responda este SMS.`,
  );
}

// ============================================================
// lembrete (24h antes)
// ============================================================

export interface DadosSMSLembrete {
  nome: string;
  data: string;
  hora: string;
}

export function templateSMSLembrete(d: DadosSMSLembrete): string {
  const nome = primeiroNome(d.nome);
  return truncar160(
    `Ola ${nome}! Lembrete: sua consulta e amanha ${d.data} as ${d.hora}. Chegue 5-10 min antes. Ate la!`,
  );
}

// ============================================================
// retorno
// ============================================================

export interface DadosSMSRetorno {
  nome: string;
  diasDesdeUltimaConsulta: number;
  /** Link curto opcional (ex: bit.ly). Se omitido, sai sem link. */
  linkAgendamento?: string | null;
}

export function templateSMSRetorno(d: DadosSMSRetorno): string {
  const nome = primeiroNome(d.nome);
  const link = d.linkAgendamento ? ` ${d.linkAgendamento}` : "";
  return truncar160(
    `Ola ${nome}! Faz ${d.diasDesdeUltimaConsulta} dias desde sua ultima consulta. Que tal agendar um retorno?${link}`,
  );
}

// ============================================================
// aniversario
// ============================================================

export interface DadosSMSAniversario {
  nome: string;
}

export function templateSMSAniversario(d: DadosSMSAniversario): string {
  const nome = primeiroNome(d.nome);
  return truncar160(
    `Feliz aniversario, ${nome}! Desejamos muita saude. Um abraco da equipe!`,
  );
}

// ============================================================
// personalizado
// ============================================================

export interface DadosSMSPersonalizado {
  mensagem: string;
}

export function templateSMSPersonalizado(d: DadosSMSPersonalizado): string {
  return truncar160(d.mensagem.trim());
}
