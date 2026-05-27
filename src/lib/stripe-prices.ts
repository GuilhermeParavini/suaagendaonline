// Price IDs do Stripe (Live) para os 4 planos x 2 periodos.
// Mantidos aqui para facilitar atualizacao quando precos mudarem.
// IMPORTANTE: estes sao os IDs do ambiente LIVE. Para testes use IDs de test
// mode (substituir via env vars no futuro).

import type { PlanoId } from './planos';

export type PeriodoAssinatura = 'mensal' | 'anual';

export const STRIPE_PRICES: Record<
  PlanoId,
  Record<PeriodoAssinatura, string>
> = {
  individual: {
    mensal: 'price_1TbUg9HMjexBCWIPiAN0wjxf',
    anual: 'price_1TbUg9HMjexBCWIPe9UfRzGc',
  },
  equipe3: {
    mensal: 'price_1TbUhyHMjexBCWIPgBYnwTua',
    anual: 'price_1TbUhyHMjexBCWIPOWG4Gssx',
  },
  equipe5: {
    mensal: 'price_1TbUjbHMjexBCWIPob0hSInm',
    anual: 'price_1TbUjbHMjexBCWIPWEdlMsMv',
  },
  clinica10: {
    mensal: 'price_1TbUksHMjexBCWIPCyAWJHbS',
    anual: 'price_1TbUksHMjexBCWIPLSF4Rdy4',
  },
} as const;

export function getStripePriceId(
  planoId: PlanoId,
  periodo: PeriodoAssinatura,
): string {
  return STRIPE_PRICES[planoId][periodo];
}

// Mapa reverso priceId -> { planoId, periodo } para uso no webhook
// (Stripe entrega price.id, precisamos descobrir qual plano).
const REVERSE_INDEX: Record<
  string,
  { planoId: PlanoId; periodo: PeriodoAssinatura }
> = (() => {
  const acc: Record<
    string,
    { planoId: PlanoId; periodo: PeriodoAssinatura }
  > = {};
  (Object.keys(STRIPE_PRICES) as PlanoId[]).forEach((planoId) => {
    (['mensal', 'anual'] as PeriodoAssinatura[]).forEach((periodo) => {
      acc[STRIPE_PRICES[planoId][periodo]] = { planoId, periodo };
    });
  });
  return acc;
})();

export function getPlanoByStripePriceId(
  priceId: string | null | undefined,
): { planoId: PlanoId; periodo: PeriodoAssinatura } | null {
  if (!priceId) return null;
  return REVERSE_INDEX[priceId] ?? null;
}
