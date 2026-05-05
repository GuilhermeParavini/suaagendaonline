"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Check, X } from "lucide-react";
import {
  getDatasIndisponiveisPainel,
  getDisponibilidadePainel,
  listarProcedimentosPainel,
  reagendarConsulta,
  type AgendamentoDia,
  type ProcedimentoOpcao,
  type SlotPainel,
} from "@/actions/agendamentos";
import CalendarioMensal from "@/components/agendamento-publico/CalendarioMensal";
import { cn } from "@/lib/utils";

interface ModalReagendamentoProps {
  agendamento: AgendamentoDia | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReagendado?: (novoId: string) => void;
}

const inputClass =
  "w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10";
const labelClass = "block text-[13px] font-medium text-slate-700";

function isoDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function ModalReagendamento({
  agendamento,
  open,
  onOpenChange,
  onReagendado,
}: ModalReagendamentoProps) {
  const [procedimentos, setProcedimentos] = useState<ProcedimentoOpcao[]>([]);
  const [procedimentoId, setProcedimentoId] = useState<string>("");
  const [carregandoProcs, setCarregandoProcs] = useState(false);

  const [visibleMonth, setVisibleMonth] = useState<Date>(
    startOfMonth(new Date()),
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [datasIndisponiveis, setDatasIndisponiveis] = useState<string[]>([]);

  const [slots, setSlots] = useState<SlotPainel[]>([]);
  const [carregandoSlots, setCarregandoSlots] = useState(false);
  const [slotsErro, setSlotsErro] = useState<string | null>(null);
  const [diaIndisponivel, setDiaIndisponivel] = useState<string | null>(null);
  const [horaSelecionada, setHoraSelecionada] = useState<string | null>(null);

  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState(false);
  const [isPending, startTransition] = useTransition();

  const resetar = useCallback(() => {
    setProcedimentos([]);
    setProcedimentoId("");
    setVisibleMonth(startOfMonth(new Date()));
    setSelectedDate(null);
    setDatasIndisponiveis([]);
    setSlots([]);
    setCarregandoSlots(false);
    setSlotsErro(null);
    setDiaIndisponivel(null);
    setHoraSelecionada(null);
    setErro(null);
    setOkMsg(false);
  }, []);

  // Carrega procedimentos ao abrir e pré-seleciona o atual
  useEffect(() => {
    if (!open || !agendamento) return;
    let cancelado = false;
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
      const atual = agendamento.procedimento?.id ?? "";
      setProcedimentoId(
        atual && r.data.some((p) => p.id === atual)
          ? atual
          : r.data[0]?.id ?? "",
      );
    })();
    return () => {
      cancelado = true;
    };
  }, [open, agendamento]);

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

  useEffect(() => {
    if (!open) return;
    if (!selectedDate || !procedimentoId) return;
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

  const handleOpenChange = (next: boolean) => {
    if (!next) resetar();
    onOpenChange(next);
  };

  if (!agendamento) return null;

  const dtAtual = new Date(agendamento.data_hora);
  const horarioAtual = dtAtual.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  const dataAtualLabel = format(dtAtual, "dd/MM/yyyy", { locale: ptBR });

  const podeSalvar = Boolean(
    procedimentoId && selectedDate && horaSelecionada && !isPending,
  );

  const handleSalvar = () => {
    if (!agendamento || !selectedDate || !horaSelecionada) return;
    setErro(null);
    startTransition(async () => {
      const r = await reagendarConsulta({
        agendamentoId: agendamento.id,
        novaDataIso: isoDate(selectedDate),
        novaHora: horaSelecionada,
        novoProcedimentoId: procedimentoId || undefined,
      });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setOkMsg(true);
      window.setTimeout(() => {
        onReagendado?.(r.novoAgendamentoId);
        handleOpenChange(false);
      }, 1000);
    });
  };

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
              Reagendar consulta
            </Dialog.Title>
            <Dialog.Close
              aria-label="Fechar"
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
            >
              <X size={18} strokeWidth={1.5} />
            </Dialog.Close>
          </div>

          <div className="mt-4 space-y-4 overflow-y-auto pb-2">
            {/* Dados atuais */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Agendamento atual
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {agendamento.paciente?.nome ?? "Paciente"}
              </p>
              <p className="text-xs text-slate-600">
                {agendamento.procedimento?.nome ?? "Procedimento"}
                <span className="mx-1 text-slate-400">·</span>
                {dataAtualLabel} às {horarioAtual}
              </p>
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Procedimento</label>
              {carregandoProcs ? (
                <p className="text-xs text-slate-400">Carregando...</p>
              ) : (
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
              )}
            </div>

            {procedimentoId ? (
              <>
                <div className="space-y-1">
                  <label className={labelClass}>Nova data</label>
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
                      Novo horário para{" "}
                      <span className="text-slate-900">
                        {format(selectedDate, "EEEE, d 'de' MMMM", {
                          locale: ptBR,
                        })}
                      </span>
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

            {/* Resumo De → Para */}
            {selectedDate && horaSelecionada ? (
              <div className="rounded-lg border border-primary/30 bg-primary-surface/40 p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-slate-500 line-through">
                    {dataAtualLabel} às {horarioAtual}
                  </span>
                  <ArrowRight
                    size={14}
                    strokeWidth={1.5}
                    aria-hidden="true"
                    className="text-primary"
                  />
                  <span className="font-semibold text-primary-dark">
                    {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })} às{" "}
                    {horaSelecionada}
                  </span>
                </div>
              </div>
            ) : null}

            {erro ? (
              <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {erro}
              </p>
            ) : null}

            {okMsg ? (
              <p className="flex items-center gap-2 rounded border border-[#CCFBF1] bg-[#F0FDFA] px-3 py-2 text-xs font-medium text-[#115E59]">
                <Check size={14} strokeWidth={2} aria-hidden="true" />
                Reagendamento confirmado.
              </p>
            ) : null}
          </div>

          <div className="mt-3 flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:justify-end shrink-0">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
              className="rounded px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSalvar}
              disabled={!podeSalvar}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {isPending ? "Reagendando..." : "Confirmar reagendamento"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default ModalReagendamento;
