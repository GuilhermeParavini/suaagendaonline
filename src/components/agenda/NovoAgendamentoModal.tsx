"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, ExternalLink, Search, X } from "lucide-react";
import {
  buscarPacientesPainel,
  criarAgendamentoPainel,
  getDatasIndisponiveisPainel,
  getDisponibilidadePainel,
  listarProcedimentosPainel,
  type PacienteOpcao,
  type ProcedimentoOpcao,
  type SlotPainel,
} from "@/actions/agendamentos";
import { formatCPF } from "@/lib/masks";
import { cn } from "@/lib/utils";
import CalendarioMensal from "@/components/agendamento-publico/CalendarioMensal";
import { addMonths, endOfMonth, startOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface NovoAgendamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCriado?: () => void;
}

const inputClass =
  "w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10";
const labelClass = "block text-[13px] font-medium text-slate-700";

function isoDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function NovoAgendamentoModal({
  open,
  onOpenChange,
  onCriado,
}: NovoAgendamentoModalProps) {
  const [termoBusca, setTermoBusca] = useState("");
  const [resultados, setResultados] = useState<PacienteOpcao[]>([]);
  const [pacienteSelecionado, setPacienteSelecionado] =
    useState<PacienteOpcao | null>(null);
  const [buscandoPacientes, setBuscandoPacientes] = useState(false);
  const [buscaJaFeita, setBuscaJaFeita] = useState(false);

  const [procedimentos, setProcedimentos] = useState<ProcedimentoOpcao[]>([]);
  const [procedimentoId, setProcedimentoId] = useState<string>("");
  const [carregandoProcs, setCarregandoProcs] = useState(false);

  const [visibleMonth, setVisibleMonth] = useState<Date>(
    startOfMonth(new Date()),
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const [slots, setSlots] = useState<SlotPainel[]>([]);
  const [carregandoSlots, setCarregandoSlots] = useState(false);
  const [slotsErro, setSlotsErro] = useState<string | null>(null);
  const [diaIndisponivel, setDiaIndisponivel] = useState<string | null>(null);
  const [horaSelecionada, setHoraSelecionada] = useState<string | null>(null);

  const [datasIndisponiveis, setDatasIndisponiveis] = useState<string[]>([]);

  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState(false);
  const [isPending, startTransition] = useTransition();

  const buscaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetar = useCallback(() => {
    setTermoBusca("");
    setResultados([]);
    setPacienteSelecionado(null);
    setBuscandoPacientes(false);
    setBuscaJaFeita(false);
    setProcedimentoId("");
    setVisibleMonth(startOfMonth(new Date()));
    setSelectedDate(null);
    setSlots([]);
    setCarregandoSlots(false);
    setSlotsErro(null);
    setDiaIndisponivel(null);
    setHoraSelecionada(null);
    setDatasIndisponiveis([]);
    setObservacoes("");
    setErro(null);
    setOkMsg(false);
  }, []);

  useEffect(() => {
    if (!open) {
      if (buscaTimerRef.current) {
        clearTimeout(buscaTimerRef.current);
        buscaTimerRef.current = null;
      }
      return;
    }
    let cancelado = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCarregandoProcs(true);
    (async () => {
      const r = await listarProcedimentosPainel();
      if (cancelado) return;
      setCarregandoProcs(false);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setProcedimentos(r.data);
      if (r.data.length === 1) setProcedimentoId(r.data[0].id);
    })();
    return () => {
      cancelado = true;
    };
  }, [open]);

  const handleBuscaChange = (valor: string) => {
    setTermoBusca(valor);
    setPacienteSelecionado(null);
    setBuscaJaFeita(false);
    if (buscaTimerRef.current) clearTimeout(buscaTimerRef.current);

    const termo = valor.trim();
    if (termo.length < 2) {
      setResultados([]);
      setBuscandoPacientes(false);
      return;
    }
    setBuscandoPacientes(true);
    buscaTimerRef.current = setTimeout(async () => {
      const r = await buscarPacientesPainel(termo);
      setBuscandoPacientes(false);
      setBuscaJaFeita(true);
      if (r.ok) setResultados(r.data);
      else setErro(r.error);
    }, 250);
  };

  const handleSelecionarPaciente = (p: PacienteOpcao) => {
    setPacienteSelecionado(p);
    setTermoBusca(p.nome);
    setResultados([]);
  };

  const handleTrocarPaciente = () => {
    setPacienteSelecionado(null);
    setTermoBusca("");
    setResultados([]);
    setBuscaJaFeita(false);
  };

  // Carrega datas indisponiveis (feriados + bloqueios) do mes visivel
  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    (async () => {
      const ini = format(startOfMonth(visibleMonth), "yyyy-MM-dd");
      const fim = format(endOfMonth(addMonths(visibleMonth, 1)), "yyyy-MM-dd");
      const r = await getDatasIndisponiveisPainel(ini, fim);
      if (cancelado) return;
      if (r.ok) setDatasIndisponiveis(r.datas);
    })();
    return () => {
      cancelado = true;
    };
  }, [open, visibleMonth]);

  // Recarrega slots quando data ou procedimento mudam
  useEffect(() => {
    if (!open) return;
    if (!selectedDate || !procedimentoId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHoraSelecionada(null);
    setSlotsErro(null);
    setDiaIndisponivel(null);
    setCarregandoSlots(true);
    (async () => {
      const r = await getDisponibilidadePainel(
        isoDate(selectedDate),
        procedimentoId,
      );
      setCarregandoSlots(false);
      if (!r.ok) {
        setSlotsErro(r.error);
        setSlots([]);
        return;
      }
      setSlots(r.slots);
      setDiaIndisponivel(r.indisponivel?.texto ?? null);
    })();
  }, [open, selectedDate, procedimentoId]);

  const podeSalvar =
    !!pacienteSelecionado &&
    !!procedimentoId &&
    !!selectedDate &&
    !!horaSelecionada &&
    !isPending;

  const handleSalvar = () => {
    if (!pacienteSelecionado || !procedimentoId || !selectedDate || !horaSelecionada) {
      return;
    }
    setErro(null);
    startTransition(async () => {
      const r = await criarAgendamentoPainel({
        pacienteId: pacienteSelecionado.id,
        procedimentoId,
        dataIso: isoDate(selectedDate),
        hora: horaSelecionada,
        observacoes: observacoes || undefined,
      });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setOkMsg(true);
      window.setTimeout(() => {
        resetar();
        onOpenChange(false);
        onCriado?.();
      }, 800);
    });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetar();
    onOpenChange(next);
  };

  const procedimentoSelecionado = procedimentos.find(
    (p) => p.id === procedimentoId,
  );

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className={cn(
            "fixed z-50 bg-white shadow-lg focus:outline-none flex flex-col",
            "inset-x-0 bottom-0 max-h-[92vh] rounded-t-2xl px-4 pt-5 pb-[max(env(safe-area-inset-bottom),16px)]",
            "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[560px] md:max-w-[calc(100vw-32px)] md:rounded-2xl md:p-6",
          )}
        >
          <div className="md:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 shrink-0" />

          <div className="flex items-start justify-between gap-3 shrink-0">
            <Dialog.Title className="text-base font-semibold text-slate-900">
              Novo agendamento
            </Dialog.Title>
            <Dialog.Close
              aria-label="Fechar"
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
            >
              <X size={18} strokeWidth={1.5} />
            </Dialog.Close>
          </div>

          {okMsg ? (
            <div
              role="status"
              aria-live="polite"
              className="mt-3 flex items-center gap-2 rounded border border-[#CCFBF1] bg-[#F0FDFA] px-3 py-2 text-xs font-medium text-[#115E59] shrink-0"
            >
              <Check size={14} strokeWidth={2} aria-hidden="true" />
              Agendamento criado
            </div>
          ) : null}

          <div className="mt-4 space-y-4 overflow-y-auto pb-2">
            {/* Paciente */}
            <div className="space-y-1">
              <label className={labelClass}>Paciente *</label>
              {pacienteSelecionado ? (
                <div className="flex items-center justify-between gap-2 rounded border border-primary bg-primary-surface px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {pacienteSelecionado.nome}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatCPF(pacienteSelecionado.cpf)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTrocarPaciente}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Trocar
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search
                      size={14}
                      strokeWidth={1.5}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={termoBusca}
                      onChange={(e) => handleBuscaChange(e.target.value)}
                      placeholder="Buscar por nome ou CPF"
                      className={`${inputClass} pl-9`}
                    />
                  </div>
                  {buscandoPacientes ? (
                    <p className="text-xs text-slate-400">Buscando...</p>
                  ) : null}
                  {!buscandoPacientes &&
                  resultados.length === 0 &&
                  buscaJaFeita &&
                  termoBusca.trim().length >= 2 ? (
                    <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      Nenhum paciente encontrado.{" "}
                      <a
                        href="/pacientes/novo"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        Cadastrar novo paciente
                        <ExternalLink
                          size={11}
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                      </a>
                    </div>
                  ) : null}
                  {resultados.length > 0 ? (
                    <ul className="overflow-hidden rounded border border-slate-200 bg-white">
                      {resultados.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => handleSelecionarPaciente(p)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {p.nome}
                              </p>
                              <p className="text-xs text-slate-500">
                                {formatCPF(p.cpf)}
                              </p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </div>

            {/* Procedimento */}
            <div className="space-y-1">
              <label className={labelClass}>Procedimento *</label>
              {carregandoProcs ? (
                <p className="text-xs text-slate-400">Carregando...</p>
              ) : procedimentos.length === 0 ? (
                <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Nenhum procedimento ativo. Cadastre em Configurações &gt;
                  Procedimentos.
                </div>
              ) : (
                <>
                  <select
                    value={procedimentoId}
                    onChange={(e) => setProcedimentoId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Selecione</option>
                    {procedimentos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} ({p.duracao_min} min)
                      </option>
                    ))}
                  </select>
                  {procedimentoSelecionado ? (
                    <p className="text-xs text-slate-500">
                      Duração: {procedimentoSelecionado.duracao_min} min
                    </p>
                  ) : null}
                </>
              )}
            </div>

            {/* Data + horario (so quando procedimento escolhido) */}
            {procedimentoId ? (
              <>
                <div className="space-y-1">
                  <label className={labelClass}>Data *</label>
                  <CalendarioMensal
                    visibleMonth={visibleMonth}
                    onChangeMonth={setVisibleMonth}
                    selectedDate={selectedDate}
                    onSelectDate={(d) => setSelectedDate(d)}
                    diasSemanaDisponiveis={[0, 1, 2, 3, 4, 5, 6]}
                    datasIndisponiveis={datasIndisponiveis}
                  />
                </div>

                {selectedDate ? (
                  <div className="space-y-1">
                    <label className={labelClass}>
                      Horário para{" "}
                      <span className="text-slate-900">
                        {format(selectedDate, "EEEE, d 'de' MMMM", {
                          locale: ptBR,
                        })}
                      </span>{" "}
                      *
                    </label>
                    {carregandoSlots ? (
                      <p className="text-xs text-slate-400">Carregando...</p>
                    ) : slotsErro ? (
                      <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        {slotsErro}
                      </p>
                    ) : diaIndisponivel ? (
                      <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {diaIndisponivel}. Escolha outra data.
                      </p>
                    ) : slots.length === 0 ? (
                      <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        Sem horários disponíveis neste dia.
                      </p>
                    ) : (
                      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {slots.map((s) => {
                          const isSelected = s.time === horaSelecionada;
                          return (
                            <li key={s.time}>
                              <button
                                type="button"
                                onClick={() =>
                                  s.available && setHoraSelecionada(s.time)
                                }
                                disabled={!s.available}
                                className={cn(
                                  "w-full rounded-lg border px-2 py-2 text-sm font-medium transition-colors",
                                  s.available && !isSelected &&
                                    "border-primary text-primary hover:bg-primary-surface",
                                  s.available && isSelected &&
                                    "border-primary bg-primary text-white",
                                  !s.available &&
                                    "border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed line-through",
                                )}
                              >
                                {s.time}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : null}
              </>
            ) : null}

            {/* Observacoes */}
            <div className="space-y-1">
              <label className={labelClass}>Observações</label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Notas internas sobre o agendamento (opcional)"
                className={`${inputClass} resize-y`}
              />
            </div>

            {erro ? (
              <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {erro}
              </p>
            ) : null}
          </div>

          <div className="mt-3 border-t border-slate-100 pt-3 shrink-0">
            <button
              type="button"
              onClick={handleSalvar}
              disabled={!podeSalvar}
              className="w-full rounded bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? "Agendando..." : "Agendar"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default NovoAgendamentoModal;
