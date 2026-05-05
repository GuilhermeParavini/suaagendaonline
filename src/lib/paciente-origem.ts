export const ORIGENS_VALIDAS = [
  'instagram',
  'google',
  'indicacao',
  'facebook',
  'site',
  'outros',
] as const;

export type OrigemPaciente = (typeof ORIGENS_VALIDAS)[number];

export const ORIGEM_LABEL: Record<OrigemPaciente, string> = {
  instagram: 'Instagram',
  google: 'Google',
  indicacao: 'Indicação',
  facebook: 'Facebook',
  site: 'Site',
  outros: 'Outros',
};

export function isOrigemValida(v: unknown): v is OrigemPaciente {
  return typeof v === 'string' && (ORIGENS_VALIDAS as readonly string[]).includes(v);
}

export function normalizarOrigem(
  origemRaw: unknown,
  detalheRaw: unknown,
): { origem: OrigemPaciente | null; origem_detalhe: string | null } {
  if (!isOrigemValida(origemRaw)) {
    return { origem: null, origem_detalhe: null };
  }
  if (origemRaw !== 'outros') {
    return { origem: origemRaw, origem_detalhe: null };
  }
  const detalhe =
    typeof detalheRaw === 'string' ? detalheRaw.trim().slice(0, 100) : '';
  return {
    origem: 'outros',
    origem_detalhe: detalhe.length > 0 ? detalhe : null,
  };
}

export function normalizarMedida(
  raw: unknown,
  min: number,
  max: number,
): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return Math.round(n * 100) / 100;
}
