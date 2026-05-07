"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, X } from "lucide-react";
import { useTour, type TourStep } from "@/hooks/useTour";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "suaagendaonline:tour:concluido:v1";

const TOUR_STEPS: TourStep[] = [
  {
    alvo: "search",
    titulo: "Busca rapida",
    descricao:
      "Encontre pacientes, paginas e agendamentos rapidamente. No desktop, use o atalho Ctrl+K.",
  },
  {
    alvo: "proximo-card",
    titulo: "Proximo paciente",
    descricao:
      "Aqui voce ve seu proximo atendimento do dia, com botao rapido para iniciar a consulta.",
  },
  {
    alvo: "novo-agendamento",
    titulo: "Novo agendamento",
    descricao: "Crie novos agendamentos rapidamente com este botao.",
  },
  {
    alvo: "menu-pacientes",
    alvoAlternativo: "menu-pacientes-mobile",
    titulo: "Pacientes",
    descricao: "Cadastre e gerencie seus pacientes a qualquer momento.",
  },
  {
    alvo: "menu-financeiro",
    alvoAlternativo: "menu-financeiro-mobile",
    titulo: "Financeiro",
    descricao: "Controle receitas, despesas e gere recibos para seus pacientes.",
  },
  {
    alvo: "menu-configuracoes",
    alvoAlternativo: "menu-mais-mobile",
    titulo: "Configuracoes",
    descricao:
      "Configure horarios, procedimentos, perfil profissional e templates de mensagem.",
  },
];

function TourGuiado() {
  const tour = useTour(TOUR_STEPS);
  const [pronto, setPronto] = useState(false);

  // Inicia automaticamente uma vez (flag em localStorage). Tambem escuta o
  // evento global "sao:iniciar-tour" para reabertura via checklist.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let jaConcluido = false;
    try {
      jaConcluido = window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // ignore
    }
    if (!jaConcluido) {
      // Atrasa um instante para o layout estabilizar.
      const id = window.setTimeout(() => tour.iniciar(), 600);
      return () => window.clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPronto(true);
    const onIniciar = () => tour.iniciar();
    window.addEventListener("sao:iniciar-tour", onIniciar);
    return () => window.removeEventListener("sao:iniciar-tour", onIniciar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quando o tour fecha, marca como concluido para nao reabrir automaticamente.
  useEffect(() => {
    if (!pronto && !tour.ativo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPronto(true);
    }
    if (!tour.ativo) {
      try {
        window.localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // ignore
      }
    }
  }, [tour.ativo, pronto]);

  if (!tour.ativo || !tour.step) return null;

  const { posicao, step, stepAtual, totalSteps } = tour;
  const ultimo = stepAtual + 1 >= totalSteps;

  return (
    <div
      role="dialog"
      aria-label="Tour guiado"
      aria-modal="true"
      className="fixed inset-0 z-[60]"
    >
      {/* Backdrop com recorte do alvo via box-shadow spread. */}
      <Recorte posicao={posicao} />

      {posicao ? (
        <div
          role="region"
          aria-label={step.titulo}
          className={cn(
            "fixed z-[61] w-[320px] max-w-[calc(100vw-24px)] rounded-xl bg-white shadow-2xl border border-slate-200 p-4 space-y-3",
          )}
          style={{ top: posicao.top, left: posicao.left }}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[12px] font-medium uppercase tracking-wide text-primary-text">
              Passo {stepAtual + 1} de {totalSteps}
            </p>
            <button
              type="button"
              aria-label="Fechar tour"
              onClick={tour.fechar}
              className="inline-flex items-center justify-center rounded p-1 text-slate-500 hover:bg-slate-100"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>

          <div className="space-y-1">
            <p className="text-[16px] font-semibold text-slate-900">
              {step.titulo}
            </p>
            <p className="text-[14px] text-slate-700 leading-relaxed">
              {step.descricao}
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={tour.pular}
              className="text-[13px] font-medium text-slate-500 hover:text-slate-900 transition-colors"
            >
              Pular tour
            </button>
            <div className="flex items-center gap-1.5">
              {stepAtual > 0 ? (
                <button
                  type="button"
                  onClick={tour.voltar}
                  aria-label="Passo anterior"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <ChevronLeft size={14} strokeWidth={1.5} aria-hidden="true" />
                  Voltar
                </button>
              ) : null}
              <button
                type="button"
                onClick={tour.avancar}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-white hover:bg-primary-dark transition-colors"
              >
                {ultimo ? "Concluir" : "Proximo"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        // Alvo nao encontrado — mostra um aviso central com opcao de pular.
        <div
          role="region"
          aria-label={step.titulo}
          className="fixed left-1/2 top-1/2 z-[61] w-[320px] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white shadow-2xl border border-slate-200 p-4 space-y-3"
        >
          <p className="text-[14px] font-medium text-slate-900">
            {step.titulo}
          </p>
          <p className="text-[13px] text-slate-600">
            Esta etapa nao esta disponivel nesta tela. Voce pode continuar.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={tour.fechar}
              className="text-[13px] font-medium text-slate-500 hover:text-slate-900"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={tour.avancar}
              className="rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-white hover:bg-primary-dark"
            >
              {ultimo ? "Concluir" : "Proximo"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Recorte({
  posicao,
}: {
  posicao: ReturnType<typeof useTour>["posicao"];
}) {
  if (!posicao) {
    return (
      <button
        type="button"
        aria-label="Fechar tour"
        onClick={() => {
          window.dispatchEvent(new Event("sao:fechar-tour"));
        }}
        className="absolute inset-0 bg-black/50 cursor-default"
        tabIndex={-1}
      />
    );
  }
  const { top, left, width, height } = posicao.alvo;
  // O recorte usa um div absoluto com box-shadow grande que cria o efeito
  // de halo escuro fora da bounding box do alvo. Mais leve que clip-path
  // e funciona em todos os navegadores.
  const padding = 4;
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 bg-black/40"
        style={{
          // Usa clip-path para perfurar o backdrop no formato do alvo.
          clipPath: `polygon(
            0% 0%, 0% 100%,
            ${left - padding}px 100%,
            ${left - padding}px ${top - padding}px,
            ${left + width + padding}px ${top - padding}px,
            ${left + width + padding}px ${top + height + padding}px,
            ${left - padding}px ${top + height + padding}px,
            ${left - padding}px 100%,
            100% 100%, 100% 0%
          )`,
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute rounded-lg ring-2 ring-primary"
        style={{
          top: top - padding,
          left: left - padding,
          width: width + padding * 2,
          height: height + padding * 2,
        }}
        aria-hidden="true"
      />
    </>
  );
}

export default TourGuiado;
