"use client";

import { cn } from "@/lib/utils";

export type AgendaView = "dia" | "semana" | "mes";

interface AgendaToggleProps {
  value: AgendaView;
  onChange: (next: AgendaView) => void;
}

const OPCOES: { value: AgendaView; label: string }[] = [
  { value: "dia", label: "Dia" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mês" },
];

function AgendaToggle({ value, onChange }: AgendaToggleProps) {
  return (
    <div
      role="tablist"
      aria-label="Visualização da agenda"
      className="inline-flex rounded-lg border border-slate-200 bg-white p-1"
    >
      {OPCOES.map((op) => {
        const active = op.value === value;
        return (
          <button
            key={op.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(op.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-primary text-white"
                : "text-slate-500 hover:text-slate-900",
            )}
          >
            {op.label}
          </button>
        );
      })}
    </div>
  );
}

export default AgendaToggle;
