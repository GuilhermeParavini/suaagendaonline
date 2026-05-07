// Templates de mensagem personalizaveis (com variaveis {nome}, {data}, etc.).
// Persistencia atual: localStorage. Migrar para banco em sprint futura quando
// houver necessidade multi-dispositivo.

export type CanalMensagem = "whatsapp" | "email" | "sms";

export type TipoMensagem =
  | "confirmacao"
  | "lembrete"
  | "pre_consulta"
  | "documento"
  | "retorno"
  | "aniversario"
  | "personalizado";

export interface TemplateMensagem {
  id: string;
  nome: string;
  canal: CanalMensagem;
  tipo: TipoMensagem;
  conteudo: string;
  ativo: boolean;
}

// ---------------- Conteudos padrao ----------------
//
// Variaveis disponiveis (entre chaves): {nome}, {data}, {hora}, {profissional},
// {procedimento}, {endereco}, {linkMaps}, {linkPreConsulta}, {linkDocumento},
// {linkAgendamento}, {tipoDocumento}, {diasDesdeUltimaConsulta}.

export const TEMPLATES_PADRAO: TemplateMensagem[] = [
  {
    id: "padrao-confirmacao",
    nome: "Confirmacao de consulta",
    canal: "whatsapp",
    tipo: "confirmacao",
    ativo: true,
    conteudo: [
      "Ola {nome}! Sua consulta esta confirmada:",
      "Data: {data} as {hora}",
      "Profissional: {profissional}",
      "Procedimento: {procedimento}",
      "Endereco: {endereco}",
      "Como chegar: {linkMaps}",
      "Chegue 5-10 minutos antes. Qualquer duvida, responda esta mensagem!",
    ].join("\n"),
  },
  {
    id: "padrao-lembrete",
    nome: "Lembrete de consulta",
    canal: "whatsapp",
    tipo: "lembrete",
    ativo: true,
    conteudo: [
      "Ola {nome}! Lembrando que sua consulta e amanha:",
      "Data: {data} as {hora}",
      "Endereco: {endereco}",
      "Como chegar: {linkMaps}",
      "Ate la!",
    ].join("\n"),
  },
  {
    id: "padrao-pre-consulta",
    nome: "Envio de pre-consulta",
    canal: "whatsapp",
    tipo: "pre_consulta",
    ativo: true,
    conteudo: [
      "Ola {nome}! Para agilizar sua consulta, preencha seus dados antes:",
      "{linkPreConsulta}",
      "Leva menos de 5 minutos!",
    ].join("\n"),
  },
  {
    id: "padrao-documento",
    nome: "Envio de documento",
    canal: "whatsapp",
    tipo: "documento",
    ativo: true,
    conteudo: ["Ola {nome}! Segue seu {tipoDocumento}:", "{linkDocumento}"].join(
      "\n",
    ),
  },
  {
    id: "padrao-retorno",
    nome: "Convite para retorno",
    canal: "whatsapp",
    tipo: "retorno",
    ativo: true,
    conteudo: [
      "Ola {nome}! Faz {diasDesdeUltimaConsulta} dias desde sua ultima consulta. Que tal agendar um retorno?",
      "{linkAgendamento}",
    ].join("\n"),
  },
];

export const VARIAVEIS_DISPONIVEIS = [
  { chave: "nome", descricao: "Primeiro nome do paciente" },
  { chave: "data", descricao: "Data da consulta (ex: 05/06/2026)" },
  { chave: "hora", descricao: "Horario (ex: 14:30)" },
  { chave: "profissional", descricao: "Nome do profissional" },
  { chave: "procedimento", descricao: "Nome do procedimento" },
  { chave: "endereco", descricao: "Endereco do consultorio" },
  { chave: "linkMaps", descricao: "Link do Google Maps" },
  { chave: "linkPreConsulta", descricao: "Link da pre-consulta" },
  { chave: "linkDocumento", descricao: "URL do PDF compartilhado" },
  { chave: "linkAgendamento", descricao: "Link publico de agendamento" },
  { chave: "tipoDocumento", descricao: "Receita / atestado / plano / relatorio" },
  {
    chave: "diasDesdeUltimaConsulta",
    descricao: "Quantos dias desde a ultima consulta",
  },
] as const;

// ---------------- Render ----------------

export function renderTemplate(
  template: string,
  variaveis: Record<string, string | number | null | undefined>,
): string {
  // Substitui {variavel} pelos valores. Se a chave nao tem valor (vazio/null),
  // remove a linha inteira (evita "Endereco: " sem conteudo).
  const linhas = template.split("\n");
  const out: string[] = [];

  for (const linha of linhas) {
    let vazia = false;
    let achouChave = false;
    const renderizada = linha.replace(/\{(\w+)\}/g, (_match, chave: string) => {
      achouChave = true;
      const valor = variaveis[chave];
      if (valor === undefined || valor === null || valor === "") {
        vazia = true;
        return "";
      }
      return String(valor);
    });
    if (achouChave && vazia) {
      // Linha tinha uma variavel que ficou vazia — descarta a linha inteira.
      continue;
    }
    out.push(renderizada);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ---------------- Persistencia (localStorage) ----------------

const STORAGE_KEY = "suaagendaonline:templates-mensagem:v1";

export function carregarTemplates(): TemplateMensagem[] {
  if (typeof window === "undefined") return TEMPLATES_PADRAO;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return TEMPLATES_PADRAO;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return TEMPLATES_PADRAO;

    // Mescla com defaults: garante que novos templates padrao apareçam.
    const customMap = new Map<string, TemplateMensagem>();
    for (const item of parsed) {
      if (item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string") {
        customMap.set((item as TemplateMensagem).id, item as TemplateMensagem);
      }
    }
    return TEMPLATES_PADRAO.map((p) => customMap.get(p.id) ?? p);
  } catch {
    return TEMPLATES_PADRAO;
  }
}

export function salvarTemplate(tpl: TemplateMensagem): TemplateMensagem[] {
  const todos = carregarTemplates();
  const novos = todos.map((t) => (t.id === tpl.id ? tpl : t));
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(novos));
    } catch {
      // ignore storage errors (quota / private mode)
    }
  }
  return novos;
}

export function restaurarPadrao(id: string): TemplateMensagem[] {
  const padrao = TEMPLATES_PADRAO.find((t) => t.id === id);
  if (!padrao) return carregarTemplates();
  return salvarTemplate(padrao);
}

export function getTemplate(
  tipo: TipoMensagem,
  templates?: TemplateMensagem[],
): TemplateMensagem | null {
  const lista = templates ?? carregarTemplates();
  return lista.find((t) => t.tipo === tipo && t.ativo) ?? null;
}
