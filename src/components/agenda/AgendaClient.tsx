"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRouter } from "next/navigation";
import {
  atualizarStatusAgendamento,
  getAgendamentosDia,
  getAgendamentosDoDia,
  getAgendamentosDoMes,
  type AgendamentoDia,
  type DiaResumoMensal,
  type IndisponivelDia,
  type JanelaDisponivel,
  type StatusAgendamento,
} from "@/actions/agendamentos";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { cn } from "@/lib/utils";
import {
  listarProfissionaisAtivosTenant,
  type ProfissionalOpcaoTenant,
} from "@/actions/equipe";
import { getBloqueioTipoMeta } from "@/lib/bloqueio-tipos";
import AgendaToggle, { type AgendaView } from "./AgendaToggle";
import CalendarioSemanal from "./CalendarioSemanal";
import CalendarioDiario from "./CalendarioDiario";
import CalendarioMensal from "./CalendarioMensal";
import ListaHorarios from "./ListaHorarios";
import AgendamentoModal from "./AgendamentoModal";
import { LazyNovoAgendamentoModal } from "@/lib/dynamic-imports";
import { useScrollRestore } from "@/hooks/useScrollRestore";

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
  useScrollRestore("scroll-agenda");
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
  const [profissionais, setProfissionais] = useState<
    ProfissionalOpcaoTenant[]
  >([]);
  const [profissionalFiltro, setProfissionalFiltro] = useState<string>(
    "self",
  );
  const [selecionado, setSelecionado] = useState<AgendamentoDia | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [novoModalOpen, setNovoModalOpen] = useState(false);
  const [novoModalPrefill, setNovoModalPrefill] = useState<{
    dataIso?: string;
    hora?: string;
  }>({});
  const [toast, setToast] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AgendamentoDia | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [cancelando, setCancelando] = useState(false);
  const router = useRouter();

  // Carrega visualizacao salva
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && isAgendaView(saved)) {
        // Sincroniza visao salva pelo usuario apos hydration.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setView(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  // Lista profissionais ativos do tenant (para o filtro multi-profissional)
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const r = await listarProfissionaisAtivosTenant();
      if (cancelado || !r.ok) return;
      setProfissionais(r.data);
    })();
    return () => {
      cancelado = true;
    };
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

  const mostrarToast = (mensagem: string) => {
    setToast(mensagem);
    window.setTimeout(() => setToast(null), 2500);
  };

  const transicionarStatus = async (
    ag: AgendamentoDia,
    novoStatus: StatusAgendamento,
    sucesso: string,
  ) => {
    const r = await atualizarStatusAgendamento(ag.id, novoStatus);
    if (!r.ok) {
      mostrarToast(r.error);
      return;
    }
    handleStatusAtualizado(ag.id, novoStatus);
    mostrarToast(sucesso);
    router.refresh();
  };

  const handleConfirmarSwipe = (ag: AgendamentoDia) => {
    void transicionarStatus(ag, "confirmado", "Presenca confirmada");
  };

  const handleIniciarSwipe = (ag: AgendamentoDia) => {
    void transicionarStatus(ag, "em_atendimento", "Atendimento iniciado");
  };

  const handleSolicitarCancelamento = (ag: AgendamentoDia) => {
    setCancelTarget(ag);
    setCancelMotivo("");
  };

  const fecharCancelDialog = (next: boolean) => {
    if (cancelando) return;
    if (!next) {
      setCancelTarget(null);
      setCancelMotivo("");
    }
  };

  const confirmarCancelamento = async () => {
    if (!cancelTarget || cancelando) return;
    setCancelando(true);
    const r = await atualizarStatusAgendamento(
      cancelTarget.id,
      "cancelado",
      cancelMotivo.trim() || undefined,
    );
    setCancelando(false);
    if (!r.ok) {
      mostrarToast(r.error);
      return;
    }
    handleStatusAtualizado(cancelTarget.id, "cancelado");
    mostrarToast("Agendamento cancelado");
    setCancelTarget(null);
    setCancelMotivo("");
    router.refresh();
  };

  const filtroParaQuery = (): string | null | undefined => {
    if (profissionalFiltro === "self") return undefined;
    if (profissionalFiltro === "todos") return "todos";
    return profissionalFiltro;
  };

  const carregarDia = useCallback(
    (date: Date, filtro: string | null | undefined) => {
      setError(null);
      startTransition(async () => {
        const r = await getAgendamentosDoDia(toIsoDate(date), filtro);
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
    },
    [],
  );

  const carregarSemana = useCallback(
    (date: Date, filtro: string | null | undefined) => {
      setError(null);
      startTransition(async () => {
        const r = await getAgendamentosDia(toIsoDate(date), filtro);
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
    },
    [],
  );

  const carregarMes = useCallback(
    (date: Date, filtro: string | null | undefined) => {
      setError(null);
      startTransition(async () => {
        const r = await getAgendamentosDoMes(
          date.getFullYear(),
          date.getMonth() + 1,
          filtro,
        );
        if (!r.ok) {
          setError(r.error);
          setDiasMes([]);
          return;
        }
        setDiasMes(r.dias);
      });
    },
    [],
  );

  // Recarrega dados quando view, data ou filtro mudam
  useEffect(() => {
    const filtro = filtroParaQuery();
    // Os helpers carregar*() chamam setState internamente apos o fetch.
    if (view === "dia") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      carregarDia(selectedDate, filtro);
    } else if (view === "semana") {
      carregarSemana(selectedDate, filtro);
    } else {
      carregarMes(visibleMonth, filtro);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedDate, visibleMonth, profissionalFiltro]);

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

  const navegarAnterior = useCallback(() => {
    if (view === "dia") setSelectedDate((d) => subDays(d, 1));
    else if (view === "semana") setSelectedDate((d) => subWeeks(d, 1));
    else setVisibleMonth((m) => subMonths(m, 1));
  }, [view]);

  const navegarProximo = useCallback(() => {
    if (view === "dia") setSelectedDate((d) => addDays(d, 1));
    else if (view === "semana") setSelectedDate((d) => addWeeks(d, 1));
    else setVisibleMonth((m) => addMonths(m, 1));
  }, [view]);

  const labelAnterior =
    view === "dia" ? "Ontem" : view === "semana" ? "Semana ant." : "Mes ant.";
  const labelProximo =
    view === "dia" ? "Amanha" : view === "semana" ? "Prox. semana" : "Prox. mes";

  const swipeNav = useSwipeNavigation({
    onSwipeLeft: navegarProximo,
    onSwipeRight: navegarAnterior,
    threshold: 60,
  });

  const navOpacidade = swipeNav.active
    ? Math.min(1, Math.abs(swipeNav.deltaX) / 60)
    : 0;
  const navMostraEsq = swipeNav.active && swipeNav.deltaX > 0;
  const navMostraDir = swipeNav.active && swipeNav.deltaX < 0;

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

      {profissionais.length > 1 ? (
        <div className="flex items-center gap-2">
          <label
            htmlFor="agenda-prof-filtro"
            className="text-xs font-medium text-slate-500"
          >
            Profissional:
          </label>
          <select
            id="agenda-prof-filtro"
            value={profissionalFiltro}
            onChange={(e) => setProfissionalFiltro(e.target.value)}
            className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/10"
          >
            <option value="self">Eu</option>
            <option value="todos">Todos</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
                {p.is_self ? " (você)" : ""}
              </option>
            ))}
          </select>
        </div>
      ) : null}

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
        onTouchStart={swipeNav.bind.onTouchStart}
        onTouchMove={swipeNav.bind.onTouchMove}
        onTouchEnd={swipeNav.bind.onTouchEnd}
        onTouchCancel={swipeNav.bind.onTouchCancel}
        className={cn(
          "relative",
          isPending ? "opacity-60 transition-opacity" : "transition-opacity",
        )}
      >
        {navMostraEsq ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-2"
            style={{ opacity: navOpacidade }}
          >
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2.5 py-1 text-[12px] font-medium text-white">
              <ChevronLeft size={14} strokeWidth={2} aria-hidden="true" />
              {labelAnterior}
            </span>
          </div>
        ) : null}
        {navMostraDir ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center pr-2"
            style={{ opacity: navOpacidade }}
          >
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2.5 py-1 text-[12px] font-medium text-white">
              {labelProximo}
              <ChevronRight size={14} strokeWidth={2} aria-hidden="true" />
            </span>
          </div>
        ) : null}
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
              mostrarProfissional={profissionais.length > 1}
              onConfirmar={handleConfirmarSwipe}
              onIniciar={handleIniciarSwipe}
              onSolicitarCancelamento={handleSolicitarCancelamento}
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

      <LazyNovoAgendamentoModal
        key={`novo-${novoModalPrefill.dataIso ?? ""}-${novoModalPrefill.hora ?? ""}-${novoModalOpen ? "open" : "closed"}`}
        open={novoModalOpen}
        onOpenChange={setNovoModalOpen}
        initialDateIso={novoModalPrefill.dataIso}
        initialHora={novoModalPrefill.hora}
        onCriado={() => {
          setToast("Agendamento criado");
          window.setTimeout(() => setToast(null), 2500);
          router.refresh();
          const filtro = filtroParaQuery();
          if (view === "dia") carregarDia(selectedDate, filtro);
          else if (view === "semana") carregarSemana(selectedDate, filtro);
          else carregarMes(visibleMonth, filtro);
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

      <Dialog.Root
        open={cancelTarget !== null}
        onOpenChange={fecharCancelDialog}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content
            className={cn(
              "fixed z-50 bg-white shadow-lg focus:outline-none flex flex-col",
              "inset-x-0 bottom-0 max-h-[92vh] rounded-t-2xl px-4 pt-5 pb-[max(env(safe-area-inset-bottom),16px)]",
              "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[440px] md:max-w-[calc(100vw-32px)] md:rounded-2xl md:p-6",
            )}
          >
            <div className="md:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 shrink-0" />
            <div className="flex items-start justify-between gap-3 shrink-0">
              <Dialog.Title className="text-base font-semibold text-slate-900">
                Cancelar agendamento
              </Dialog.Title>
              <Dialog.Close
                aria-label="Fechar"
                disabled={cancelando}
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
              >
                <X size={18} strokeWidth={1.5} />
              </Dialog.Close>
            </div>
            <Dialog.Description className="mt-2 text-sm text-slate-600">
              {cancelTarget?.paciente?.nome
                ? `Confirma o cancelamento do agendamento de ${cancelTarget.paciente.nome}?`
                : "Confirma o cancelamento deste agendamento?"}
            </Dialog.Description>

            <label className="mt-4 block text-[14px] font-medium text-slate-900">
              Motivo (opcional)
            </label>
            <textarea
              value={cancelMotivo}
              onChange={(e) => setCancelMotivo(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="Ex: paciente avisou que nao podera comparecer"
              className="mt-1 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/10 resize-none"
            />

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => fecharCancelDialog(false)}
                disabled={cancelando}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={confirmarCancelamento}
                disabled={cancelando}
                className="rounded-lg bg-[#EF4444] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#DC2626] disabled:opacity-50"
              >
                {cancelando ? "Cancelando..." : "Cancelar agendamento"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

export default AgendaClient;
