"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepStatus = "concluido" | "atual" | "futuro";

export interface FormStepperItem {
  id: string;
  label: string;
  status: StepStatus;
}

interface FormStepperProps {
  steps: FormStepperItem[];
  className?: string;
  /** Texto curto para leitores de tela (ex: "Etapa 2 de 3"). */
  ariaLabel?: string;
}

/**
 * Stepper compacto para fluxos multi-step. Mostra circulos numerados
 * (com check quando concluido), labels abaixo e conectores entre etapas.
 *
 * Mobile-first: labels truncam em telas estreitas mas o circulo permanece
 * visivel. `aria-current="step"` na etapa atual.
 */
function FormStepper({ steps, className, ariaLabel }: FormStepperProps) {
  if (steps.length === 0) return null;
  const total = steps.length;
  const atualIdx = steps.findIndex((s) => s.status === "atual");
  const posLabel =
    atualIdx >= 0
      ? `Etapa ${atualIdx + 1} de ${total}`
      : `${total} etapas`;

  return (
    <nav
      aria-label={ariaLabel ?? posLabel}
      className={cn("w-full", className)}
    >
      <ol className="flex items-start gap-2">
        {steps.map((s, i) => {
          const concluido = s.status === "concluido";
          const atual = s.status === "atual";
          const isLast = i === steps.length - 1;
          return (
            <li
              key={s.id}
              aria-current={atual ? "step" : undefined}
              className="flex flex-1 items-start"
            >
              <div className="flex flex-1 flex-col items-center min-w-0">
                <div className="flex w-full items-center">
                  {/* Conector esquerdo (invisivel no primeiro) */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-0.5 flex-1 transition-colors",
                      i === 0
                        ? "invisible"
                        : concluido || atual
                          ? "bg-primary"
                          : "bg-slate-200",
                    )}
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold transition-colors",
                      concluido
                        ? "bg-primary text-white"
                        : atual
                          ? "bg-primary-surface text-primary-text ring-2 ring-primary"
                          : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {concluido ? (
                      <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  {/* Conector direito (invisivel no ultimo) */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-0.5 flex-1 transition-colors",
                      isLast
                        ? "invisible"
                        : concluido
                          ? "bg-primary"
                          : "bg-slate-200",
                    )}
                  />
                </div>
                <span
                  className={cn(
                    "mt-1 text-[11px] font-medium leading-tight text-center w-full truncate",
                    atual
                      ? "text-primary-text"
                      : concluido
                        ? "text-slate-700"
                        : "text-slate-500",
                  )}
                >
                  {s.label}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default FormStepper;
