/**
 * Constantes para classes de micro-interacoes definidas em globals.css.
 *
 * Uso:
 *   <div className={sao.checkPop} />
 *   <button className={cn("rounded-lg", sucesso && sao.pulseSuccess)} />
 *
 * Todas as animacoes respeitam prefers-reduced-motion (zeradas via @media
 * em globals.css). Use `triggerOnce` para animar apenas uma vez por mount —
 * util quando aplicada via key ou state booleano.
 */
export const sao = {
  /** Pop com bounce no final. ~320ms. Use em check de confirmacao. */
  checkPop: "sao-check-pop",
  /** Halo verde radial. ~900ms. Use ao salvar com sucesso. */
  pulseSuccess: "sao-pulse-success",
  /** Confetti vertical. ~900ms. Use ao concluir checklist 100%. */
  confetti: "sao-confetti",
  /** Slide-down sutil. ~220ms. Use em items que aparecem em listas. */
  slideIn: "sao-slide-in",
  /** Shake horizontal. ~380ms. Use em erros de validacao de campos. */
  shake: "sao-shake",
} as const;

export type SaoAnimation = keyof typeof sao;
