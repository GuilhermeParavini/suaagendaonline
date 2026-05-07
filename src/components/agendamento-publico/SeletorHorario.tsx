"use client";

import { cn } from "@/lib/utils";
import type { Slot } from "@/actions/agendamento-publico";

interface SeletorHorarioProps {
  slots: Slot[];
  selected: string | null;
  onSelect: (time: string) => void;
}

function SeletorHorario({ slots, selected, onSelect }: SeletorHorarioProps) {
  if (slots.length === 0) {
    return (
      <p className="rounded-lg border border-slate-200 bg-white p-4 text-center text-sm text-slate-500">
        Sem horários disponíveis neste dia.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {slots.map((slot) => {
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
                "w-full rounded-lg border px-2 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                slot.available && !isSelected &&
                  "border-primary text-primary-text hover:bg-primary-surface",
                slot.available && isSelected &&
                  "border-primary bg-primary text-white",
                !slot.available &&
                  "border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed line-through",
              )}
            >
              {slot.time}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default SeletorHorario;
