"use client";

import { useEffect, useRef } from "react";

const PREFIX = "suaagendaonline:scroll:";
const DEBOUNCE_MS = 200;

/**
 * Salva e restaura a posicao de scroll por chave em sessionStorage.
 * - Restauracao acontece UMA vez no mount (depois de um requestAnimationFrame
 *   para esperar o conteudo da pagina ser pintado).
 * - Salva durante o scroll com debounce para nao escrever a cada pixel.
 * - Salva tambem no unmount como ultima posicao confirmada.
 *
 * Use chaves estaveis por listagem (ex: "scroll-pacientes"). O valor fica
 * apenas em sessionStorage — limpa quando o navegador fecha.
 */
export function useScrollRestore(key: string) {
  const restauradoRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fullKey = `${PREFIX}${key}`;

    // Restauracao (uma vez por mount).
    if (!restauradoRef.current) {
      try {
        const saved = window.sessionStorage.getItem(fullKey);
        const top = saved ? Number(saved) : 0;
        if (Number.isFinite(top) && top > 0) {
          // rAF garante que o layout ja esteja pintado.
          requestAnimationFrame(() => {
            window.scrollTo({ top, behavior: "instant" as ScrollBehavior });
          });
        }
      } catch {
        // ignore (modo privado)
      }
      restauradoRef.current = true;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    const salvar = () => {
      try {
        window.sessionStorage.setItem(
          fullKey,
          String(window.scrollY || document.documentElement.scrollTop || 0),
        );
      } catch {
        // ignore
      }
    };

    const onScroll = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(salvar, DEBOUNCE_MS);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (timer) clearTimeout(timer);
      // Salva posicao final ao desmontar.
      salvar();
    };
  }, [key]);
}
