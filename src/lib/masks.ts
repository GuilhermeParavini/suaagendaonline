export function cleanPhone(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatPhone(value: string): string {
  const digits = cleanPhone(value).slice(0, 11);

  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function cleanCPF(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatCPF(value: string): string {
  const digits = cleanCPF(value).slice(0, 11);

  if (digits.length === 0) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

// LGPD: oculta o CPF em listagens, fichas e relatorios — exibe apenas os
// 2 ultimos digitos. O CPF completo deve aparecer apenas no formulario de
// edicao do paciente, em campo claramente identificado.
export function mascaraCPF(value: string | null | undefined): string {
  if (!value) return "";
  const digits = cleanCPF(value);
  if (digits.length === 0) return "";
  const ultimos = digits.slice(-2).padStart(2, "*");
  return `***.***.***-${ultimos}`;
}

export function cleanCEP(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatCEP(value: string): string {
  const digits = cleanCEP(value).slice(0, 8);

  if (digits.length === 0) return "";
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function formatDate(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length === 0) return "";
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function parseDate(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function isValidDate(value: string): boolean {
  return parseDate(value) !== null;
}

export function brDateToIso(value: string): string | null {
  const date = parseDate(value);
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isoToBrDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function parseCurrency(input: string): number {
  if (!input) return 0;
  const digits = input.replace(/\D/g, "");
  if (digits.length === 0) return 0;
  return Number(digits) / 100;
}

export function formatCurrencyInput(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 0) return "";
  const cents = Number(digits);
  return formatCurrency(cents / 100);
}

const UNIDADES = [
  "zero", "um", "dois", "tres", "quatro", "cinco",
  "seis", "sete", "oito", "nove", "dez", "onze",
  "doze", "treze", "quatorze", "quinze", "dezesseis",
  "dezessete", "dezoito", "dezenove",
];
const DEZENAS = [
  "", "", "vinte", "trinta", "quarenta", "cinquenta",
  "sessenta", "setenta", "oitenta", "noventa",
];
const CENTENAS = [
  "", "cento", "duzentos", "trezentos", "quatrocentos",
  "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos",
];

function ateMil(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  if (n < 20) return UNIDADES[n];
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? DEZENAS[d] : `${DEZENAS[d]} e ${UNIDADES[u]}`;
  }
  const c = Math.floor(n / 100);
  const resto = n % 100;
  return resto === 0
    ? CENTENAS[c]
    : `${CENTENAS[c]} e ${ateMil(resto)}`;
}

function inteiroPorExtenso(n: number): string {
  if (n === 0) return "zero";
  if (n < 1000) return ateMil(n);
  if (n < 1000000) {
    const milhares = Math.floor(n / 1000);
    const resto = n % 1000;
    const prefixo = milhares === 1 ? "mil" : `${ateMil(milhares)} mil`;
    if (resto === 0) return prefixo;
    return `${prefixo} e ${ateMil(resto)}`;
  }
  const milhoes = Math.floor(n / 1000000);
  const resto = n % 1000000;
  const prefixo = milhoes === 1 ? "um milhao" : `${ateMil(milhoes)} milhoes`;
  if (resto === 0) return prefixo;
  return `${prefixo} e ${inteiroPorExtenso(resto)}`;
}

export function valorPorExtenso(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "zero reais";
  const cents = Math.round(value * 100);
  const reais = Math.floor(cents / 100);
  const centavos = cents % 100;

  const partes: string[] = [];
  if (reais > 0) {
    partes.push(`${inteiroPorExtenso(reais)} ${reais === 1 ? "real" : "reais"}`);
  }
  if (centavos > 0) {
    partes.push(
      `${inteiroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`,
    );
  }
  if (partes.length === 0) return "zero reais";
  return partes.join(" e ");
}
