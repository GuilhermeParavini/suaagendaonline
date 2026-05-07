"use client";

import { useCallback, useRef, useState } from "react";

interface UseSwipeNavigationOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Distancia minima (px) para reconhecer swipe ao soltar. Default 50. */
  threshold?: number;
  /** Ignora gestos abaixo desse limiar horizontal (default 10). */
  lockHorizontalThreshold?: number;
  /** Cancela se o gesto for predominantemente vertical (default 10). */
  lockVerticalThreshold?: number;
  /** Atributo data-* que, se presente em ancestral do alvo, aborta o gesto. */
  ignoreSelector?: string;
  disabled?: boolean;
}

interface UseSwipeNavigationReturn {
  bind: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onTouchCancel: (e: React.TouchEvent) => void;
  };
  /** Delta X atual durante o gesto (0 quando inativo). */
  deltaX: number;
  /** True enquanto um gesto horizontal valido esta em andamento. */
  active: boolean;
}

/**
 * Detecta swipe horizontal em area "vazia" para navegar entre periodos
 * (dia/semana/mes). Diferente de SwipeableCard:
 * - nao move o conteudo
 * - aborta se o gesto comecar dentro de um SwipeableCard (data attribute)
 * - so dispara onSwipeLeft/Right ao soltar e ultrapassar o threshold
 */
export function useSwipeNavigation(
  options: UseSwipeNavigationOptions = {},
): UseSwipeNavigationReturn {
  const {
    onSwipeLeft,
    onSwipeRight,
    threshold = 50,
    lockHorizontalThreshold = 10,
    lockVerticalThreshold = 10,
    ignoreSelector = "[data-swipeable-card='true']",
    disabled = false,
  } = options;

  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const lock = useRef<"horizontal" | "vertical" | null>(null);
  const aborted = useRef(false);
  const [deltaX, setDeltaX] = useState(0);
  const [active, setActive] = useState(false);

  const reset = useCallback(() => {
    startX.current = null;
    startY.current = null;
    lock.current = null;
    aborted.current = false;
    setDeltaX(0);
    setActive(false);
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      const t = e.touches[0];
      if (!t) return;
      // Se o gesto comecou sobre um SwipeableCard, deixe o card tratar.
      const target = e.target as HTMLElement | null;
      if (target && ignoreSelector && target.closest(ignoreSelector)) {
        aborted.current = true;
        return;
      }
      startX.current = t.clientX;
      startY.current = t.clientY;
      lock.current = null;
      aborted.current = false;
      setDeltaX(0);
    },
    [disabled, ignoreSelector],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || aborted.current) return;
      if (startX.current === null || startY.current === null) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - startX.current;
      const dy = t.clientY - startY.current;

      if (lock.current === null) {
        if (Math.abs(dy) >= lockVerticalThreshold && Math.abs(dy) > Math.abs(dx)) {
          lock.current = "vertical";
          return;
        }
        if (Math.abs(dx) >= lockHorizontalThreshold) {
          lock.current = "horizontal";
          setActive(true);
        } else {
          return;
        }
      }

      if (lock.current === "vertical") return;
      setDeltaX(dx);
    },
    [disabled, lockHorizontalThreshold, lockVerticalThreshold],
  );

  const onTouchEnd = useCallback(
    () => {
      if (disabled || aborted.current) {
        reset();
        return;
      }
      if (lock.current === "horizontal") {
        const dx = deltaX;
        if (dx <= -threshold) onSwipeLeft?.();
        else if (dx >= threshold) onSwipeRight?.();
      }
      reset();
    },
    [deltaX, disabled, onSwipeLeft, onSwipeRight, reset, threshold],
  );

  return {
    bind: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel: onTouchEnd,
    },
    deltaX,
    active,
  };
}
