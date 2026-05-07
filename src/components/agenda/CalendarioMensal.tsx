"use client";

import { useMemo } from "react";
import {
  addMonths,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
  addDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import type { DiaResumoMensal } from "@/actions/agendamentos";
import { cn } from "@/lib/utils";

interface CalendarioMensalProps {
  visibleMonth: Date;
  onChangeMonth: (date: Date) => void;
  selectedDate: Date;
  dias: DiaResumoMensal[];
  onSelectDay: (date: Date) => void;
}

const STATUS_DOT_COLOR: Record<string, string> = {
  agendado: "bg-blue-500",
  confirmado: "bg-teal-500",
  em_atendimento: "bg-amber-500",
  concluido: "bg-green-500",
  faltou: "bg-red-500",
  reagendado: "bg-purple-500",
};

const ORDEM_STATUS = [
  "agendado",
  "confirmado",
  "em_atendimento",
  "concluido",
  "faltou",
  "reagendado",
] as const;

const SEMANA_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function isoKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function CalendarioMensal({
  visibleMonth,
  onChangeMonth,
  selectedDate,
  dias,
  onSelectDay,
}: CalendarioMensalProps) {
  const hoje = new Date();
  const mesLabel = format(visibleMonth, "MMMM yyyy", { locale: ptBR });
  const mesLabelCapital = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1);

  const inicioGrid = startOfWeek(startOfMonth(visibleMonth), {
    weekStartsOn: 1,
  });
  const celulas = useMemo(() => {
    const arr: Date[] = [];
    const base = inicioGrid;
    for (let i = 0; i < 42; i++) {
      arr.push(addDays(base, i));
    }
    // Trim para parar no fim da última semana que toca o mês
    const ultimoDoMes = endOfMonth(visibleMonth);
    const limite = addDays(
      startOfWeek(ultimoDoMes, { weekStartsOn: 1 }),
      6,
    );
    return arr.filter((d) => d <= limite);
  }, [inicioGrid, visibleMonth]);

  const mapDias = useMemo(() => {
    const m = new Map<string, DiaResumoMensal>();
    for (const r of dias) m.set(r.data, r);
    return m;
  }, [dias]);

  const mesAtual = isSameMonth(visibleMonth, hoje);
  const ehMobile = false; // Tailwind responsive classes lidam visualmente

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Mes anterior"
          onClick={() => onChangeMonth(subMonths(visibleMonth, 1))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ChevronLeft size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <div className="flex flex-col items-center gap-1">
          <h2 className="text-base font-semibold text-slate-900">
            {mesLabelCapital}
          </h2>
          {!mesAtual ? (
            <button
              type="button"
              onClick={() => onChangeMonth(startOfMonth(new Date()))}
              className="text-xs font-medium text-primary-text hover:underline"
            >
              Voltar para hoje
            </button>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Proximo mes"
          onClick={() => onChangeMonth(addMonths(visibleMonth, 1))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ChevronRight size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px text-center text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {SEMANA_LABELS.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>

      <div
        className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-slate-200"
        aria-label="Calendario mensal"
      >
        {celulas.map((dia) => {
          const key = isoKey(dia);
          const resumo = mapDias.get(key);
          const isHoje = isSameDay(dia, hoje);
          const isSelecionado = isSameDay(dia, selectedDate);
          const noMes = isSameMonth(dia, visibleMonth);
          const feriado = resumo?.feriado ?? null;
          const bloqueado = resumo?.bloqueado ?? false;
          const total = resumo?.total ?? 0;

          const dotsStatus = ORDEM_STATUS.filter(
            (s) => (resumo?.porStatus[s] ?? 0) > 0,
          );

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(dia)}
              aria-label={format(dia, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
              className={cn(
                "relative flex min-h-[64px] sm:min-h-[100px] flex-col items-stretch gap-1 px-1.5 sm:px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                noMes ? "bg-slate-50" : "bg-white",
                feriado || bloqueado
                  ? "bg-amber-50 hover:bg-amber-100"
                  : "hover:bg-slate-50",
                isSelecionado && "ring-2 ring-primary ring-inset",
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs leading-none",
                    isHoje
                      ? "bg-primary text-white font-semibold"
                      : noMes
                        ? "text-slate-500"
                        : "text-slate-700 font-medium",
                  )}
                >
                  {format(dia, "d")}
                </span>
                {bloqueado || feriado ? (
                  <CalendarIcon
                    size={11}
                    strokeWidth={1.5}
                    aria-hidden="true"
                    className="text-amber-600"
                  />
                ) : null}
              </div>

              {feriado ? (
                <p className="hidden sm:block truncate text-[10px] font-medium text-amber-700">
                  {feriado.nome}
                </p>
              ) : null}

              {/* Mobile: bolinhas de status */}
              {total > 0 && noMes ? (
                <div className="sm:hidden mt-auto flex flex-wrap items-center gap-0.5">
                  {dotsStatus.slice(0, 4).map((s) => (
                    <span
                      key={s}
                      aria-hidden="true"
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        STATUS_DOT_COLOR[s] ?? "bg-slate-300",
                      )}
                    />
                  ))}
                  <span className="ml-0.5 text-[10px] font-semibold text-slate-700">
                    {total}
                  </span>
                </div>
              ) : null}

              {/* Desktop: mini-cards */}
              {total > 0 && noMes ? (
                <ul className="hidden sm:flex flex-col gap-0.5 mt-auto">
                  {(resumo?.amostras ?? []).slice(0, 3).map((a) => {
                    const dt = new Date(a.data_hora);
                    const hh = dt.toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "UTC",
                    });
                    return (
                      <li
                        key={a.id}
                        className="truncate rounded bg-primary-surface px-1.5 py-0.5 text-[10px] font-medium text-primary-dark"
                      >
                        {hh} {a.nome ?? "Paciente"}
                      </li>
                    );
                  })}
                  {total > 3 ? (
                    <li className="text-[10px] font-medium text-slate-500">
                      +{total - 3} mais
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-500">
        Toque em um dia para abrir a visualização diária.
      </p>
      {ehMobile ? null : null}
    </section>
  );
}

export default CalendarioMensal;
