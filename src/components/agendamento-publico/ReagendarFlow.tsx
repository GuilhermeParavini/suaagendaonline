"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronLeft } from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  getDisponibilidade,
  reagendarPorPaciente,
  type AgendamentoReagendar,
  type Slot,
} from "@/actions/agendamento-publico";
import CalendarioMensal from "./CalendarioMensal";
import SeletorHorario from "./SeletorHorario";
import TelaConfirmacao from "./TelaConfirmacao";

type Step = "confirmar" | "data" | "hora" | "sucesso";

interface ReagendarFlowProps {
  token: string;
  agendamento: AgendamentoReagendar;
  diasSemanaDisponiveis: number[];
  datasIndisponiveis: string[];
}

function isoDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

const stepOrder: Step[] = ["confirmar", "data", "hora"];

function Stepper({ step }: { step: Step }) {
  const idx = stepOrder.indexOf(step);
  return (
    <ol aria-label="Etapas" className="flex items-center gap-1.5">
      {stepOrder.map((s, i) => {
        const active = i === idx;
        const done = i < idx;
        return (
          <li
            key={s}
            aria-current={active ? "step" : undefined}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              done || active ? "bg-primary" : "bg-slate-200",
            )}
          />
        );
      })}
    </ol>
  );
}

function ReagendarFlow({
  token,
  agendamento,
  diasSemanaDisponiveis,
  datasIndisponiveis,
}: ReagendarFlowProps) {
  const [step, setStep] = useState<Step>("confirmar");
  const [visibleMonth, setVisibleMonth] = useState<Date>(
    startOfMonth(new Date()),
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, startSlotsLoad] = useTransition();
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [diaIndisponivel, setDiaIndisponivel] = useState<string | null>(null);
  const [selectedHora, setSelectedHora] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [novaData, setNovaData] = useState<{ dataIso: string; hora: string } | null>(
    null,
  );

  const procedimentoId =
    agendamento.procedimento?.id ?? null;

  useEffect(() => {
    if (step !== "hora" || !selectedDate || !procedimentoId) return;
    // Limpeza de estado pre-fetch ao trocar dia.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedHora(null);
    setSlotsError(null);
    setDiaIndisponivel(null);
    startSlotsLoad(async () => {
      const result = await getDisponibilidade(
        agendamento.profissional.id,
        isoDate(selectedDate),
        procedimentoId,
      );
      if (!result.ok) {
        setSlotsError(result.error);
        setSlots([]);
      } else {
        setSlots(result.slots);
        if (result.indisponivel) {
          setDiaIndisponivel(
            result.indisponivel.tipo === "feriado"
              ? `Feriado: ${result.indisponivel.nome}`
              : result.indisponivel.motivo
                ? `Indisponivel: ${result.indisponivel.motivo}`
                : "Profissional indisponivel neste dia.",
          );
        }
      }
    });
  }, [step, selectedDate, procedimentoId, agendamento.profissional.id]);

  const goBack = () => {
    setSubmitError(null);
    if (step === "data") setStep("confirmar");
    else if (step === "hora") setStep("data");
  };

  const handleConfirmarHora = (hora: string) => {
    if (!selectedDate) return;
    setSelectedHora(hora);
    setSubmitError(null);
    startSubmit(async () => {
      const r = await reagendarPorPaciente(token, isoDate(selectedDate), hora);
      if (!r.ok) {
        setSubmitError(r.error);
        return;
      }
      setNovaData({ dataIso: r.novaDataIso, hora: r.novaHora });
      setStep("sucesso");
    });
  };

  const dataAtualLabel = (() => {
    const d = new Date(agendamento.dataHoraIso);
    const data = format(d, "EEEE, d 'de' MMMM 'de' yyyy", {
      locale: ptBR,
      timeZone: "UTC",
    } as Parameters<typeof format>[2]);
    return data.charAt(0).toUpperCase() + data.slice(1);
  })();

  const horaAtual = (() => {
    const d = new Date(agendamento.dataHoraIso);
    return d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });
  })();

  if (step === "sucesso" && novaData) {
    return (
      <TelaConfirmacao
        titulo="Reagendamento confirmado!"
        subtitulo="Voce recebera um email de confirmacao se houver email cadastrado."
        dataIso={novaData.dataIso}
        hora={novaData.hora}
        duracaoMin={
          agendamento.procedimento?.duracaoMin ?? agendamento.duracaoMin
        }
        profissionalNome={agendamento.profissional.nome}
        profissionalEspecialidade={agendamento.profissional.especialidade}
        procedimentoNome={agendamento.procedimento?.nome ?? null}
        endereco={agendamento.tenant.endereco}
        cidade={agendamento.tenant.cidade}
        estado={agendamento.tenant.estado}
        telefoneClinica={
          agendamento.profissional.telefone ?? agendamento.tenant.telefone
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1 text-center">
        {agendamento.profissional.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={agendamento.profissional.logoUrl}
            alt="Logo"
            className="mx-auto mb-2 max-h-[60px] w-auto object-contain"
          />
        ) : null}
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Reagendar consulta
        </p>
        <h1 className="text-xl font-semibold text-slate-900 leading-tight">
          {agendamento.profissional.nome}
        </h1>
        {agendamento.profissional.especialidade ? (
          <p className="text-xs text-slate-500">
            {agendamento.profissional.especialidade}
          </p>
        ) : null}
      </header>

      <Stepper step={step} />

      {step !== "confirmar" ? (
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />
          Voltar
        </button>
      ) : null}

      {step === "confirmar" ? (
        <section className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Agendamento atual
            </p>
            <p className="text-sm font-semibold text-slate-900">
              {dataAtualLabel}
            </p>
            <p className="text-sm text-slate-700">as {horaAtual}</p>
            {agendamento.procedimento ? (
              <p className="text-xs text-slate-500">
                Procedimento: {agendamento.procedimento.nome} (
                {agendamento.procedimento.duracaoMin} min)
              </p>
            ) : null}
            <p className="text-xs text-slate-500">
              Paciente: {agendamento.paciente.nome}
            </p>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Voce pode reagendar esta consulta apenas uma vez. Apos o
            reagendamento, esta data sera marcada como reagendada e voce
            recebera um e-mail de confirmacao.
          </p>

          <button
            type="button"
            onClick={() => setStep("data")}
            disabled={!procedimentoId}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Reagendar
          </button>
          {!procedimentoId ? (
            <p className="text-xs text-amber-700">
              Procedimento original indisponivel. Entre em contato com o
              profissional.
            </p>
          ) : null}
        </section>
      ) : null}

      {step === "data" ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-slate-700">
            Escolha o novo dia
          </h2>
          <CalendarioMensal
            visibleMonth={visibleMonth}
            onChangeMonth={setVisibleMonth}
            selectedDate={selectedDate}
            onSelectDate={(d) => {
              setSelectedDate(d);
              setStep("hora");
            }}
            diasSemanaDisponiveis={diasSemanaDisponiveis}
            datasIndisponiveis={datasIndisponiveis}
          />
        </section>
      ) : null}

      {step === "hora" && selectedDate ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-slate-700">
            Horarios para{" "}
            <span className="text-slate-900">
              {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </span>
          </h2>
          {slotsError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {slotsError}
            </p>
          ) : diaIndisponivel ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {diaIndisponivel}. Escolha outra data.
            </p>
          ) : (
            <div className={slotsLoading ? "opacity-60" : undefined}>
              <SeletorHorario
                slots={slots}
                selected={selectedHora}
                onSelect={(h) => handleConfirmarHora(h)}
              />
            </div>
          )}
          {submitting ? (
            <p className="text-xs text-slate-500">Confirmando reagendamento...</p>
          ) : null}
          {submitError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {submitError}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export default ReagendarFlow;
