export type RegistroSugestao = {
  orgao: string;
  label: string;
  placeholder: string;
};

const MAPA: Record<string, RegistroSugestao> = {
  fisioterapia: {
    orgao: 'CREFITO',
    label: 'CREFITO',
    placeholder: 'Ex: CREFITO-3/12345-F',
  },
  'terapia ocupacional': {
    orgao: 'CREFITO',
    label: 'CREFITO',
    placeholder: 'Ex: CREFITO-3/12345-TO',
  },
  nutricao: {
    orgao: 'CRN',
    label: 'CRN',
    placeholder: 'Ex: CRN-3/12345',
  },
  psicologia: {
    orgao: 'CRP',
    label: 'CRP',
    placeholder: 'Ex: CRP 12/12345',
  },
  odontologia: {
    orgao: 'CRO',
    label: 'CRO',
    placeholder: 'Ex: CRO-SC 12345',
  },
  fonoaudiologia: {
    orgao: 'CRFa',
    label: 'CRFa',
    placeholder: 'Ex: CRFa 3-12345',
  },
  medicina: {
    orgao: 'CRM',
    label: 'CRM',
    placeholder: 'Ex: CRM/SC 12345',
  },
  cardiologia: {
    orgao: 'CRM',
    label: 'CRM',
    placeholder: 'Ex: CRM/SC 12345',
  },
  enfermagem: {
    orgao: 'COREN',
    label: 'COREN',
    placeholder: 'Ex: COREN-SC 123456',
  },
  podologia: {
    orgao: 'Registro geral',
    label: 'Registro profissional',
    placeholder: 'Ex: RG-POD 12345',
  },
};

const PADRAO: RegistroSugestao = {
  orgao: 'Registro profissional',
  label: 'Registro profissional',
  placeholder: 'Número do registro',
};

function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function getRegistroSugestao(
  especialidade: string | null | undefined,
): RegistroSugestao {
  if (!especialidade) return PADRAO;
  const key = normalizar(especialidade);
  return MAPA[key] ?? PADRAO;
}
