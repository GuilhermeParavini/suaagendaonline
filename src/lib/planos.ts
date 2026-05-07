// Sistema de planos v2 (3 planos + addons SMS + addons IA + degustacao mensal).
// Tabelas relacionadas (ja criadas no Supabase): planos_sistema, addons_tenant,
// uso_sms, sms_log, tenants.modulos_ativos jsonb, pacientes.contato_preferencial.

export type PlanoId = "essencial" | "profissional" | "clinica";

// O id "trial" nao existe na tabela planos_sistema — durante o trial, o tenant
// ganha as funcionalidades do Profissional gratuitamente por 14 dias.
export type PlanoSlug = PlanoId | "trial";

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

export type InfoPlano = {
  id: PlanoSlug;
  nome: string;
  preco: number;
  // Limites legacy (mantidos para retrocompat com o restante do codigo).
  limiteTranscricaoSegundos: number;
  maxProfissionais: number;
  limiteAssistente: number;
  // Novo modelo v2.
  funcionalidades: Funcionalidade[];
  modulos: ModuloId[];
  destaque?: boolean;
};

// Limites de degustacao gratuita mensal (recursos pagos com amostra gratis).
export const DEGUSTACAO_SMS = 10;
export const DEGUSTACAO_IA = 10;

// Preco por SMS avulso (fora do pacote contratado).
export const SMS_AVULSO_PRECO = 0.3;

// ---------------- Planos ----------------

export const PLANOS: Record<PlanoSlug, InfoPlano> = {
  trial: {
    id: "trial",
    nome: "Trial (14 dias)",
    preco: 0,
    limiteTranscricaoSegundos: 600,
    maxProfissionais: 1,
    limiteAssistente: 50,
    funcionalidades: [
      "agenda",
      "pacientes",
      "financeiro",
      "relatorios",
      "transcricao_audio",
      "assistente_ia",
      "planos_tratamento",
      "avaliacoes_publicas",
    ],
    modulos: ["planos_tratamento"],
  },
  essencial: {
    id: "essencial",
    nome: "Essencial",
    preco: 59.9,
    limiteTranscricaoSegundos: 0,
    maxProfissionais: 1,
    limiteAssistente: 0,
    funcionalidades: [
      "agenda",
      "pacientes",
      "financeiro",
      "relatorios",
      "avaliacoes_publicas",
    ],
    modulos: [],
  },
  profissional: {
    id: "profissional",
    nome: "Profissional",
    preco: 79.9,
    limiteTranscricaoSegundos: 3600,
    maxProfissionais: 1,
    limiteAssistente: 300,
    destaque: true,
    funcionalidades: [
      "agenda",
      "pacientes",
      "financeiro",
      "relatorios",
      "transcricao_audio",
      "assistente_ia",
      "planos_tratamento",
      "avaliacoes_publicas",
    ],
    modulos: ["planos_tratamento"],
  },
  clinica: {
    id: "clinica",
    nome: "Clinica",
    preco: 119.9,
    limiteTranscricaoSegundos: 9000,
    maxProfissionais: 5,
    limiteAssistente: 1000,
    funcionalidades: [
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
    ],
    modulos: ["estoque", "comissoes", "planos_tratamento", "aftercare"],
  },
};

// ---------------- Add-ons ----------------

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
    nome: "Pacote 50 SMS",
    quantidade: 50,
    preco: 9.9,
  },
  p2: {
    tipo: "sms",
    pacote: "p2",
    nome: "Pacote 100 SMS",
    quantidade: 100,
    preco: 16.9,
  },
  p3: {
    tipo: "sms",
    pacote: "p3",
    nome: "Pacote 500 SMS",
    quantidade: 500,
    preco: 64.9,
  },
};

export const ADDONS_IA: Record<AddonPacote, InfoAddon> = {
  p1: {
    tipo: "ia",
    pacote: "p1",
    nome: "Pacote 50 perguntas IA",
    quantidade: 50,
    preco: 14.9,
  },
  p2: {
    tipo: "ia",
    pacote: "p2",
    nome: "Pacote 200 perguntas IA",
    quantidade: 200,
    preco: 49.9,
  },
  p3: {
    tipo: "ia",
    pacote: "p3",
    nome: "Pacote 500 perguntas IA",
    quantidade: 500,
    preco: 99.9,
  },
};

// ---------------- Modulos ----------------

export const MODULOS_INFO: Record<
  ModuloId,
  { nome: string; descricao: string; planosDisponiveis: PlanoId[] }
> = {
  estoque: {
    nome: "Estoque",
    descricao: "Controle de produtos, movimentacoes e alertas de baixa.",
    planosDisponiveis: ["clinica"],
  },
  comissoes: {
    nome: "Comissoes",
    descricao: "Calculo de comissoes por profissional e procedimento.",
    planosDisponiveis: ["clinica"],
  },
  planos_tratamento: {
    nome: "Planos de Tratamento",
    descricao: "Sessoes encadeadas, evolucao e alta do paciente.",
    planosDisponiveis: ["profissional", "clinica"],
  },
  aftercare: {
    nome: "Aftercare",
    descricao: "Acompanhamento pos-alta e retorno automatico.",
    planosDisponiveis: ["clinica"],
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
  if (planoId && planoId in PLANOS) return PLANOS[planoId as PlanoSlug];
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
