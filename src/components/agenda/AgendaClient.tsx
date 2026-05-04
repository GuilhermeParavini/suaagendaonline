"use client";

import { useState, useTransition, useCallback } from "react";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRouter } from "next/navigation";
import {
  getAgendamentosDia,
  type AgendamentoDia,
  type IndisponivelDia,
  type StatusAgendamento,
} from "@/actions/agendamentos";
import { getBloqueioTipoMeta } from "@/lib/bloqueio-tipos";
import CalendarioSemanal, { type ViewMode } from "./CalendarioSemanal";
import ListaHorarios from "./ListaHorarios";
import AgendamentoModal from "./AgendamentoModal";
import NovoAgendamentoModal from "./NovoAgendamentoModal";

interface AgendaClientProps {
  initialDate: string;
  initialAgendamentos: AgendamentoDia[];
  initialIndisponivel: IndisponivelDia | null;
  initialDatasIndisponiveisSemana: string[];
}

function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function toIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function AgendaClient({
  initialDate,
  initialAgendamentos,
  initialIndisponivel,
  initialDatasIndisponiveisSemana,
}: AgendaClientProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(() =>
    parseIsoDateLocal(initialDate),
  );
  const [agendamentos, setAgendamentos] = useState<AgendamentoDia[]>(
    initialAgendamentos,
  );
  const [indisponivel, setIndisponivel] = useState<IndisponivelDia | null>(
    initialIndisponivel,
  );
  const [datasIndisponiveisSemana, setDatasIndisponiveisSemana] = useState<
    string[]
  >(initialDatasIndisponiveisSemana);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("semana");
  const [isPending, startTransition] = useTransition();
  const [selecionado, setSelecionado] = useState<AgendamentoDia | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [novoModalOpen, setNovoModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const router = useRouter();

  const handleSelecionarAgendamento = useCallback((ag: AgendamentoDia) => {
    setSelecionado(ag);
    setModalOpen(true);
  }, []);

  const handleStatusAtualizado = useCallback(
    (id: string, novoStatus: StatusAgendamento) => {
      setAgendamentos((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: novoStatus } : a)),
      );
      setSelecionado((prev) =>
        prev && prev.id === id ? { ...prev, status: novoStatus } : prev,
      );
    },
    [],
  );

  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(date);
    setError(null);
    startTransition(async () => {
      const result = await getAgendamentosDia(toIsoDate(date));
      if (!result.ok) {
        setError(result.error);
        setAgendamentos([]);
        setIndisponivel(null);
        setDatasIndisponiveisSemana([]);
      } else {
        setAgendamentos(result.agendamentos);
        setIndisponivel(result.indisponivel);
        setDatasIndisponiveisSemana(result.datasIndisponiveisSemana);
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
        datasIndisponiveis={new Set(datasIndisponiveisSemana)}
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
          <>
            {indisponivel ? (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {indisponivel.tipo === "feriado" ? (
                  <span>
                    <strong className="font-semibold">Feriado:</strong>{" "}
                    {indisponivel.nome}
                  </span>
                ) : (
                  (() => {
                    const meta = getBloqueioTipoMeta(indisponivel.bloqueioTipo);
                    return (
                      <span>
                        <strong className="font-semibold">{meta.label}</strong>
                        {indisponivel.motivo
                          ? ` · ${indisponivel.motivo}`
                          : ""}
                      </span>
                    );
                  })()
                )}
              </div>
            ) : null}
            <ListaHorarios
              agendamentos={agendamentos}
              onSelecionar={handleSelecionarAgendamento}
            />
          </>
        )}
      </section>

      <AgendamentoModal
        agendamento={selecionado}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onUpdated={handleStatusAtualizado}
      />

      <button
        type="button"
        aria-label="Novo agendamento"
        onClick={() => setNovoModalOpen(true)}
        className="fixed right-4 bottom-[calc(56px+env(safe-area-inset-bottom)+16px)] lg:bottom-6 lg:right-6 h-14 w-14 rounded-full bg-primary text-white shadow-md hover:shadow-lg hover:bg-primary/90 transition flex items-center justify-center z-40"
      >
        <Plus size={24} strokeWidth={2} aria-hidden="true" />
      </button>

      <NovoAgendamentoModal
        open={novoModalOpen}
        onOpenChange={setNovoModalOpen}
        onCriado={() => {
          setToast("Agendamento criado");
          window.setTimeout(() => setToast(null), 2500);
          router.refresh();
          handleSelectDate(selectedDate);
        }}
      />

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 -translate-x-1/2 bottom-[calc(56px+env(safe-area-inset-bottom)+96px)] lg:bottom-24 z-50 inline-flex items-center gap-2 rounded-lg border border-[#CCFBF1] bg-[#F0FDFA] px-4 py-2.5 text-sm font-medium text-[#115E59] shadow-md"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

export default AgendaClient;
