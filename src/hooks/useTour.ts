"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export interface TourStep {
  /** Atributo `data-tour` do elemento alvo. */
  alvo: string;
  /** Alvo alternativo quando o primeiro nao esta disponivel (ex: mobile). */
  alvoAlternativo?: string;
  titulo: string;
  descricao: string;
  /** Lado preferido — `auto` decide pela posicao na tela. */
  posicao?: "auto" | "top" | "bottom" | "left" | "right";
}

export interface PosicaoTooltip {
  top: number;
  left: number;
  /** Lado em que o tooltip foi posicionado em relacao ao alvo. */
  lado: "top" | "bottom" | "left" | "right";
  /** Bounding box do alvo (para o overlay com recorte). */
  alvo: { top: number; left: number; width: number; height: number };
}

const TOOLTIP_LARGURA = 320;
const TOOLTIP_ALTURA_ESTIMADA = 160;
const SAFE_PADDING = 12;
const SCROLL_PADDING = 80;

function escolherLado(
  rect: DOMRect,
  preferida: TourStep["posicao"] = "auto",
): PosicaoTooltip["lado"] {
  if (preferida && preferida !== "auto") return preferida;

  const espacoBaixo = window.innerHeight - rect.bottom;
  const espacoCima = rect.top;
  const espacoDireita = window.innerWidth - rect.right;
  const espacoEsquerda = rect.left;

  // Em mobile, prioriza vertical (cima/baixo).
  const ehMobile = window.innerWidth < 640;
  if (ehMobile) {
    return espacoBaixo >= TOOLTIP_ALTURA_ESTIMADA + SAFE_PADDING
      ? "bottom"
      : "top";
  }

  const candidatos: Array<{ lado: PosicaoTooltip["lado"]; espaco: number }> = [
    { lado: "bottom", espaco: espacoBaixo },
    { lado: "top", espaco: espacoCima },
    { lado: "right", espaco: espacoDireita },
    { lado: "left", espaco: espacoEsquerda },
  ];
  candidatos.sort((a, b) => b.espaco - a.espaco);
  return candidatos[0].lado;
}

function calcularPosicao(
  el: Element,
  step: TourStep,
): PosicaoTooltip {
  const rect = el.getBoundingClientRect();
  const lado = escolherLado(rect, step.posicao);

  let top = 0;
  let left = 0;
  switch (lado) {
    case "bottom":
      top = rect.bottom + SAFE_PADDING;
      left = Math.min(
        Math.max(SAFE_PADDING, rect.left + rect.width / 2 - TOOLTIP_LARGURA / 2),
        window.innerWidth - TOOLTIP_LARGURA - SAFE_PADDING,
      );
      break;
    case "top":
      top = rect.top - TOOLTIP_ALTURA_ESTIMADA - SAFE_PADDING;
      left = Math.min(
        Math.max(SAFE_PADDING, rect.left + rect.width / 2 - TOOLTIP_LARGURA / 2),
        window.innerWidth - TOOLTIP_LARGURA - SAFE_PADDING,
      );
      break;
    case "right":
      top = Math.max(
        SAFE_PADDING,
        rect.top + rect.height / 2 - TOOLTIP_ALTURA_ESTIMADA / 2,
      );
      left = rect.right + SAFE_PADDING;
      break;
    case "left":
      top = Math.max(
        SAFE_PADDING,
        rect.top + rect.height / 2 - TOOLTIP_ALTURA_ESTIMADA / 2,
      );
      left = rect.left - TOOLTIP_LARGURA - SAFE_PADDING;
      break;
  }

  // Clamp para nunca sair da viewport.
  top = Math.max(SAFE_PADDING, top);
  if (top + TOOLTIP_ALTURA_ESTIMADA > window.innerHeight - SAFE_PADDING) {
    top = Math.max(SAFE_PADDING, window.innerHeight - TOOLTIP_ALTURA_ESTIMADA - SAFE_PADDING);
  }

  return {
    top,
    left,
    lado,
    alvo: {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    },
  };
}

function elementoVisivel(rect: DOMRect): boolean {
  return (
    rect.top >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.left >= 0 &&
    rect.right <= window.innerWidth
  );
}

export interface UseTourState {
  ativo: boolean;
  stepAtual: number;
  totalSteps: number;
  step: TourStep | null;
  posicao: PosicaoTooltip | null;
  iniciar: () => void;
  avancar: () => void;
  voltar: () => void;
  pular: () => void;
  fechar: () => void;
}

export function useTour(steps: TourStep[]): UseTourState {
  const [ativo, setAtivo] = useState(false);
  const [stepAtual, setStepAtual] = useState(0);
  const [posicao, setPosicao] = useState<PosicaoTooltip | null>(null);

  const step = useMemo(
    () => (ativo ? (steps[stepAtual] ?? null) : null),
    [ativo, stepAtual, steps],
  );

  const recalcular = useCallback(() => {
    if (!step) return;
    if (typeof document === "undefined") return;
    const sel = `[data-tour="${step.alvo}"]`;
    let el = document.querySelector<HTMLElement>(sel);
    if (!el && step.alvoAlternativo) {
      el = document.querySelector<HTMLElement>(
        `[data-tour="${step.alvoAlternativo}"]`,
      );
    }
    if (!el) {
      setPosicao(null);
      return;
    }
    if (!elementoVisivel(el.getBoundingClientRect())) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Aguarda o scroll para recalcular.
      window.setTimeout(() => {
        if (!el) return;
        setPosicao(calcularPosicao(el, step));
      }, 250);
      return;
    }
    setPosicao(calcularPosicao(el, step));
  }, [step]);

  // Recalcula posicao ao mudar step ou redimensionar.
  useEffect(() => {
    if (!ativo) return;
    // recalcular() pode chamar setPosicao sincronicamente.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recalcular();
    const handler = () => recalcular();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [ativo, recalcular]);

  // Bloqueia scroll do body durante o tour para evitar que o usuario perca o
  // alvo destacado.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!ativo) return;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflowAnterior;
    };
  }, [ativo]);

  // Esc fecha o tour.
  useEffect(() => {
    if (!ativo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setAtivo(false);
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        setStepAtual((s) => {
          if (s + 1 >= steps.length) {
            setAtivo(false);
            return s;
          }
          return s + 1;
        });
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setStepAtual((s) => Math.max(0, s - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ativo, steps.length]);

  // Garante que o step recalcula quando o tooltip pula para um item que
  // depende de scroll/scroll padding.
  useEffect(() => {
    if (!ativo) return;
    const id = window.setTimeout(() => {
      const sel = `[data-tour="${steps[stepAtual]?.alvo}"]`;
      const el = document.querySelector<HTMLElement>(sel);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (
          rect.top < SCROLL_PADDING ||
          rect.bottom > window.innerHeight - SCROLL_PADDING
        ) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }, 50);
    return () => window.clearTimeout(id);
  }, [ativo, stepAtual, steps]);

  const iniciar = useCallback(() => {
    setStepAtual(0);
    setAtivo(true);
  }, []);

  const avancar = useCallback(() => {
    setStepAtual((s) => {
      if (s + 1 >= steps.length) {
        setAtivo(false);
        return s;
      }
      return s + 1;
    });
  }, [steps.length]);

  const voltar = useCallback(() => {
    setStepAtual((s) => Math.max(0, s - 1));
  }, []);

  const pular = useCallback(() => setAtivo(false), []);
  const fechar = useCallback(() => setAtivo(false), []);

  return {
    ativo,
    stepAtual,
    totalSteps: steps.length,
    step,
    posicao,
    iniciar,
    avancar,
    voltar,
    pular,
    fechar,
  };
}
