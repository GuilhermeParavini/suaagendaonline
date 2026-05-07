import Link from "next/link";
import { Lock, MessageCircle, Sparkles } from "lucide-react";
import type { UsoAssistente } from "@/actions/assistente-uso";
import { cn } from "@/lib/utils";

interface CardUsoAssistenteProps {
  uso: UsoAssistente;
}

function CardUsoAssistente({ uso }: CardUsoAssistenteProps) {
  const semAssistente = uso.limite === 0;

  if (semAssistente) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Lock size={16} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">
              Assistente IA não disponível no plano Essencial
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Faça upgrade para perguntar dados sobre sua agenda e financeiro
              em linguagem natural.
            </p>
            <Link
              href="/configuracoes"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-text hover:underline"
            >
              Fazer upgrade
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const cor =
    uso.percentual >= 80
      ? "bg-red-500"
      : uso.percentual >= 50
        ? "bg-amber-500"
        : "bg-primary";
  const isTrial = uso.plano === "trial";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-surface text-primary-dark">
            <MessageCircle size={16} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Assistente IA
            </p>
            <p className="text-xs text-slate-500">Uso do mês atual</p>
          </div>
        </div>
        {isTrial ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-surface px-2 py-0.5 text-[10px] font-medium text-primary-dark">
            <Sparkles size={10} strokeWidth={1.5} aria-hidden="true" />
            Trial
          </span>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn("h-full rounded-full transition-all", cor)}
            style={{
              width: `${Math.max(2, Math.round(uso.percentual))}%`,
            }}
          />
        </div>
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <p className="text-slate-700">
            <span className="font-semibold text-slate-900">
              {uso.perguntasUsadas}
            </span>{" "}
            de {uso.limite} perguntas
          </p>
          <p className="text-slate-500">{Math.round(uso.percentual)}%</p>
        </div>
      </div>
    </div>
  );
}

export default CardUsoAssistente;
