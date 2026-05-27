// Sistema de planos v2.0 (26/05/2026).
//
// Mudanca estrategica documentada em suagendaonline-planos-precificacao-v2.md:
//   - 4 planos (individual, equipe3, equipe5, clinica10) que variam apenas
//     por quantidade de profissionais e limites de IA.
//   - TODAS as funcionalidades e modulos estao inclusos em TODOS os planos
//     (sem feature gating).
//   - IA (transcricao + assistente) inclusa nos planos. Add-ons de IA foram
//     descontinuados.
//   - Add-ons SMS continuam (provedor: Zenvia) com novos pacotes.
//
// Compatibilidade: os IDs legacy (essencial/profissional/clinica) sao
// aceitos como entrada e mapeados para os novos planos via mapearPlanoLegacy.
// A migracao do banco e feita em suagendaonline-planos-v2.sql.

export type PlanoId = "individual" | "equipe3" | "equipe5" | "clinica10";

// O id "trial" nao existe na tabela planos_sistema — durante o trial, o tenant
// ganha as funcionalidades do Clinica 10 gratuitamente por 14 dias.
export type PlanoSlug = PlanoId | "trial";

// IDs legacy (v1) — aceitos como entrada para o periodo de transicao.
export type PlanoLegacyId = "essencial" | "profissional" | "clinica";

export type ModuloId =
  | "estoque"
  | "comissoes"
  | "planos_tratamento"
  | "aftercare";

export type Funcionalidade =
  | "agenda"
  | "pacientes"
  | "financeiro"
  | "relatorios"
  | "transcricao_audio"
  | "assistente_ia"
  | "planos_tratamento"
  | "estoque"
  | "comissoes"
  | "aftercare"
  | "multi_profissional"
  | "avaliacoes_publicas";

export type PrecosPlano = {
  // Cobrado por mes em assinatura mensal.
  mensal: number;
  // Valor equivalente por mes em assinatura anual (anualTotal / 12).
  anual: number;
  // Valor cobrado em parcela unica anual.
  anualTotal: number;
};

export type InfoPlano = {
  id: PlanoSlug;
  nome: string;
  // Preco legacy (manter para compat). Reflete o valor mensal.
  preco: number;
  precos: PrecosPlano;
  // Limites em segundos (1 min = 60s) e numero de perguntas no mes.
  limiteTranscricaoSegundos: number;
  maxProfissionais: number;
  limiteAssistente: number;
  funcionalidades: Funcionalidade[];
  modulos: ModuloId[];
  destaque?: boolean;
};

// Degustacao mensal. Em v2 a IA esta inclusa nos planos pagos, mas mantemos
// um pequeno "primeiro uso" gratis no trial — aqui zerado porque o trial ja
// libera os limites do Clinica 10.
export const DEGUSTACAO_SMS = 10;
export const DEGUSTACAO_IA = 0;

// Preco por SMS avulso (excedente fora do pacote).
export const SMS_AVULSO_PRECO = 0.25;

// ---------------- Funcionalidades inclusas em TODOS os planos pagos ----------------

const TODAS_FUNCIONALIDADES: Funcionalidade[] = [
  "agenda",
  "pacientes",
  "financeiro",
  "relatorios",
  "transcricao_audio",
  "assistente_ia",
  "planos_tratamento",
  "estoque",
  "comissoes",
  "aftercare",
  "multi_profissional",
  "avaliacoes_publicas",
];

const TODOS_MODULOS: ModuloId[] = [
  "estoque",
  "comissoes",
  "planos_tratamento",
  "aftercare",
];

// ---------------- Planos ----------------

export const PLANOS: Record<PlanoSlug, InfoPlano> = {
  trial: {
    id: "trial",
    nome: "Trial (14 dias)",
    preco: 0,
    precos: { mensal: 0, anual: 0, anualTotal: 0 },
    // Trial entrega a experiencia do Clinica 10.
    limiteTranscricaoSegundos: 400 * 60,
    maxProfissionais: 10,
    limiteAssistente: 700,
    funcionalidades: TODAS_FUNCIONALIDADES,
    modulos: TODOS_MODULOS,
  },
  individual: {
    id: "individual",
    nome: "Individual",
    preco: 29.9,
    precos: { mensal: 39.9, anual: 29.9, anualTotal: 358.8 },
    limiteTranscricaoSegundos: 60 * 60,
    maxProfissionais: 1,
    limiteAssistente: 100,
    funcionalidades: TODAS_FUNCIONALIDADES,
    modulos: TODOS_MODULOS,
  },
  equipe3: {
    id: "equipe3",
    nome: "Equipe 3",
    preco: 39.9,
    precos: { mensal: 49.9, anual: 39.9, anualTotal: 478.8 },
    limiteTranscricaoSegundos: 120 * 60,
    maxProfissionais: 3,
    limiteAssistente: 200,
    destaque: true,
    funcionalidades: TODAS_FUNCIONALIDADES,
    modulos: TODOS_MODULOS,
  },
  equipe5: {
    id: "equipe5",
    nome: "Equipe 5",
    preco: 49.9,
    precos: { mensal: 59.9, anual: 49.9, anualTotal: 598.8 },
    limiteTranscricaoSegundos: 200 * 60,
    maxProfissionais: 5,
    limiteAssistente: 350,
    funcionalidades: TODAS_FUNCIONALIDADES,
    modulos: TODOS_MODULOS,
  },
  clinica10: {
    id: "clinica10",
    nome: "Clinica 10",
    preco: 69.9,
    precos: { mensal: 79.9, anual: 69.9, anualTotal: 838.8 },
    limiteTranscricaoSegundos: 400 * 60,
    maxProfissionais: 10,
    limiteAssistente: 700,
    funcionalidades: TODAS_FUNCIONALIDADES,
    modulos: TODOS_MODULOS,
  },
};

// Mapeamento de IDs legacy (v1) -> v2. Usado em getPlano() para tolerar
// tenants que ainda tenham o valor antigo na coluna `tenants.plano`.
const MAPA_PLANO_LEGACY: Record<PlanoLegacyId, PlanoId> = {
  essencial: "individual",
  profissional: "equipe3",
  clinica: "clinica10",
};

function mapearPlanoLegacy(id: string): string {
  if (id in MAPA_PLANO_LEGACY) {
    return MAPA_PLANO_LEGACY[id as PlanoLegacyId];
  }
  return id;
}

// ---------------- Add-ons SMS ----------------
// Em v2 os pacotes seguem os tres tamanhos (basico/intermediario/avancado)
// mas mantemos as chaves p1/p2/p3 para compat com a tabela addons_tenant
// e com consumidores existentes.

export type AddonTipo = "sms" | "ia";
export type AddonPacote = "p1" | "p2" | "p3";

export type InfoAddon = {
  tipo: AddonTipo;
  pacote: AddonPacote;
  nome: string;
  quantidade: number;
  preco: number;
};

export const ADDONS_SMS: Record<AddonPacote, InfoAddon> = {
  p1: {
    tipo: "sms",
    pacote: "p1",
    nome: "SMS Basico (100/mes)",
    quantidade: 100,
    preco: 19.9,
  },
  p2: {
    tipo: "sms",
    pacote: "p2",
    nome: "SMS Intermediario (300/mes)",
    quantidade: 300,
    preco: 39.9,
  },
  p3: {
    tipo: "sms",
    pacote: "p3",
    nome: "SMS Avancado (1.000/mes)",
    quantidade: 1000,
    preco: 89.9,
  },
};

// IA passou a ser INCLUSA nos planos pagos a partir de v2. Tabela mantida
// vazia para preservar a forma `Record<AddonPacote, InfoAddon>` esperada
// pelo restante do codigo, ate que a UI de planos seja migrada.
export const ADDONS_IA: Record<AddonPacote, InfoAddon> = {} as Record<
  AddonPacote,
  InfoAddon
>;

// ---------------- Modulos ----------------

export const MODULOS_INFO: Record<
  ModuloId,
  { nome: string; descricao: string; planosDisponiveis: PlanoId[] }
> = {
  estoque: {
    nome: "Estoque",
    descricao: "Controle de produtos, movimentacoes e alertas de baixa.",
    planosDisponiveis: ["individual", "equipe3", "equipe5", "clinica10"],
  },
  comissoes: {
    nome: "Comissoes",
    descricao: "Calculo de comissoes por profissional e procedimento.",
    planosDisponiveis: ["individual", "equipe3", "equipe5", "clinica10"],
  },
  planos_tratamento: {
    nome: "Planos de Tratamento",
    descricao: "Sessoes encadeadas, evolucao e alta do paciente.",
    planosDisponiveis: ["individual", "equipe3", "equipe5", "clinica10"],
  },
  aftercare: {
    nome: "Aftercare",
    descricao: "Acompanhamento pos-alta e retorno automatico.",
    planosDisponiveis: ["individual", "equipe3", "equipe5", "clinica10"],
  },
};

export const MODULOS_PADRAO: Record<ModuloId, boolean> = {
  estoque: true,
  comissoes: true,
  planos_tratamento: true,
  aftercare: true,
};

export type ModulosAtivos = Record<ModuloId, boolean>;

export function normalizarModulosAtivos(
  raw: unknown,
  plano: PlanoSlug | string | null | undefined,
): ModulosAtivos {
  const info = getPlano(plano);
  const dados = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const result = { ...MODULOS_PADRAO } as ModulosAtivos;

  (Object.keys(MODULOS_PADRAO) as ModuloId[]).forEach((mod) => {
    const disponivel = info.modulos.includes(mod);
    if (!disponivel) {
      result[mod] = false;
      return;
    }
    const v = dados[mod];
    result[mod] = typeof v === "boolean" ? v : true;
  });

  return result;
}

// ---------------- Helpers v2 ----------------

export function getPlano(planoId: string | null | undefined): InfoPlano {
  if (!planoId) return PLANOS.trial;
  const id = mapearPlanoLegacy(planoId);
  if (id in PLANOS) return PLANOS[id as PlanoSlug];
  return PLANOS.trial;
}

export function getAddon(
  tipo: AddonTipo,
  pacote: AddonPacote,
): InfoAddon | null {
  const tabela = tipo === "sms" ? ADDONS_SMS : ADDONS_IA;
  return tabela[pacote] ?? null;
}

export function listarAddons(tipo: AddonTipo): InfoAddon[] {
  const tabela = tipo === "sms" ? ADDONS_SMS : ADDONS_IA;
  return Object.values(tabela);
}

export function verificarFuncionalidade(
  planoId: string | null | undefined,
  funcionalidade: Funcionalidade,
): boolean {
  return getPlano(planoId).funcionalidades.includes(funcionalidade);
}

export function moduloDisponivelNoPlano(
  planoId: string | null | undefined,
  modulo: ModuloId,
): boolean {
  return getPlano(planoId).modulos.includes(modulo);
}

// ---------------- Compat (codigo existente usa estes) ----------------

export type Plano = PlanoSlug;

export function getInfoPlano(plano: string | null | undefined): InfoPlano {
  return getPlano(plano);
}

export function getLimiteTranscricao(plano: string | null | undefined): number {
  return getPlano(plano).limiteTranscricaoSegundos;
}

export function getNomePlano(plano: string | null | undefined): string {
  return getPlano(plano).nome;
}

export function getPrecoPlano(plano: string | null | undefined): number {
  return getPlano(plano).preco;
}

export function isPlanoComTranscricao(plano: string | null | undefined): boolean {
  return getLimiteTranscricao(plano) > 0;
}

export function getMaxProfissionais(plano: string | null | undefined): number {
  return getPlano(plano).maxProfissionais;
}

export function getLimiteAssistente(plano: string | null | undefined): number {
  return getPlano(plano).limiteAssistente;
}
