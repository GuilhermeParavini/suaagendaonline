"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import {
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRouter } from "next/navigation";
import {
  getAgendamentosDia,
  getAgendamentosDoDia,
  getAgendamentosDoMes,
  type AgendamentoDia,
  type DiaResumoMensal,
  type IndisponivelDia,
  type JanelaDisponivel,
  type StatusAgendamento,
} from "@/actions/agendamentos";
import { getBloqueioTipoMeta } from "@/lib/bloqueio-tipos";
import AgendaToggle, { type AgendaView } from "./AgendaToggle";
import CalendarioSemanal from "./CalendarioSemanal";
import CalendarioDiario from "./CalendarioDiario";
import CalendarioMensal from "./CalendarioMensal";
import ListaHorarios from "./ListaHorarios";
import AgendamentoModal from "./AgendamentoModal";
import NovoAgendamentoModal from "./NovoAgendamentoModal";

interface AgendaClientProps {
  initialDate: string;
  initialAgendamentos: AgendamentoDia[];
  initialIndisponivel: IndisponivelDia | null;
  initialDatasIndisponiveisSemana: string[];
}

const STORAGE_KEY = "agenda-view";

function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function toIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function isAgendaView(v: string): v is AgendaView {
  return v === "dia" || v === "semana" || v === "mes";
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
  const [view, setView] = useState<AgendaView>("semana");

  // Dia + Semana data
  const [agendamentos, setAgendamentos] = useState<AgendamentoDia[]>(
    initialAgendamentos,
  );
  const [indisponivel, setIndisponivel] = useState<IndisponivelDia | null>(
    initialIndisponivel,
  );
  const [datasIndisponiveisSemana, setDatasIndisponiveisSemana] = useState<
    string[]
  >(initialDatasIndisponiveisSemana);
  const [janelas, setJanelas] = useState<JanelaDisponivel[]>([]);

  // Mes data
  const [visibleMonth, setVisibleMonth] = useState<Date>(() =>
    startOfMonth(parseIsoDateLocal(initialDate)),
  );
  const [diasMes, setDiasMes] = useState<DiaResumoMensal[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selecionado, setSelecionado] = useState<AgendamentoDia | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [novoModalOpen, setNovoModalOpen] = useState(false);
  const [novoModalPrefill, setNovoModalPrefill] = useState<{
    dataIso?: string;
    hora?: string;
  }>({});
  const [toast, setToast] = useState<string | null>(null);
  const router = useRouter();

  // Carrega visualizacao salva
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && isAgendaView(saved)) {
        setView(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const persistirView = (v: AgendaView) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, v);
    } catch {
      // ignore
    }
  };

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

  const carregarDia = useCallback((date: Date) => {
    setError(null);
    startTransition(async () => {
      const r = await getAgendamentosDoDia(toIsoDate(date));
      if (!r.ok) {
        setError(r.error);
        setAgendamentos([]);
        setIndisponivel(null);
        setJanelas([]);
        return;
      }
      setAgendamentos(r.agendamentos);
      setIndisponivel(r.indisponivel);
      setJanelas(r.janelas);
    });
  }, []);

  const carregarSemana = useCallback((date: Date) => {
    setError(null);
    startTransition(async () => {
      const r = await getAgendamentosDia(toIsoDate(date));
      if (!r.ok) {
        setError(r.error);
        setAgendamentos([]);
        setIndisponivel(null);
        setDatasIndisponiveisSemana([]);
        return;
      }
      setAgendamentos(r.agendamentos);
      setIndisponivel(r.indisponivel);
      setDatasIndisponiveisSemana(r.datasIndisponiveisSemana);
    });
  }, []);

  const carregarMes = useCallback((date: Date) => {
    setError(null);
    startTransition(async () => {
      const r = await getAgendamentosDoMes(
        date.getFullYear(),
        date.getMonth() + 1,
      );
      if (!r.ok) {
        setError(r.error);
        setDiasMes([]);
        return;
      }
      setDiasMes(r.dias);
    });
  }, []);

  // Recarrega dados quando view ou data muda
  useEffect(() => {
    if (view === "dia") {
      carregarDia(selectedDate);
    } else if (view === "semana") {
      carregarSemana(selectedDate);
    } else {
      carregarMes(visibleMonth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedDate, visibleMonth]);

  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const handleSelectDayFromMonth = useCallback((date: Date) => {
    setSelectedDate(date);
    setView("dia");
    persistirView("dia");
  }, []);

  const handleChangeView = (next: AgendaView) => {
    setView(next);
    persistirView(next);
    if (next === "mes") {
      setVisibleMonth(startOfMonth(selectedDate));
    } else if (next === "semana") {
      // Mantém a data; ajusta para inicio da semana se quiser. Aqui mantemos como está.
      setSelectedDate(startOfWeek(selectedDate, { weekStartsOn: 1 }));
    }
  };

  const handleOpenNovo = (prefill?: { dataIso?: string; hora?: string }) => {
    setNovoModalPrefill(prefill ?? {});
    setNovoModalOpen(true);
  };

  const dataExtenso = format(selectedDate, "EEEE, d 'de' MMMM", {
    locale: ptBR,
  });
  const dataExtensoCapital =
    dataExtenso.charAt(0).toUpperCase() + dataExtenso.slice(1);

  return (
    <div className="space-y-5 relative pb-20">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-[22px] font-semibold text-slate-900 leading-tight">
            Agenda
          </h1>
          <p className="text-sm text-slate-500">{dataExtensoCapital}</p>
        </div>
        <AgendaToggle value={view} onChange={handleChangeView} />
      </header>

      {view === "semana" ? (
        <CalendarioSemanal
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
          viewMode="semana"
          onChangeViewMode={() => undefined}
          datasIndisponiveis={new Set(datasIndisponiveisSemana)}
          hideViewToggle
        />
      ) : null}

      <section
        aria-busy={isPending}
        aria-live="polite"
        className={
          isPending ? "opacity-60 transition-opacity" : "transition-opacity"
        }
      >
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : view === "dia" ? (
          <CalendarioDiario
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            agendamentos={agendamentos}
            indisponivel={indisponivel}
            janelas={janelas}
            onSelectAgendamento={handleSelecionarAgendamento}
            onSelectSlotVazio={(dataIso, hora) =>
              handleOpenNovo({ dataIso, hora })
            }
          />
        ) : view === "mes" ? (
          <CalendarioMensal
            visibleMonth={visibleMonth}
            onChangeMonth={setVisibleMonth}
            selectedDate={selectedDate}
            dias={diasMes}
            onSelectDay={handleSelectDayFromMonth}
          />
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
        onClick={() => handleOpenNovo()}
        className="fixed right-4 bottom-[calc(56px+env(safe-area-inset-bottom)+16px)] lg:bottom-6 lg:right-6 h-14 w-14 rounded-full bg-primary text-white shadow-md hover:shadow-lg hover:bg-primary/90 transition flex items-center justify-center z-40"
      >
        <Plus size={24} strokeWidth={2} aria-hidden="true" />
      </button>

      <NovoAgendamentoModal
        key={`novo-${novoModalPrefill.dataIso ?? ""}-${novoModalPrefill.hora ?? ""}-${novoModalOpen ? "open" : "closed"}`}
        open={novoModalOpen}
        onOpenChange={setNovoModalOpen}
        initialDateIso={novoModalPrefill.dataIso}
        initialHora={novoModalPrefill.hora}
        onCriado={() => {
          setToast("Agendamento criado");
          window.setTimeout(() => setToast(null), 2500);
          router.refresh();
          if (view === "dia") carregarDia(selectedDate);
          else if (view === "semana") carregarSemana(selectedDate);
          else carregarMes(visibleMonth);
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
