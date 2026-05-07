import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type AcaoLink = { label: string; href: string };
type AcaoBotao = { label: string; onClick: () => void };
export type AcaoEmptyState = AcaoLink | AcaoBotao;

interface EmptyStateProps {
  Icon: LucideIcon;
  titulo: string;
  descricao?: string;
  acao?: AcaoEmptyState;
  className?: string;
  /**
   * Renderiza no fluxo da pagina sem o contorno branco — util quando usado
   * dentro de uma seção ja com fundo proprio (ex: card vazio dentro de modal).
   */
  semContainer?: boolean;
}

function EmptyState({
  Icon,
  titulo,
  descricao,
  acao,
  className,
  semContainer,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        semContainer
          ? "p-6"
          : "rounded-xl border border-slate-200 bg-white p-8 sm:p-10",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="inline-flex items-center justify-center rounded-full bg-primary-surface"
        style={{ width: 120, height: 120 }}
      >
        <Icon
          width={64}
          height={64}
          strokeWidth={1.25}
          className="text-teal-300"
        />
      </div>

      <h2 className="mt-5 text-[18px] font-semibold text-slate-900">
        {titulo}
      </h2>
      {descricao ? (
        <p className="mt-2 max-w-[320px] text-[14px] text-slate-500 leading-relaxed">
          {descricao}
        </p>
      ) : null}

      {acao ? (
        "href" in acao ? (
          <Link
            href={acao.href}
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-[14px] font-medium text-white hover:bg-primary-dark transition-colors min-h-[44px]"
          >
            {acao.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={acao.onClick}
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-[14px] font-medium text-white hover:bg-primary-dark transition-colors min-h-[44px]"
          >
            {acao.label}
          </button>
        )
      ) : null}
    </div>
  );
}

export default EmptyState;
