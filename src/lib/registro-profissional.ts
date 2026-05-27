export type RegistroSugestao = {
  orgao: string;
  label: string;
  placeholder: string;
  prefixo: string;
  exemploSufixo: string;
};

const MAPA: Record<string, RegistroSugestao> = {
  fisioterapia: {
    orgao: 'CREFITO',
    label: 'CREFITO',
    placeholder: '3/12345-F',
    prefixo: 'CREFITO-',
    exemploSufixo: '3/12345-F',
  },
  'terapia ocupacional': {
    orgao: 'CREFITO',
    label: 'CREFITO',
    placeholder: '3/12345-TO',
    prefixo: 'CREFITO-',
    exemploSufixo: '3/12345-TO',
  },
  nutricao: {
    orgao: 'CRN',
    label: 'CRN',
    placeholder: '3/12345',
    prefixo: 'CRN-',
    exemploSufixo: '3/12345',
  },
  psicologia: {
    orgao: 'CRP',
    label: 'CRP',
    placeholder: '12/12345',
    prefixo: 'CRP ',
    exemploSufixo: '12/12345',
  },
  odontologia: {
    orgao: 'CRO',
    label: 'CRO',
    placeholder: 'SC 12345',
    prefixo: 'CRO-',
    exemploSufixo: 'SC 12345',
  },
  fonoaudiologia: {
    orgao: 'CRFa',
    label: 'CRFa',
    placeholder: '3-12345',
    prefixo: 'CRFa ',
    exemploSufixo: '3-12345',
  },
  medicina: {
    orgao: 'CRM',
    label: 'CRM',
    placeholder: 'SC 12345',
    prefixo: 'CRM/',
    exemploSufixo: 'SC 12345',
  },
  cardiologia: {
    orgao: 'CRM',
    label: 'CRM',
    placeholder: 'SC 12345',
    prefixo: 'CRM/',
    exemploSufixo: 'SC 12345',
  },
  enfermagem: {
    orgao: 'COREN',
    label: 'COREN',
    placeholder: 'SC 123456',
    prefixo: 'COREN-',
    exemploSufixo: 'SC 123456',
  },
  podologia: {
    orgao: 'Registro geral',
    label: 'Registro profissional',
    placeholder: 'Ex: RG-POD 12345',
    prefixo: '',
    exemploSufixo: 'RG-POD 12345',
  },
  estetica: {
    orgao: 'Registro profissional (opcional)',
    label: 'Registro profissional (opcional)',
    placeholder: 'Ex: certificação, curso ou registro',
    prefixo: '',
    exemploSufixo: '',
  },
  barbearia: {
    orgao: 'Registro profissional (opcional)',
    label: 'Registro profissional (opcional)',
    placeholder: 'Ex: certificação ou curso',
    prefixo: '',
    exemploSufixo: '',
  },
  outro: {
    orgao: 'Registro profissional (opcional)',
    label: 'Registro profissional (opcional)',
    placeholder: 'Número ou identificação do registro',
    prefixo: '',
    exemploSufixo: '',
  },
};

const PADRAO: RegistroSugestao = {
  orgao: 'Registro profissional',
  label: 'Registro profissional',
  placeholder: 'Número do registro',
  prefixo: '',
  exemploSufixo: '',
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
