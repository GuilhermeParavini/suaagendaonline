export type Plano = 'trial' | 'essencial' | 'profissional' | 'clinica';

export type InfoPlano = {
  id: Plano;
  nome: string;
  preco: number;
  limiteTranscricaoSegundos: number;
  maxProfissionais: number;
};

export const PLANOS: Record<Plano, InfoPlano> = {
  trial: {
    id: 'trial',
    nome: 'Trial (14 dias)',
    preco: 0,
    limiteTranscricaoSegundos: 600,
    maxProfissionais: 1,
  },
  essencial: {
    id: 'essencial',
    nome: 'Essencial',
    preco: 59.9,
    limiteTranscricaoSegundos: 0,
    maxProfissionais: 1,
  },
  profissional: {
    id: 'profissional',
    nome: 'Profissional',
    preco: 79.9,
    limiteTranscricaoSegundos: 3600,
    maxProfissionais: 1,
  },
  clinica: {
    id: 'clinica',
    nome: 'Clínica',
    preco: 119.9,
    limiteTranscricaoSegundos: 9000,
    maxProfissionais: 5,
  },
};

export function getInfoPlano(plano: string | null | undefined): InfoPlano {
  if (plano && plano in PLANOS) return PLANOS[plano as Plano];
  return PLANOS.trial;
}

export function getLimiteTranscricao(plano: string | null | undefined): number {
  return getInfoPlano(plano).limiteTranscricaoSegundos;
}

export function getNomePlano(plano: string | null | undefined): string {
  return getInfoPlano(plano).nome;
}

export function getPrecoPlano(plano: string | null | undefined): number {
  return getInfoPlano(plano).preco;
}

export function isPlanoComTranscricao(plano: string | null | undefined): boolean {
  return getLimiteTranscricao(plano) > 0;
}

export function getMaxProfissionais(plano: string | null | undefined): number {
  return getInfoPlano(plano).maxProfissionais;
}
