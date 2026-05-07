"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, ChevronUp, PlayCircle, Sparkles } from "lucide-react";
import {
  type PassoOnboarding,
  type ProgressoOnboarding,
} from "@/actions/onboarding";
import { cn } from "@/lib/utils";

interface ChecklistOnboardingProps {
  progresso: ProgressoOnboarding;
  onIniciarTour?: () => void;
}

const STORAGE_DISMISS = "suaagendaonline:onboarding:dispensado:v1";
const STORAGE_LINK_COMPARTILHADO =
  "suaagendaonline:onboarding:link_compartilhado:v1";

function ChecklistOnboarding({
  progresso,
  onIniciarTour,
}: ChecklistOnboardingProps) {
  const [pronto, setPronto] = useState(false);
  const [dispensado, setDispensado] = useState(false);
  const [linkCompartilhado, setLinkCompartilhado] = useState(false);
  const [recolhido, setRecolhido] = useState(false);

  // Hidrata o estado do localStorage. Sem isso o SSR mostra/esconde diferente
  // do client e haveria flash. Usamos `pronto` como gate para nao renderizar
  // antes da hidratacao.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const dismiss = window.localStorage.getItem(STORAGE_DISMISS);
      const link = window.localStorage.getItem(STORAGE_LINK_COMPARTILHADO);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDispensado(dismiss === "1");
      setLinkCompartilhado(link === "1");
    } catch {
      // ignore — modo privado pode bloquear localStorage
    }
    setPronto(true);
  }, []);

  // Recompoem a lista mesclando o passo client-side `link_compartilhado`
  // com o que o servidor calculou. O total real considera os 7 passos.
  const passos: PassoOnboarding[] = progresso.passos.map((p) =>
    p.id === "link_compartilhado"
      ? { ...p, concluido: linkCompartilhado }
      : p,
  );
  const totalConcluidos = passos.filter((p) => p.concluido).length;
  const total = passos.length;
  const percentual = total === 0 ? 0 : Math.round((totalConcluidos / total) * 100);
  const tudoConcluido = totalConcluidos === total;

  const handleDispensar = () => {
    try {
      window.localStorage.setItem(STORAGE_DISMISS, "1");
    } catch {
      // ignore
    }
    setDispensado(true);
  };

  if (!pronto) return null;
  if (dispensado) return null;

  return (
    <section
      aria-label="Checklist de configuracao"
      className="rounded-xl border border-primary/30 bg-primary-surface p-5 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <Sparkles
            size={18}
            strokeWidth={1.5}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-primary-text"
          />
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-slate-900">
              {tudoConcluido
                ? "Parabens! Tudo pronto."
                : "Configure seu consultorio"}
            </h2>
            <p className="text-[13px] text-slate-700">
              {totalConcluidos} de {total} concluidos ({percentual}%)
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setRecolhido((v) => !v)}
          aria-label={recolhido ? "Expandir checklist" : "Recolher checklist"}
          className="inline-flex items-center justify-center rounded p-1 text-slate-500 hover:bg-white/60"
        >
          {recolhido ? (
            <ChevronDown size={18} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <ChevronUp size={18} strokeWidth={1.5} aria-hidden="true" />
          )}
        </button>
      </header>

      <div
        className="h-2 overflow-hidden rounded-full bg-white"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={totalConcluidos}
      >
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${percentual}%` }}
        />
      </div>

      {!recolhido ? (
        <ul className="space-y-1.5">
          {passos.map((p) => (
            <ItemPasso
              key={p.id}
              passo={p}
              onMarcarLinkCompartilhado={() => {
                try {
                  window.localStorage.setItem(STORAGE_LINK_COMPARTILHADO, "1");
                } catch {
                  // ignore
                }
                setLinkCompartilhado(true);
              }}
            />
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={handleDispensar}
          className="text-[13px] font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          Dispensar
        </button>
        {onIniciarTour ? (
          <button
            type="button"
            onClick={onIniciarTour}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary bg-white px-3 py-2 text-[13px] font-medium text-primary-text hover:bg-primary-surface transition-colors"
          >
            <PlayCircle size={14} strokeWidth={1.5} aria-hidden="true" />
            {tudoConcluido ? "Ver tour" : "Refazer tour"}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function ItemPasso({
  passo,
  onMarcarLinkCompartilhado,
}: {
  passo: PassoOnboarding;
  onMarcarLinkCompartilhado: () => void;
}) {
  if (passo.concluido) {
    return (
      <li className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] text-slate-500 line-through">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#22C55E] shrink-0">
          <Check
            size={12}
            strokeWidth={2.5}
            aria-hidden="true"
            className="text-white"
          />
        </span>
        <span className="flex-1 truncate">{passo.titulo}</span>
      </li>
    );
  }

  const conteudo = (
    <>
      <span
        className={cn(
          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
          "border-slate-300 bg-white",
        )}
        aria-hidden="true"
      />
      <span className="flex-1 text-[14px] text-slate-900 truncate">
        {passo.titulo}
      </span>
      <ArrowRight
        size={14}
        strokeWidth={1.5}
        aria-hidden="true"
        className="shrink-0 text-slate-500"
      />
    </>
  );

  return (
    <li>
      <Link
        href={passo.url}
        onClick={
          passo.id === "link_compartilhado"
            ? onMarcarLinkCompartilhado
            : undefined
        }
        className="flex items-center gap-2.5 rounded-lg bg-white/70 px-3 py-2.5 text-left transition-colors hover:bg-white"
      >
        {conteudo}
      </Link>
    </li>
  );
}

export default ChecklistOnboarding;
