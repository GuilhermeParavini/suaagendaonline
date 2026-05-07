"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  titulo: string;
  children: ReactNode;
  /** Estado inicial. Default true (aberto). */
  defaultOpen?: boolean;
  /** Icone Lucide opcional ao lado do titulo. */
  Icon?: LucideIcon;
  /** Classes extras no wrapper. */
  className?: string;
  /** Sub-rotulo opcional a direita (ex: "Opcional", "Obrigatorio"). */
  hint?: string;
}

/**
 * Secao colapsavel reutilizavel com animacao via grid-template-rows
 * (transicao suave sem precisar medir altura). Header e um button real
 * para acessibilidade — `aria-expanded` e `aria-controls` corretos.
 *
 * Borda inferior sutil entre secoes consecutivas (use ao empilhar varias).
 */
function CollapsibleSection({
  titulo,
  children,
  defaultOpen = true,
  Icon,
  className,
  hint,
}: CollapsibleSectionProps) {
  const [aberto, setAberto] = useState(defaultOpen);
  const id = useId();
  const conteudoId = `${id}-conteudo`;

  return (
    <section
      className={cn(
        "border-b border-slate-100 last:border-b-0",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-controls={conteudoId}
        className="flex w-full items-center justify-between gap-3 py-4 text-left transition-colors hover:text-primary-text"
      >
        <span className="flex items-center gap-2 min-w-0">
          {Icon ? (
            <Icon
              size={18}
              strokeWidth={1.5}
              aria-hidden="true"
              className="shrink-0 text-slate-500"
            />
          ) : null}
          <span className="text-[16px] font-semibold text-slate-900 truncate">
            {titulo}
          </span>
          {hint ? (
            <span className="text-[12px] text-slate-500 font-normal shrink-0">
              {hint}
            </span>
          ) : null}
        </span>
        <ChevronDown
          size={18}
          strokeWidth={1.5}
          aria-hidden="true"
          className={cn(
            "shrink-0 text-slate-500 transition-transform duration-200",
            aberto && "rotate-180",
          )}
        />
      </button>

      {/*
       * Grid-rows trick para animar height auto:
       * - row "0fr" → "1fr" anima sem precisar medir scrollHeight
       * - overflow-hidden no filho garante clipping durante a transicao
       */}
      <div
        id={conteudoId}
        role="region"
        aria-hidden={!aberto}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          aberto ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className={cn("pb-4", aberto ? "" : "invisible")}>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

export default CollapsibleSection;
