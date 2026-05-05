"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, format, isSameDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type {
  AgendamentoDia,
  IndisponivelDia,
  JanelaDisponivel,
} from "@/actions/agendamentos";
import type { StatusVariant } from "@/components/ui/StatusPill";
import StatusPill from "@/components/ui/StatusPill";
import { getBloqueioTipoMeta } from "@/lib/bloqueio-tipos";
import { cn } from "@/lib/utils";

interface CalendarioDiarioProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  agendamentos: AgendamentoDia[];
  indisponivel: IndisponivelDia | null;
  janelas: JanelaDisponivel[];
  onSelectAgendamento: (ag: AgendamentoDia) => void;
  onSelectSlotVazio?: (dataIso: string, hora: string) => void;
}

const HORA_INICIO_DEFAULT = 6;
const HORA_FIM_DEFAULT = 22;
const PIXELS_POR_HORA = 60;

const isStatusVariant = (s: string): s is StatusVariant =>
  s === "agendado" ||
  s === "confirmado" ||
  s === "em_atendimento" ||
  s === "concluido" ||
  s === "faltou" ||
  s === "cancelado" ||
  s === "reagendado";

const STATUS_BORDER: Record<StatusVariant, string> = {
  agendado: "border-l-blue-500",
  confirmado: "border-l-teal-500",
  em_atendimento: "border-l-amber-500",
  concluido: "border-l-green-500",
  faltou: "border-l-red-500",
  cancelado: "border-l-slate-400",
  reagendado: "border-l-purple-500",
};

function parseHM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function CalendarioDiario({
  selectedDate,
  onSelectDate,
  agendamentos,
  indisponivel,
  janelas,
  onSelectAgendamento,
  onSelectSlotVazio,
}: CalendarioDiarioProps) {
  const hoje = new Date();
  const ehHoje = isSameDay(selectedDate, hoje);

  const [agoraMin, setAgoraMin] = useState<number>(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  useEffect(() => {
    if (!ehHoje) return;
    const tick = () => {
      const d = new Date();
      setAgoraMin(d.getHours() * 60 + d.getMinutes());
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [ehHoje]);

  const { horaInicio, horaFim } = useMemo(() => {
    if (janelas.length === 0) {
      return { horaInicio: HORA_INICIO_DEFAULT, horaFim: HORA_FIM_DEFAULT };
    }
    const inicios = janelas.map((j) => parseHM(j.hora_inicio));
    const fins = janelas.map((j) => parseHM(j.hora_fim));
    const minMin = Math.min(...inicios);
    const maxMin = Math.max(...fins);
    let hi = Math.floor(minMin / 60);
    let hf = Math.ceil(maxMin / 60);
    hi = Math.max(0, Math.min(HORA_INICIO_DEFAULT, hi));
    hf = Math.min(24, Math.max(HORA_FIM_DEFAULT, hf));
    return { horaInicio: hi, horaFim: hf };
  }, [janelas]);

  const totalMin = (horaFim - horaInicio) * 60;
  const horas = Array.from(
    { length: horaFim - horaInicio },
    (_, i) => horaInicio + i,
  );

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll para a hora atual ou primeira janela ao montar
  useEffect(() => {
    if (!containerRef.current) return;
    let alvoMin: number;
    if (ehHoje) {
      alvoMin = agoraMin - horaInicio * 60;
    } else if (janelas.length > 0) {
      alvoMin = parseHM(janelas[0].hora_inicio) - horaInicio * 60;
    } else if (agendamentos.length > 0) {
      const dt = new Date(agendamentos[0].data_hora);
      alvoMin =
        dt.getUTCHours() * 60 + dt.getUTCMinutes() - horaInicio * 60;
    } else {
      return;
    }
    const top = Math.max(0, (alvoMin / 60) * PIXELS_POR_HORA - 80);
    containerRef.current.scrollTop = top;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const dataExtenso = format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy", {
    locale: ptBR,
  });
  const dataExtensoCapital =
    dataExtenso.charAt(0).toUpperCase() + dataExtenso.slice(1);

  const ehJanelaDisponivel = (minutoNoDia: number): boolean => {
    if (janelas.length === 0) return false;
    return janelas.some(
      (j) =>
        minutoNoDia >= parseHM(j.hora_inicio) &&
        minutoNoDia < parseHM(j.hora_fim),
    );
  };

  const dataIso = format(selectedDate, "yyyy-MM-dd");

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Dia anterior"
          onClick={() => onSelectDate(subDays(selectedDate, 1))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ChevronLeft size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <div className="flex flex-col items-center gap-1">
          <h2 className="text-base font-semibold text-slate-900 text-center">
            {dataExtensoCapital}
          </h2>
          {!ehHoje ? (
            <button
              type="button"
              onClick={() => onSelectDate(new Date())}
              className="text-xs font-medium text-primary hover:underline"
            >
              Voltar para hoje
            </button>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Proximo dia"
          onClick={() => onSelectDate(addDays(selectedDate, 1))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ChevronRight size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>

      {indisponivel ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
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
                  {indisponivel.motivo ? ` · ${indisponivel.motivo}` : ""}
                </span>
              );
            })()
          )}
        </div>
      ) : null}

      <div
        ref={containerRef}
        className="relative max-h-[70vh] overflow-y-auto rounded-lg border border-slate-200 bg-white"
      >
        <div
          className="relative"
          style={{ height: `${(totalMin / 60) * PIXELS_POR_HORA}px` }}
        >
          {/* Linhas de hora + slots vazios clicaveis */}
          {horas.map((h) => {
            const minutoNoDia = h * 60;
            const disponivel = ehJanelaDisponivel(minutoNoDia);
            const top = (h - horaInicio) * PIXELS_POR_HORA;
            return (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-slate-100"
                style={{ top: `${top}px`, height: `${PIXELS_POR_HORA}px` }}
              >
                <span className="absolute left-2 top-1 text-[11px] font-medium text-slate-400 leading-none">
                  {pad2(h)}:00
                </span>
                {/* meia hora */}
                <div
                  className="absolute left-12 right-0 border-t border-dashed border-slate-100"
                  style={{ top: `${PIXELS_POR_HORA / 2}px` }}
                />
                {!disponivel ? (
                  <div
                    aria-hidden="true"
                    className="absolute left-12 right-0 top-0 bottom-0 bg-slate-50/80"
                  />
                ) : null}
                {disponivel && onSelectSlotVazio ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        onSelectSlotVazio(dataIso, `${pad2(h)}:00`)
                      }
                      aria-label={`Novo agendamento ${pad2(h)}:00`}
                      className="absolute left-12 right-0 top-0 hover:bg-primary-surface/40 transition-colors"
                      style={{ height: `${PIXELS_POR_HORA / 2}px` }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onSelectSlotVazio(dataIso, `${pad2(h)}:30`)
                      }
                      aria-label={`Novo agendamento ${pad2(h)}:30`}
                      className="absolute left-12 right-0 hover:bg-primary-surface/40 transition-colors"
                      style={{
                        top: `${PIXELS_POR_HORA / 2}px`,
                        height: `${PIXELS_POR_HORA / 2}px`,
                      }}
                    />
                  </>
                ) : null}
              </div>
            );
          })}

          {/* Cards de agendamento */}
          {agendamentos.map((ag) => {
            const dt = new Date(ag.data_hora);
            const minutos =
              dt.getUTCHours() * 60 + dt.getUTCMinutes() - horaInicio * 60;
            if (minutos < 0 || minutos >= totalMin) return null;
            const top = (minutos / 60) * PIXELS_POR_HORA;
            const altura = Math.max(
              28,
              ((ag.duracao_min ?? 30) / 60) * PIXELS_POR_HORA - 2,
            );
            const status: StatusVariant = isStatusVariant(ag.status)
              ? ag.status
              : "agendado";
            const horario = dt.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "UTC",
            });
            return (
              <button
                key={ag.id}
                type="button"
                onClick={() => onSelectAgendamento(ag)}
                className={cn(
                  "absolute left-14 right-2 rounded-lg border border-slate-200 border-l-4 bg-white px-2 py-1 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  STATUS_BORDER[status],
                )}
                style={{
                  top: `${top}px`,
                  height: `${altura}px`,
                  minHeight: "28px",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900 leading-tight">
                      {horario} · {ag.paciente?.nome ?? "Paciente"}
                    </p>
                    {ag.procedimento?.nome && altura > 32 ? (
                      <p className="mt-0.5 truncate text-[11px] text-slate-500 leading-tight">
                        {ag.procedimento.nome}
                      </p>
                    ) : null}
                  </div>
                  {altura > 40 ? (
                    <StatusPill
                      status={status}
                      className="shrink-0 text-[10px] py-0"
                    />
                  ) : null}
                </div>
              </button>
            );
          })}

          {/* Linha de "agora" */}
          {ehHoje && agoraMin >= horaInicio * 60 && agoraMin <= horaFim * 60 ? (
            <div
              aria-hidden="true"
              className="absolute left-12 right-0 z-10 border-t-2 border-red-500"
              style={{
                top: `${((agoraMin - horaInicio * 60) / 60) * PIXELS_POR_HORA}px`,
              }}
            >
              <span className="absolute -left-1 -top-1.5 h-3 w-3 rounded-full bg-red-500" />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default CalendarioDiario;
