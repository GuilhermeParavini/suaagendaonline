"use client";

import { useCallback, useRef, useState } from "react";

export type SwipeDirection = "left" | "right" | null;

interface UseSwipeOptions {
  /** Distancia minima (px) para reconhecer um swipe ao soltar. */
  threshold?: number;
  /** Distancia horizontal necessaria antes do lock (default 10px). */
  lockHorizontalThreshold?: number;
  /** Distancia vertical que cancela o gesto (lock vertical) — default 10px. */
  lockVerticalThreshold?: number;
  /** Callback ao concluir um swipe valido (alem do threshold). */
  onSwipe?: (direction: Exclude<SwipeDirection, null>) => void;
  /** Permite consumir o gesto enquanto ainda em andamento. */
  onMove?: (deltaX: number) => void;
  /** Desativa o handler quando true. */
  disabled?: boolean;
}

interface UseSwipeReturn {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  /** Delta X atual (positivo = direita, negativo = esquerda). 0 quando idle. */
  deltaX: number;
  /** True enquanto o gesto horizontal esta lockado e em movimento. */
  swiping: boolean;
  /** Direcao final apos onTouchEnd (limpa no proximo touchstart). */
  direction: SwipeDirection;
}

/**
 * Detecta swipe horizontal em um elemento. Mantem lock direcional para nao
 * conflitar com scroll vertical: a primeira direcao a ultrapassar o limiar
 * vence; a outra e ignorada ate o gesto encerrar.
 *
 * Nao manipula DOM nem aplica transform — apenas retorna deltaX e flags
 * para o consumidor decidir o efeito visual.
 */
export function useSwipe(options: UseSwipeOptions = {}): UseSwipeReturn {
  const {
    threshold = 80,
    lockHorizontalThreshold = 10,
    lockVerticalThreshold = 10,
    onSwipe,
    onMove,
    disabled = false,
  } = options;

  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const lock = useRef<"horizontal" | "vertical" | null>(null);
  const [deltaX, setDeltaX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [direction, setDirection] = useState<SwipeDirection>(null);

  const reset = useCallback(() => {
    startX.current = null;
    startY.current = null;
    lock.current = null;
    setDeltaX(0);
    setSwiping(false);
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      const t = e.touches[0];
      if (!t) return;
      startX.current = t.clientX;
      startY.current = t.clientY;
      lock.current = null;
      setDirection(null);
      setDeltaX(0);
    },
    [disabled],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
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
          setSwiping(true);
        } else {
          return;
        }
      }

      if (lock.current === "vertical") return;

      // Locked horizontal: bloqueia scroll vertical.
      if (e.cancelable) e.preventDefault();
      setDeltaX(dx);
      onMove?.(dx);
    },
    [disabled, lockHorizontalThreshold, lockVerticalThreshold, onMove],
  );

  const onTouchEnd = useCallback(
    () => {
      if (disabled) {
        reset();
        return;
      }
      if (lock.current === "horizontal") {
        const dx = deltaX;
        const dir: SwipeDirection =
          Math.abs(dx) >= threshold ? (dx > 0 ? "right" : "left") : null;
        if (dir) {
          setDirection(dir);
          onSwipe?.(dir);
        }
      }
      reset();
    },
    [deltaX, disabled, onSwipe, reset, threshold],
  );

  return { onTouchStart, onTouchMove, onTouchEnd, deltaX, swiping, direction };
}
