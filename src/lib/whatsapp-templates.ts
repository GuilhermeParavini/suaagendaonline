// Helpers para gerar links de WhatsApp e mensagens pre-formatadas.
// Tudo client-safe: nao acessa banco. Caller fornece os dados ja resolvidos.

import { cleanPhone } from "./masks";

export const COR_WHATSAPP = "#25D366";
export const COR_WHATSAPP_HOVER = "#1ebe5a";

/**
 * Limpa o telefone, adiciona o codigo de pais 55 quando ausente, e gera o link
 * https://wa.me/{numero}?text={mensagem}.
 *
 * - Aceita strings com mascara (parenteses, espacos, tracos).
 * - Se o telefone ja comecar com 55 e tiver 12 ou 13 digitos, mantem.
 * - Se nao tem telefone valido (ou string vazia), retorna https://wa.me/?text=...
 *   para abrir o WhatsApp pedindo o destinatario.
 */
export function gerarLinkWhatsApp(
  telefone: string | null | undefined,
  mensagem: string,
): string {
  const texto = encodeURIComponent(mensagem ?? "");
  const digits = cleanPhone(telefone ?? "");
  if (!digits) {
    return `https://wa.me/?text=${texto}`;
  }
  const numero =
    digits.startsWith("55") && (digits.length === 12 || digits.length === 13)
      ? digits
      : `55${digits}`;
  return `https://wa.me/${numero}?text=${texto}`;
}

export function gerarLinkMaps(
  endereco: string | null | undefined,
  cidade?: string | null,
  estado?: string | null,
): string | null {
  const partes = [endereco, cidade, estado].filter(
    (s): s is string => Boolean(s && s.trim()),
  );
  if (partes.length === 0) return null;
  const q = encodeURIComponent(partes.join(", "));
  return `https://maps.google.com/?q=${q}`;
}

function primeiroNome(nome: string | null | undefined): string {
  if (!nome) return "";
  const t = nome.trim();
  if (!t) return "";
  return t.split(/\s+/)[0];
}

function bloco(label: string, valor: string | null | undefined): string {
  if (!valor || !valor.trim()) return "";
  return `\n${label}: ${valor.trim()}`;
}

// ---------------- Templates ----------------

export interface DadosConfirmacao {
  nome: string;
  data: string; // ja formatado: "5 de junho de 2026" ou "05/06/2026"
  hora: string; // ex: "14:30"
  profissional: string;
  procedimento?: string | null;
  endereco?: string | null;
  linkMaps?: string | null;
}

export function mensagemConfirmacao(d: DadosConfirmacao): string {
  const partes: string[] = [
    `Ola ${primeiroNome(d.nome)}! Sua consulta esta confirmada:`,
    `Data: ${d.data} as ${d.hora}`,
    `Profissional: ${d.profissional}`,
  ];
  if (d.procedimento) partes.push(`Procedimento: ${d.procedimento}`);
  if (d.endereco) partes.push(`Endereco: ${d.endereco}`);
  if (d.linkMaps) partes.push(`Como chegar: ${d.linkMaps}`);
  partes.push(
    "Chegue 5-10 minutos antes. Qualquer duvida, responda esta mensagem!",
  );
  return partes.join("\n");
}

export interface DadosLembrete {
  nome: string;
  data: string;
  hora: string;
  endereco?: string | null;
  linkMaps?: string | null;
}

export function mensagemLembrete(d: DadosLembrete): string {
  const partes: string[] = [
    `Ola ${primeiroNome(d.nome)}! Lembrando que sua consulta e amanha:`,
    `Data: ${d.data} as ${d.hora}`,
  ];
  if (d.endereco) partes.push(`Endereco: ${d.endereco}`);
  if (d.linkMaps) partes.push(`Como chegar: ${d.linkMaps}`);
  partes.push("Ate la!");
  return partes.join("\n");
}

export interface DadosPreConsulta {
  nome: string;
  linkPreConsulta: string;
}

export function mensagemPreConsulta(d: DadosPreConsulta): string {
  return [
    `Ola ${primeiroNome(d.nome)}! Para agilizar sua consulta, preencha seus dados antes:`,
    d.linkPreConsulta,
    "Leva menos de 5 minutos!",
  ].join("\n");
}

export interface DadosDocumento {
  nome: string;
  tipoDocumento: string;
  linkDocumento?: string | null;
}

export function mensagemDocumento(d: DadosDocumento): string {
  const intro = `Ola ${primeiroNome(d.nome)}! Segue seu ${d.tipoDocumento}:`;
  if (!d.linkDocumento) {
    return `${intro}\n(documento sera enviado em seguida)`;
  }
  return `${intro}\n${d.linkDocumento}`;
}

export interface DadosRetorno {
  nome: string;
  diasDesdeUltimaConsulta: number;
  linkAgendamento: string;
}

export function mensagemRetorno(d: DadosRetorno): string {
  return [
    `Ola ${primeiroNome(d.nome)}! Faz ${d.diasDesdeUltimaConsulta} dias desde sua ultima consulta. Que tal agendar um retorno?`,
    d.linkAgendamento,
  ].join("\n");
}

export interface DadosAniversario {
  nome: string;
}

export function mensagemAniversario(d: DadosAniversario): string {
  return `Ola ${primeiroNome(d.nome)}! Feliz aniversario! Desejamos muita saude e bem-estar. Um abraco da equipe!`;
}

export interface DadosSentimosFalta {
  nome: string;
  diasInativo: number;
  linkAgendamento?: string | null;
}

export function mensagemSentimosFalta(d: DadosSentimosFalta): string {
  const partes: string[] = [
    `Ola ${primeiroNome(d.nome)}! Faz ${d.diasInativo} dias que nao nos vemos. Sentimos sua falta! Que tal agendar uma consulta?`,
  ];
  if (d.linkAgendamento) partes.push(d.linkAgendamento);
  return partes.join("\n");
}

// Re-export bloco/primeiroNome para uso em telas (compor mensagens custom).
export const _internals = { bloco, primeiroNome };
