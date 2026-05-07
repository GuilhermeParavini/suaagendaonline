"use client";

import { Check, Play, X } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import StatusPill, { type StatusVariant } from "@/components/ui/StatusPill";
import SwipeableCard, {
  type SwipeAction,
} from "@/components/ui/SwipeableCard";
import { cn } from "@/lib/utils";
import type { AgendamentoDia } from "@/actions/agendamentos";

interface CardAgendamentoProps {
  agendamento: AgendamentoDia;
  className?: string;
  onClick?: (agendamento: AgendamentoDia) => void;
  mostrarProfissional?: boolean;
  /** Confirma presenca (status agendado → confirmado). */
  onConfirmar?: (agendamento: AgendamentoDia) => void;
  /** Inicia atendimento (status confirmado → em_atendimento). */
  onIniciar?: (agendamento: AgendamentoDia) => void;
  /** Solicita cancelamento — pai abre modal de confirmacao. */
  onSolicitarCancelamento?: (agendamento: AgendamentoDia) => void;
}

const isStatusVariant = (s: string): s is StatusVariant =>
  s === "agendado" ||
  s === "confirmado" ||
  s === "em_atendimento" ||
  s === "concluido" ||
  s === "faltou";

function CardAgendamento({
  agendamento,
  className,
  onClick,
  mostrarProfissional,
  onConfirmar,
  onIniciar,
  onSolicitarCancelamento,
}: CardAgendamentoProps) {
  const dt = new Date(agendamento.data_hora);
  const horario = dt.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

  const status: StatusVariant = isStatusVariant(agendamento.status)
    ? agendamento.status
    : "agendado";

  const nomePaciente = agendamento.paciente?.nome ?? "Paciente";
  const nomeProcedimento = agendamento.procedimento?.nome ?? null;

  const conteudo = (
    <>
      <div className="flex w-12 shrink-0 flex-col items-center text-center">
        <span className="text-[15px] font-semibold text-slate-900 leading-tight">
          {horario}
        </span>
        <span className="text-[12px] text-slate-500 leading-tight">
          {agendamento.duracao_min} min
        </span>
      </div>

      <Avatar name={nomePaciente} className="h-10 w-10 text-[14px]" />

      <div className="min-w-0 flex-1 text-left">
        {/* Informacao primaria: nome do paciente — 16px semibold Slate 900 */}
        <p className="text-[16px] font-semibold text-slate-900 truncate">
          {nomePaciente}
        </p>
        {/* Metadado: procedimento — 14px Slate 500 */}
        {nomeProcedimento ? (
          <p className="text-[14px] text-slate-500 truncate">
            {nomeProcedimento}
          </p>
        ) : null}
        {mostrarProfissional && agendamento.profissional?.nome ? (
          <span className="mt-0.5 inline-flex items-center rounded-full bg-primary-surface px-2 py-0.5 text-[12px] font-medium text-primary-text">
            {agendamento.profissional.nome}
          </span>
        ) : null}
      </div>

      <StatusPill status={status} className="shrink-0" />
    </>
  );

  const cardCore = onClick ? (
    <button
      type="button"
      onClick={() => onClick(agendamento)}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 cursor-pointer transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
        className,
      )}
    >
      {conteudo}
    </button>
  ) : (
    <article
      className={cn(
        "flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3",
        className,
      )}
    >
      {conteudo}
    </article>
  );

  // Swipe direita: confirmar (agendado) ou iniciar (confirmado).
  const acaoDireita: SwipeAction | undefined =
    agendamento.status === "agendado" && onConfirmar
      ? {
          acao: () => onConfirmar(agendamento),
          icone: Check,
          cor: "bg-[#22C55E]",
          label: "Confirmar",
        }
      : agendamento.status === "confirmado" && onIniciar
        ? {
            acao: () => onIniciar(agendamento),
            icone: Play,
            cor: "bg-[#F59E0B]",
            label: "Iniciar",
          }
        : undefined;

  // Swipe esquerda: cancelar (somente se transicao permite e ha handler).
  const podeCancelar =
    onSolicitarCancelamento &&
    (agendamento.status === "agendado" ||
      agendamento.status === "confirmado");
  const acaoEsquerda: SwipeAction | undefined = podeCancelar
    ? {
        acao: () => onSolicitarCancelamento(agendamento),
        icone: X,
        cor: "bg-[#EF4444]",
        label: "Cancelar",
      }
    : undefined;

  const semSwipe = !acaoDireita && !acaoEsquerda;

  if (semSwipe) {
    return cardCore;
  }

  return (
    <SwipeableCard
      onSwipeRight={acaoDireita}
      onSwipeLeft={acaoEsquerda}
      disabled={semSwipe}
    >
      {cardCore}
    </SwipeableCard>
  );
}

export default CardAgendamento;
