"use client";

import { useEffect, useState, type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { useSwipe } from "@/hooks/useSwipe";
import { cn } from "@/lib/utils";

export interface SwipeAction {
  acao: () => void;
  icone: LucideIcon;
  /** Cor de fundo do trilho revelado (Tailwind class, ex: "bg-[#22C55E]"). */
  cor: string;
  label: string;
}

interface SwipeableCardProps {
  children: ReactNode;
  /** Acao para swipe direita (trilho aparece a esquerda). */
  onSwipeRight?: SwipeAction;
  /** Acao para swipe esquerda (trilho aparece a direita). */
  onSwipeLeft?: SwipeAction;
  threshold?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * Card com swipe horizontal para revelar acao destrutiva ou de confirmacao.
 *
 * Touch-only (touch events). Em mouse/trackpad o card se comporta como qualquer
 * outro elemento — nenhuma acao de swipe e disparada.
 *
 * Direcao:
 * - Swipe direita → revela trilho VERMELHO/VERDE conforme `onSwipeRight`
 *   alinhado a esquerda (o card move para a direita).
 * - Swipe esquerda → revela trilho a direita (card move para a esquerda).
 *
 * O fundo colorido tem opacidade proporcional ao deltaX. Atingindo o threshold,
 * a acao e executada e o card volta a posicao original com snap-back animado.
 *
 * Marcado com `data-swipeable-card="true"` para que o useSwipeNavigation
 * (gestos de navegacao na agenda) ignore touchstart originados aqui dentro.
 */
function SwipeableCard({
  children,
  onSwipeRight,
  onSwipeLeft,
  threshold = 80,
  disabled = false,
  className,
}: SwipeableCardProps) {
  const [snapBack, setSnapBack] = useState(false);
  const [executing, setExecuting] = useState(false);

  const efetivamenteDesabilitado =
    disabled || (!onSwipeRight && !onSwipeLeft);

  const handleSwipe = (dir: "left" | "right") => {
    if (efetivamenteDesabilitado || executing) return;
    const action = dir === "right" ? onSwipeRight : onSwipeLeft;
    if (!action) {
      setSnapBack(true);
      return;
    }
    setExecuting(true);
    setSnapBack(true);
    // Da tempo da animacao de retorno acontecer antes de disparar a acao.
    window.setTimeout(() => {
      action.acao();
      setExecuting(false);
    }, 180);
  };

  const swipe = useSwipe({
    threshold,
    disabled: efetivamenteDesabilitado,
    onSwipe: handleSwipe,
  });

  // Limpa o flag de snap-back logo apos a transicao terminar para que o
  // proximo gesto comece sem animacao acumulada.
  useEffect(() => {
    if (!snapBack) return;
    const t = window.setTimeout(() => setSnapBack(false), 220);
    return () => window.clearTimeout(t);
  }, [snapBack]);

  const dxBruto = swipe.deltaX;
  // Bloqueia direcao sem acao configurada para nao revelar trilho vazio.
  const dx = (() => {
    if (dxBruto > 0 && !onSwipeRight) return 0;
    if (dxBruto < 0 && !onSwipeLeft) return 0;
    return dxBruto;
  })();

  const opacidade = Math.min(1, Math.abs(dx) / threshold);
  const acaoAtiva = Math.abs(dx) >= threshold;

  const trilhoEsq = onSwipeRight; // aparece a esquerda quando arrasta p/ direita
  const trilhoDir = onSwipeLeft; // aparece a direita quando arrasta p/ esquerda

  const IconeEsq = trilhoEsq?.icone;
  const IconeDir = trilhoDir?.icone;

  return (
    <div
      data-swipeable-card="true"
      className={cn("relative overflow-hidden rounded-lg", className)}
    >
      {/* Trilho a esquerda (swipe direita). */}
      {trilhoEsq ? (
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-y-0 left-0 flex items-center justify-start gap-2 pl-4 pr-3 text-white",
            trilhoEsq.cor,
          )}
          style={{
            width: Math.max(0, dx),
            opacity: dx > 0 ? opacidade : 0,
          }}
        >
          {IconeEsq ? (
            <IconeEsq
              size={18}
              strokeWidth={2}
              aria-hidden="true"
              className={cn(
                "shrink-0 transition-transform",
                acaoAtiva && "scale-110",
              )}
            />
          ) : null}
          <span className="text-[13px] font-semibold whitespace-nowrap">
            {trilhoEsq.label}
          </span>
        </div>
      ) : null}

      {/* Trilho a direita (swipe esquerda). */}
      {trilhoDir ? (
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-y-0 right-0 flex items-center justify-end gap-2 pl-3 pr-4 text-white",
            trilhoDir.cor,
          )}
          style={{
            width: Math.max(0, -dx),
            opacity: dx < 0 ? opacidade : 0,
          }}
        >
          <span className="text-[13px] font-semibold whitespace-nowrap">
            {trilhoDir.label}
          </span>
          {IconeDir ? (
            <IconeDir
              size={18}
              strokeWidth={2}
              aria-hidden="true"
              className={cn(
                "shrink-0 transition-transform",
                acaoAtiva && "scale-110",
              )}
            />
          ) : null}
        </div>
      ) : null}

      <div
        onTouchStart={swipe.onTouchStart}
        onTouchMove={swipe.onTouchMove}
        onTouchEnd={swipe.onTouchEnd}
        onTouchCancel={swipe.onTouchEnd}
        style={{
          transform: `translate3d(${snapBack ? 0 : dx}px, 0, 0)`,
          transition: snapBack
            ? "transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1)"
            : "none",
          willChange: "transform",
          touchAction: efetivamenteDesabilitado ? "auto" : "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default SwipeableCard;
