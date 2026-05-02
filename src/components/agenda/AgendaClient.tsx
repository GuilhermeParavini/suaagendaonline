"use client";

import { useState, useTransition, useCallback } from "react";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  getAgendamentosDia,
  type AgendamentoDia,
} from "@/actions/agendamentos";
import CalendarioSemanal, { type ViewMode } from "./CalendarioSemanal";
import ListaHorarios from "./ListaHorarios";

interface AgendaClientProps {
  initialDate: string;
  initialAgendamentos: AgendamentoDia[];
}

function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function toIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function AgendaClient({ initialDate, initialAgendamentos }: AgendaClientProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(() =>
    parseIsoDateLocal(initialDate),
  );
  const [agendamentos, setAgendamentos] = useState<AgendamentoDia[]>(
    initialAgendamentos,
  );
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("semana");
  const [isPending, startTransition] = useTransition();

  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(date);
    setError(null);
    startTransition(async () => {
      const result = await getAgendamentosDia(toIsoDate(date));
      if (!result.ok) {
        setError(result.error);
        setAgendamentos([]);
      } else {
        setAgendamentos(result.agendamentos);
      }
    });
  }, []);

  const dataExtenso = format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR });
  const dataExtensoCapital =
    dataExtenso.charAt(0).toUpperCase() + dataExtenso.slice(1);

  return (
    <div className="space-y-5 relative pb-20">
      <header className="space-y-1">
        <h1 className="text-[22px] font-semibold text-slate-900 leading-tight">
          Agenda
        </h1>
        <p className="text-sm text-slate-500">{dataExtensoCapital}</p>
      </header>

      <CalendarioSemanal
        selectedDate={selectedDate}
        onSelectDate={handleSelectDate}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
      />

      <section
        aria-busy={isPending}
        aria-live="polite"
        className={isPending ? "opacity-60 transition-opacity" : "transition-opacity"}
      >
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : (
          <ListaHorarios agendamentos={agendamentos} />
        )}
      </section>

      <button
        type="button"
        aria-label="Novo agendamento"
        className="fixed right-4 bottom-[calc(56px+env(safe-area-inset-bottom)+16px)] lg:bottom-6 lg:right-6 h-14 w-14 rounded-full bg-primary text-white shadow-md hover:shadow-lg hover:bg-primary/90 transition flex items-center justify-center z-40"
      >
        <Plus size={24} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}

export default AgendaClient;
