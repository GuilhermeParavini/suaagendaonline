"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  endOfMonth,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface CalendarioMensalProps {
  visibleMonth: Date;
  onChangeMonth: (date: Date) => void;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  diasSemanaDisponiveis: number[];
  datasIndisponiveis?: string[];
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function CalendarioMensal({
  visibleMonth,
  onChangeMonth,
  selectedDate,
  onSelectDate,
  diasSemanaDisponiveis,
  datasIndisponiveis,
}: CalendarioMensalProps) {
  const indisponiveisSet = new Set(datasIndisponiveis ?? []);
  const today = startOfDay(new Date());
  const monthStart = startOfMonth(visibleMonth);
  const monthEnd = endOfMonth(visibleMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const dias = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const mesAno = format(visibleMonth, "MMMM yyyy", { locale: ptBR });
  const mesAnoCapital = mesAno.charAt(0).toUpperCase() + mesAno.slice(1);

  const labels = ["D", "S", "T", "Q", "Q", "S", "S"];

  const podeAndarPraTras = !isSameMonth(visibleMonth, today) || isBefore(today, monthStart);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Mês anterior"
          onClick={() => onChangeMonth(subMonths(visibleMonth, 1))}
          disabled={!podeAndarPraTras}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ChevronLeft size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <h3 className="text-base font-semibold text-slate-900">
          {mesAnoCapital}
        </h3>
        <button
          type="button"
          aria-label="Próximo mês"
          onClick={() => onChangeMonth(addMonths(visibleMonth, 1))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ChevronRight size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center">
        {labels.map((l, i) => (
          <span
            key={`${l}-${i}`}
            className="py-1 text-[11px] font-medium text-slate-500"
          >
            {l}
          </span>
        ))}
      </div>

      <ul className="grid grid-cols-7 gap-1">
        {dias.map((dia) => {
          const inMonth = isSameMonth(dia, visibleMonth);
          const isPast = isBefore(dia, today);
          const diaSemana = dia.getDay();
          const temHorario = diasSemanaDisponiveis.includes(diaSemana);
          const indisponivel = indisponiveisSet.has(isoDate(dia));
          const isToday = isSameDay(dia, today);
          const isSelected = selectedDate ? isSameDay(dia, selectedDate) : false;
          const enabled = inMonth && !isPast && temHorario && !indisponivel;

          return (
            <li key={dia.toISOString()} className="aspect-square">
              <button
                type="button"
                onClick={() => enabled && onSelectDate(dia)}
                disabled={!enabled}
                aria-label={format(dia, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                aria-pressed={isSelected}
                title={indisponivel ? "Dia indisponível" : undefined}
                className={cn(
                  "flex h-full w-full items-center justify-center rounded-full text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  !inMonth && "text-slate-300 cursor-default",
                  inMonth && !enabled && !indisponivel && "text-slate-300 cursor-not-allowed",
                  inMonth && indisponivel && "text-slate-300 line-through cursor-not-allowed",
                  enabled && !isSelected && !isToday &&
                    "text-slate-900 hover:bg-primary-surface",
                  enabled && isToday && !isSelected &&
                    "bg-primary text-white font-semibold",
                  enabled && isSelected &&
                    "bg-primary-surface text-primary-dark border border-primary font-semibold",
                )}
              >
                {format(dia, "d")}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default CalendarioMensal;
