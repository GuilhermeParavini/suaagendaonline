// Helpers para gerar imagem PNG e nomear arquivos de documentos
// (relatorio clinico, plano de cuidados, atestado).
// Reutiliza o motor de html-to-image ja usado no recibo.

export { compartilharOuBaixarPng } from "./recibo-imagem";

const SLUG_REGEX = /[^a-z0-9]+/g;

function slugify(value: string): string {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(SLUG_REGEX, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function nomeArquivoDocumento(
  prefixo: string,
  pacienteNome: string | null,
  dataBR: string,
): string {
  const pref = slugify(prefixo) || "documento";
  const nome = slugify(pacienteNome ?? "paciente") || "paciente";
  const dataSafe = dataBR.replace(/\//g, "-");
  return `${pref}-${nome}-${dataSafe}.png`;
}

const MESES_PT_EXTENSO = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function dataPorExtensoSimples(dataIso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dataIso);
  if (!m) return dataIso;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12) return dataIso;
  return `${String(dia).padStart(2, "0")} de ${MESES_PT_EXTENSO[mes - 1]} de ${ano}`;
}
