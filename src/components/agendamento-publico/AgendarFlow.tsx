"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronLeft, Check } from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  criarAgendamentoPublico,
  getDisponibilidade,
  type Slot,
  type NovoPacientePublico,
} from "@/actions/agendamento-publico";
import type {
  Procedimento,
  ProfissionalPublico,
} from "@/lib/agendamento-publico";
import CalendarioMensal from "./CalendarioMensal";
import SeletorHorario from "./SeletorHorario";
import FormPacientePublico, {
  type FormResult,
} from "./FormPacientePublico";
import ResumoAgendamento from "./ResumoAgendamento";

type Step = "procedimento" | "data" | "hora" | "paciente" | "resumo" | "sucesso";

interface AgendarFlowProps {
  contexto: ProfissionalPublico;
  diasSemanaDisponiveis: number[];
  datasIndisponiveis: string[];
}

function isoDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function AgendarFlow({
  contexto,
  diasSemanaDisponiveis,
  datasIndisponiveis,
}: AgendarFlowProps) {
  const [step, setStep] = useState<Step>("procedimento");
  const [procedimento, setProcedimento] = useState<Procedimento | null>(null);
  const [visibleMonth, setVisibleMonth] = useState<Date>(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, startSlotsLoad] = useTransition();
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [diaIndisponivel, setDiaIndisponivel] = useState<string | null>(null);
  const [selectedHora, setSelectedHora] = useState<string | null>(null);
  const [paciente, setPaciente] = useState<FormResult | null>(null);
  const [aceiteLgpd, setAceiteLgpd] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (step !== "hora" || !selectedDate || !procedimento) return;
    setSelectedHora(null);
    setSlotsError(null);
    setDiaIndisponivel(null);
    startSlotsLoad(async () => {
      const result = await getDisponibilidade(
        contexto.profissional.id,
        isoDate(selectedDate),
        procedimento.id,
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
                ? `Indisponível: ${result.indisponivel.motivo}`
                : "Profissional indisponível neste dia.",
          );
        }
      }
    });
  }, [step, selectedDate, procedimento, contexto.profissional.id]);

  const goBack = () => {
    setSubmitError(null);
    if (step === "data") setStep("procedimento");
    else if (step === "hora") setStep("data");
    else if (step === "paciente") setStep("hora");
    else if (step === "resumo") setStep("paciente");
  };

  const handleConfirm = () => {
    if (!procedimento || !selectedDate || !selectedHora || !paciente) return;
    setSubmitError(null);

    const payload =
      "existingId" in paciente
        ? { pacienteExistenteId: paciente.existingId }
        : { novoPaciente: paciente.novoPaciente as NovoPacientePublico };

    startSubmit(async () => {
      const result = await criarAgendamentoPublico({
        tenantId: contexto.tenantId,
        profissionalId: contexto.profissional.id,
        procedimentoId: procedimento.id,
        dataIso: isoDate(selectedDate),
        hora: selectedHora,
        aceiteLgpd,
        ...payload,
      });
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      setStep("sucesso");
    });
  };

  const pacienteNome =
    paciente && "existingId" in paciente
      ? paciente.nome
      : paciente && "novoPaciente" in paciente
      ? paciente.novoPaciente.nome
      : "";

  if (step === "sucesso") {
    return (
      <div className="space-y-6 text-center pt-4">
        <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary-surface">
          <Check size={32} strokeWidth={2.5} className="text-primary" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">
            Agendamento confirmado
          </h2>
          <p className="text-sm text-slate-600">
            Você receberá um e-mail de confirmação.
          </p>
        </div>
        {selectedDate && selectedHora && procedimento ? (
          <ResumoAgendamento
            profissionalNome={contexto.profissional.nome}
            procedimentoNome={procedimento.nome}
            data={selectedDate}
            hora={selectedHora}
            pacienteNome={pacienteNome}
            valor={procedimento.valor}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1 text-center">
        {contexto.profissional.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={contexto.profissional.logo_url}
            alt="Logo"
            className="mx-auto mb-2 max-h-[60px] w-auto object-contain"
          />
        ) : null}
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          {contexto.profissional.especialidade}
        </p>
        <h1 className="text-xl font-semibold text-slate-900 leading-tight">
          {contexto.profissional.nome}
        </h1>
      </header>

      <Stepper step={step} />

      {step !== "procedimento" ? (
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />
          Voltar
        </button>
      ) : null}

      {step === "procedimento" ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-slate-700">
            Escolha o procedimento
          </h2>
          {contexto.procedimentos.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-white p-4 text-center text-sm text-slate-500">
              Sem procedimentos disponíveis no momento.
            </p>
          ) : (
            <ul className="space-y-2">
              {contexto.procedimentos.map((p) => {
                const isSelected = procedimento?.id === p.id;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setProcedimento(p);
                        setSelectedDate(null);
                        setSelectedHora(null);
                        setStep("data");
                      }}
                      className={cn(
                        "w-full rounded-lg border bg-white px-4 py-3 text-left transition-colors hover:border-primary",
                        isSelected ? "border-primary bg-primary-surface" : "border-slate-200",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {p.nome}
                          </p>
                          <p className="text-xs text-slate-500">
                            {p.duracao_min} min
                          </p>
                        </div>
                        {p.valor !== null ? (
                          <p className="shrink-0 text-sm font-medium text-primary-dark">
                            {p.valor.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {step === "data" ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-slate-700">
            Escolha o dia
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
            Horários para{" "}
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
                onSelect={(h) => {
                  setSelectedHora(h);
                  setStep("paciente");
                }}
              />
            </div>
          )}
        </section>
      ) : null}

      {step === "paciente" ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-slate-700">
            Identifique-se
          </h2>
          <FormPacientePublico
            tenantId={contexto.tenantId}
            onIdentified={(result) => {
              setPaciente(result);
              setStep("resumo");
            }}
            onBack={goBack}
          />
        </section>
      ) : null}

      {step === "resumo" && procedimento && selectedDate && selectedHora && paciente ? (
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-slate-700">
            Confirme seu agendamento
          </h2>

          <ResumoAgendamento
            profissionalNome={contexto.profissional.nome}
            procedimentoNome={procedimento.nome}
            data={selectedDate}
            hora={selectedHora}
            pacienteNome={pacienteNome}
            valor={procedimento.valor}
          />

          <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={aceiteLgpd}
              onChange={(e) => setAceiteLgpd(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
            />
            <span className="text-xs text-slate-600 leading-relaxed">
              Concordo com o tratamento dos meus dados pessoais para finalidade clínica
              e administrativa, conforme a Lei Geral de Proteção de Dados (LGPD).
            </span>
          </label>

          {submitError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {submitError}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={goBack}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!aceiteLgpd || submitting}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Confirmando..." : "Confirmar agendamento"}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

const stepOrder: Step[] = ["procedimento", "data", "hora", "paciente", "resumo"];

function Stepper({ step }: { step: Step }) {
  const currentIdx = stepOrder.indexOf(step);
  return (
    <ol
      aria-label="Etapas"
      className="flex items-center gap-1.5"
    >
      {stepOrder.map((s, i) => {
        const active = i === currentIdx;
        const done = i < currentIdx;
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

export default AgendarFlow;
