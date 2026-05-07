"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Configuracao do gesto.
 * - `threshold`: deslocamento minimo (em px) para disparar o refresh.
 * - `maxPull`: distancia maxima exibida (forca de "elastico").
 * - `dampening`: divisor aplicado ao delta para criar resistencia visual.
 */
const THRESHOLD = 80;
const MAX_PULL = 140;
const DAMPENING = 2;
/** Quando o usuario inicia o pull com offset menor que isto, ainda permitimos. */
const SCROLL_TOP_TOLERANCE = 2;

export type EstadoPullToRefresh =
  | "idle"
  | "pulling"
  | "ready"
  | "refreshing";

export interface UsePullToRefreshResult {
  estado: EstadoPullToRefresh;
  /** Pixels deslocados ja com damping aplicado (0..MAX_PULL). */
  pull: number;
  /** Progresso 0..1 ate o threshold. */
  progresso: number;
}

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  /** Desliga o handler (ex: quando uma scroll-area filha esta no topo). */
  desabilitado?: boolean;
}

/**
 * Hook que detecta gesto pull-down quando o documento esta no topo, expoe
 * estado/progresso para o componente desenhar o indicador, e chama
 * `onRefresh` quando o usuario solta apos passar o threshold.
 *
 * Apenas mobile — escuta touchstart/touchmove/touchend no window.
 */
export function usePullToRefresh({
  onRefresh,
  desabilitado,
}: UsePullToRefreshOptions): UsePullToRefreshResult {
  const [estado, setEstado] = useState<EstadoPullToRefresh>("idle");
  const [pull, setPull] = useState(0);
  const startYRef = useRef<number | null>(null);
  const ativoRef = useRef(false);

  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const finalizar = useCallback(() => {
    startYRef.current = null;
    ativoRef.current = false;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (desabilitado) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (estado === "refreshing") return;
      // Considera apenas multitouch=1 e quando o documento esta no topo.
      if (e.touches.length !== 1) return;
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      if (scrollY > SCROLL_TOP_TOLERANCE) return;
      startYRef.current = e.touches[0].clientY;
      ativoRef.current = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!ativoRef.current || startYRef.current === null) return;
      if (estado === "refreshing") return;

      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0) {
        // Movimento para cima — cancela.
        finalizar();
        setPull(0);
        setEstado("idle");
        return;
      }

      // Aplica damping para sensacao de elastico.
      const pulledRaw = Math.min(MAX_PULL, dy / DAMPENING);
      setPull(pulledRaw);
      setEstado(pulledRaw >= THRESHOLD ? "ready" : "pulling");
    };

    const handleTouchEnd = async () => {
      if (!ativoRef.current) return;
      const passou = pull >= THRESHOLD;
      finalizar();

      if (!passou) {
        setPull(0);
        setEstado("idle");
        return;
      }

      setEstado("refreshing");
      setPull(THRESHOLD);

      try {
        await onRefreshRef.current();
      } finally {
        // Pequeno delay para nao "flicar" o indicador instantaneamente.
        setTimeout(() => {
          setPull(0);
          setEstado("idle");
        }, 250);
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [estado, pull, finalizar, desabilitado]);

  const progresso = Math.min(1, pull / THRESHOLD);

  return { estado, pull, progresso };
}
