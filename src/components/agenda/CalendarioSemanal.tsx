"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addWeeks,
  format,
  isSameDay,
  startOfWeek,
  subWeeks,
  addDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export type ViewMode = "dia" | "semana" | "mes";

interface CalendarioSemanalProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  diasComAgendamento?: Set<string>;
  datasIndisponiveis?: Set<string>;
  hideViewToggle?: boolean;
}

const viewLabels: Record<ViewMode, string> = {
  dia: "Dia",
  semana: "Semana",
  mes: "Mes",
};

function toDayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function CalendarioSemanal({
  selectedDate,
  onSelectDate,
  viewMode,
  onChangeViewMode,
  diasComAgendamento,
  datasIndisponiveis,
  hideViewToggle,
}: CalendarioSemanalProps) {
  const inicioSemana = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const dias = Array.from({ length: 7 }, (_, i) => addDays(inicioSemana, i));
  const hoje = new Date();

  const mesAno = format(selectedDate, "MMMM yyyy", { locale: ptBR });
  const mesAnoCapitalizado =
    mesAno.charAt(0).toUpperCase() + mesAno.slice(1);

  const handlePrev = () => onSelectDate(subWeeks(selectedDate, 1));
  const handleNext = () => onSelectDate(addWeeks(selectedDate, 1));

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Semana anterior"
          onClick={handlePrev}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ChevronLeft size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <h2 className="text-base font-semibold text-slate-900">
          {mesAnoCapitalizado}
        </h2>
        <button
          type="button"
          aria-label="Proxima semana"
          onClick={handleNext}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ChevronRight size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>

      <ul className="grid grid-cols-7 gap-1">
        {dias.map((dia) => {
          const isSelected = isSameDay(dia, selectedDate);
          const isToday = isSameDay(dia, hoje);
          const temAgendamento = diasComAgendamento?.has(toDayKey(dia)) ?? false;
          const indisponivel =
            datasIndisponiveis?.has(toDayKey(dia)) ?? false;

          const labelDia = format(dia, "EEEEEE", { locale: ptBR }).slice(0, 3);
          const labelDiaCapital =
            labelDia.charAt(0).toUpperCase() + labelDia.slice(1);

          return (
            <li key={dia.toISOString()}>
              <button
                type="button"
                onClick={() => onSelectDate(dia)}
                aria-pressed={isSelected}
                aria-label={format(dia, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                className={cn(
                  "flex w-full flex-col items-center gap-1 rounded-lg py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  isSelected
                    ? "bg-primary-surface border border-primary"
                    : "border border-transparent hover:bg-slate-100",
                )}
              >
                <span className="text-[11px] font-medium text-slate-400 leading-none">
                  {labelDiaCapital}
                </span>
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm leading-none",
                    isToday
                      ? "bg-primary text-white font-semibold"
                      : isSelected
                      ? "text-primary-dark font-semibold"
                      : indisponivel
                      ? "bg-amber-50 text-amber-700 font-medium"
                      : temAgendamento
                      ? "bg-primary-surface text-primary-dark font-medium"
                      : "text-slate-900",
                  )}
                >
                  {format(dia, "d")}
                </span>
                {indisponivel && !isSelected && !isToday ? (
                  <span
                    aria-hidden="true"
                    className="h-1 w-1 rounded-full bg-amber-500"
                  />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {!hideViewToggle ? (
        <div
          role="tablist"
          aria-label="Modo de visualizacao"
          className="inline-flex rounded-lg border border-slate-200 bg-white p-1"
        >
          {(Object.keys(viewLabels) as ViewMode[]).map((mode) => {
            const active = mode === viewMode;
            const enabled = mode === "semana";
            return (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={!enabled}
                onClick={() => enabled && onChangeViewMode(mode)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  active
                    ? "bg-primary text-white"
                    : enabled
                    ? "text-slate-500 hover:text-slate-900"
                    : "text-slate-300 cursor-not-allowed",
                )}
              >
                {viewLabels[mode]}
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export default CalendarioSemanal;
