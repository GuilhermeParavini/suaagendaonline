"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronLeft, Check, Clock, ShieldCheck, User } from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  criarAgendamentoPublico,
  getDisponibilidade,
  type Slot,
  type NovoPacientePublico,
} from "@/actions/agendamento-publico";
import {
  adicionarListaEsperaPublica,
  type TurnoPreferencia,
} from "@/actions/lista-espera";
import { cleanCPF, formatCPF } from "@/lib/masks";
import type {
  Procedimento,
  ProfissionalPublico,
} from "@/lib/agendamento-publico";
import CalendarioMensal from "./CalendarioMensal";
import {
  LazyFormPacientePublico,
  LazySeletorHorario,
} from "@/lib/dynamic-imports";
import { type FormResult } from "./FormPacientePublico";
import ResumoAgendamento from "./ResumoAgendamento";
import HeaderProfissionalPublico from "./HeaderProfissionalPublico";
import BioProfissional from "./BioProfissional";
import TelaConfirmacao from "./TelaConfirmacao";

type Step = "procedimento" | "data" | "hora" | "paciente" | "resumo" | "sucesso";

interface AgendarFlowProps {
  contexto: ProfissionalPublico;
  diasSemanaDisponiveis: number[];
  datasIndisponiveis: string[];
  slug: string;
}

function isoDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function formatarPreco(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function AgendarFlow({
  contexto,
  diasSemanaDisponiveis,
  datasIndisponiveis,
  slug,
}: AgendarFlowProps) {
  const extrairSlug = () => slug;
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
    // Ao trocar dia/procedimento na etapa "hora", reseta selecao e erros antes
    // de re-buscar disponibilidade. Limpeza de estado pre-fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  if (step === "sucesso" && selectedDate && selectedHora && procedimento) {
    return (
      <TelaConfirmacao
        titulo="Agendamento confirmado!"
        subtitulo="Voce recebera um email de confirmacao."
        dataIso={isoDate(selectedDate)}
        hora={selectedHora}
        duracaoMin={procedimento.duracao_min}
        profissionalNome={contexto.profissional.nome}
        profissionalEspecialidade={contexto.profissional.especialidade}
        procedimentoNome={procedimento.nome}
        endereco={contexto.tenant.endereco}
        cidade={contexto.tenant.cidade}
        estado={contexto.tenant.estado}
        telefoneClinica={
          contexto.profissional.telefone ?? contexto.tenant.telefone
        }
        linkVoltar={{ href: `/agendar/${slug}`, label: "Voltar ao inicio" }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <HeaderProfissionalPublico
        nome={contexto.profissional.nome}
        especialidade={contexto.profissional.especialidade}
        registroProfissional={contexto.profissional.registro_profissional}
        avatarUrl={contexto.profissional.avatar_url}
        logoUrl={contexto.profissional.logo_url}
        telefone={
          contexto.profissional.telefone ?? contexto.tenant.telefone
        }
        endereco={contexto.tenant.endereco}
        cidade={contexto.tenant.cidade}
        estado={contexto.tenant.estado}
        horarios={contexto.horarios}
        avaliacao={contexto.avaliacao}
      />

      <BioProfissional bio={contexto.profissional.bio} />

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
          <h2 className="text-[14px] font-medium text-slate-900">
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
                        "w-full rounded-lg border bg-white px-4 py-4 text-left transition-colors hover:border-primary",
                        isSelected
                          ? "border-primary bg-primary-surface"
                          : "border-slate-200",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-base font-semibold text-slate-900">
                            {p.nome}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-[13px] text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <Clock
                                size={12}
                                strokeWidth={1.5}
                                aria-hidden="true"
                              />
                              {p.duracao_min} min
                            </span>
                          </div>
                        </div>
                        {p.valor !== null ? (
                          <p className="shrink-0 text-base font-semibold text-primary-text">
                            {formatarPreco(p.valor)}
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
          <h2 className="text-[14px] font-medium text-slate-900">
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
          <h2 className="text-[14px] font-medium text-slate-900">
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
              <LazySeletorHorario
                slots={slots}
                selected={selectedHora}
                onSelect={(h) => {
                  setSelectedHora(h);
                  setStep("paciente");
                }}
              />
            </div>
          )}

          {!slotsLoading &&
          !slotsError &&
          !diaIndisponivel &&
          slots.length > 0 &&
          slots.every((s) => !s.available) ? (
            <ListaEsperaInline
              slug={extrairSlug()}
              profissionalId={contexto.profissional.id}
              procedimentoId={procedimento?.id ?? null}
              dataPreferenciaIso={
                selectedDate ? isoDate(selectedDate) : null
              }
            />
          ) : null}

          {!slotsLoading &&
          !slotsError &&
          !diaIndisponivel &&
          slots.length === 0 ? (
            <ListaEsperaInline
              slug={extrairSlug()}
              profissionalId={contexto.profissional.id}
              procedimentoId={procedimento?.id ?? null}
              dataPreferenciaIso={
                selectedDate ? isoDate(selectedDate) : null
              }
            />
          ) : null}
        </section>
      ) : null}

      {step === "paciente" ? (
        <section className="space-y-3">
          <h2 className="text-[14px] font-medium text-slate-900">
            Identifique-se
          </h2>
          <p className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-[13px] text-teal-700">
            <ShieldCheck
              size={14}
              strokeWidth={1.5}
              aria-hidden="true"
              className="shrink-0"
            />
            Seus dados sao protegidos e usados apenas para sua consulta.
          </p>
          <LazyFormPacientePublico
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
          <h2 className="text-[14px] font-medium text-slate-900">
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
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-text focus:ring-primary/40"
            />
            <span className="text-xs text-slate-600 leading-relaxed">
              Li e aceito a{" "}
              <a
                href="/privacidade"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary-text underline"
              >
                Politica de Privacidade
              </a>{" "}
              e os{" "}
              <a
                href="/termos"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary-text underline"
              >
                Termos de Uso
              </a>
              . Concordo com o tratamento dos meus dados pessoais para
              finalidade clinica e administrativa conforme a LGPD.
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

type StepStepper = Exclude<Step, "sucesso">;

const stepOrder: StepStepper[] = [
  "procedimento",
  "data",
  "hora",
  "paciente",
  "resumo",
];

const STEP_LABELS: Record<StepStepper, string> = {
  procedimento: "Procedimento",
  data: "Data",
  hora: "Hora",
  paciente: "Seus dados",
  resumo: "Confirmacao",
};

function Stepper({ step }: { step: Step }) {
  if (step === "sucesso") return null;
  const stepperStep: StepStepper = step;
  const currentIdx = stepOrder.indexOf(stepperStep);
  const total = stepOrder.length;
  const progresso = total === 1 ? 100 : (currentIdx / (total - 1)) * 100;
  const labelAtual = STEP_LABELS[stepperStep];

  return (
    <div
      role="group"
      aria-label="Etapas do agendamento"
      className="space-y-2"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-medium text-slate-900">
          Etapa {currentIdx + 1} de {total}
          <span className="text-slate-500 font-normal">
            {" "}
            — {labelAtual}
          </span>
        </p>
      </div>
      <div
        className="relative h-2 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progresso)}
      >
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progresso}%` }}
        />
      </div>
      <ol className="hidden sm:grid grid-cols-5 gap-1 text-center">
        {stepOrder.map((s, i) => {
          const ativo = i === currentIdx;
          const concluido = i < currentIdx;
          return (
            <li key={s} aria-current={ativo ? "step" : undefined}>
              <div className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold",
                    concluido && "bg-primary text-white",
                    ativo && "bg-primary text-white",
                    !concluido &&
                      !ativo &&
                      "bg-slate-200 text-slate-500",
                  )}
                >
                  {concluido ? (
                    <Check size={12} strokeWidth={2.5} aria-hidden="true" />
                  ) : ativo && s === "paciente" ? (
                    <User size={12} strokeWidth={1.5} aria-hidden="true" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={cn(
                    "text-[12px] leading-tight",
                    ativo
                      ? "font-medium text-primary-text"
                      : concluido
                        ? "text-slate-700"
                        : "text-slate-500",
                  )}
                >
                  {STEP_LABELS[s]}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

interface ListaEsperaInlineProps {
  slug: string;
  profissionalId: string;
  procedimentoId: string | null;
  dataPreferenciaIso: string | null;
}

function ListaEsperaInline({
  slug,
  profissionalId,
  procedimentoId,
  dataPreferenciaIso,
}: ListaEsperaInlineProps) {
  const [aberto, setAberto] = useState(false);
  const [cpfInput, setCpfInput] = useState("");
  const [turno, setTurno] = useState<TurnoPreferencia>("qualquer");
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [precisaCadastro, setPrecisaCadastro] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    setErro(null);
    setPrecisaCadastro(false);
    if (cleanCPF(cpfInput).length !== 11) {
      setErro("Informe um CPF válido.");
      return;
    }
    startTransition(async () => {
      const r = await adicionarListaEsperaPublica({
        slug,
        profissionalId,
        cpf: cleanCPF(cpfInput),
        procedimentoId,
        dataPreferencia: dataPreferenciaIso,
        turnoPreferencia: turno,
        observacoes: observacoes.trim() || undefined,
      });
      if (!r.ok) {
        setErro(r.error);
        if (r.precisaCadastro) setPrecisaCadastro(true);
        return;
      }
      setSucesso(true);
    });
  };

  if (sucesso) {
    return (
      <div className="rounded-lg border border-[#CCFBF1] bg-[#F0FDFA] p-4">
        <p className="text-sm font-medium text-[#115E59]">
          Você entrou na lista de espera!
        </p>
        <p className="mt-1 text-xs text-[#115E59]">
          O profissional entrará em contato quando houver disponibilidade.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
      <p className="text-sm font-medium text-amber-800">
        Não há horários disponíveis nesta data.
      </p>
      {!aberto ? (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors"
        >
          Entrar na lista de espera
        </button>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="block text-[14px] font-medium text-slate-900">
              CPF
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={14}
              placeholder="000.000.000-00"
              value={cpfInput}
              onChange={(e) => setCpfInput(formatCPF(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/10"
            />
            <p className="text-[11px] text-slate-500">
              Usamos seu CPF para identificar seu cadastro.
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-[14px] font-medium text-slate-900">
              Turno de preferência
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { v: "manha", lbl: "Manhã" },
                  { v: "tarde", lbl: "Tarde" },
                  { v: "qualquer", lbl: "Qualquer" },
                ] as { v: TurnoPreferencia; lbl: string }[]
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setTurno(opt.v)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    turno === opt.v
                      ? "border-primary bg-primary text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  {opt.lbl}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[14px] font-medium text-slate-900">
              Observação (opcional)
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Ex.: prefiro tarde da semana"
              className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/10"
            />
          </div>

          {erro ? (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <p>{erro}</p>
              {precisaCadastro ? (
                <a
                  href={`/cadastro-paciente/${slug}`}
                  className="mt-1 inline-block text-xs font-medium text-primary-text hover:underline"
                >
                  Fazer meu cadastro →
                </a>
              ) : null}
            </div>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAberto(false)}
              disabled={isPending}
              className="rounded px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || cleanCPF(cpfInput).length !== 11}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
            >
              {isPending ? "Enviando..." : "Confirmar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AgendarFlow;
