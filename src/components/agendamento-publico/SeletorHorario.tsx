"use client";

import { Sun, Sunrise, Sunset } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Slot } from "@/actions/agendamento-publico";

interface SeletorHorarioProps {
  slots: Slot[];
  selected: string | null;
  onSelect: (time: string) => void;
}

type Periodo = "manha" | "tarde" | "noite";

const PERIODOS: Array<{
  id: Periodo;
  label: string;
  Icon: typeof Sun;
}> = [
  { id: "manha", label: "Manha", Icon: Sunrise },
  { id: "tarde", label: "Tarde", Icon: Sun },
  { id: "noite", label: "Noite", Icon: Sunset },
];

function periodoDoSlot(time: string): Periodo {
  const [hh] = time.split(":").map(Number);
  if (hh < 12) return "manha";
  if (hh < 18) return "tarde";
  return "noite";
}

function SeletorHorario({ slots, selected, onSelect }: SeletorHorarioProps) {
  if (slots.length === 0) {
    return (
      <p className="rounded-lg border border-slate-200 bg-white p-4 text-center text-sm text-slate-500">
        Sem horários disponíveis neste dia.
      </p>
    );
  }

  const grupos: Record<Periodo, Slot[]> = {
    manha: [],
    tarde: [],
    noite: [],
  };
  for (const slot of slots) {
    grupos[periodoDoSlot(slot.time)].push(slot);
  }

  const periodosComSlots = PERIODOS.filter((p) => grupos[p.id].length > 0);

  return (
    <div className="space-y-4">
      {periodosComSlots.map(({ id, label, Icon }) => {
        const lista = grupos[id];
        const algumDisponivel = lista.some((s) => s.available);
        return (
          <div key={id} className="space-y-2">
            <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
              <Icon
                size={14}
                strokeWidth={1.5}
                aria-hidden="true"
                className="text-slate-500"
              />
              {label}
              {!algumDisponivel ? (
                <span className="text-[12px] font-normal text-slate-500">
                  (todos ocupados)
                </span>
              ) : null}
            </p>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {lista.map((slot) => {
                const isSelected = slot.time === selected;
                return (
                  <li key={slot.time}>
                    <button
                      type="button"
                      onClick={() => slot.available && onSelect(slot.time)}
                      disabled={!slot.available}
                      aria-pressed={isSelected}
                      aria-label={`Horário ${slot.time}${slot.available ? "" : " indisponível"}`}
                      className={cn(
                        "w-full rounded-full border px-3 py-2 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 min-h-[44px]",
                        slot.available && !isSelected &&
                          "border-primary bg-white text-primary-text hover:bg-primary-surface",
                        slot.available && isSelected &&
                          "border-primary bg-primary text-white",
                        !slot.available &&
                          "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed line-through",
                      )}
                    >
                      {slot.time}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export default SeletorHorario;
