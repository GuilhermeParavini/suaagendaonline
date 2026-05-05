import Avatar from "@/components/ui/Avatar";
import StatusPill, { type StatusVariant } from "@/components/ui/StatusPill";
import { cn } from "@/lib/utils";
import type { AgendamentoDia } from "@/actions/agendamentos";

interface CardAgendamentoProps {
  agendamento: AgendamentoDia;
  className?: string;
  onClick?: (agendamento: AgendamentoDia) => void;
  mostrarProfissional?: boolean;
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
        <span className="text-sm font-semibold text-slate-900 leading-tight">
          {horario}
        </span>
        <span className="text-[11px] text-slate-500 leading-tight">
          {agendamento.duracao_min} min
        </span>
      </div>

      <Avatar name={nomePaciente} className="h-9 w-9 text-[13px]" />

      <div className="min-w-0 flex-1 text-left">
        <p className="text-sm font-medium text-slate-900 truncate">
          {nomePaciente}
        </p>
        {nomeProcedimento ? (
          <p className="text-xs text-slate-500 truncate">{nomeProcedimento}</p>
        ) : null}
        {mostrarProfissional && agendamento.profissional?.nome ? (
          <span className="mt-0.5 inline-flex items-center rounded-full bg-primary-surface px-2 py-0.5 text-[10px] font-medium text-primary-dark">
            {agendamento.profissional.nome}
          </span>
        ) : null}
      </div>

      <StatusPill status={status} className="shrink-0" />
    </>
  );

  if (onClick) {
    return (
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
    );
  }

  return (
    <article
      className={cn(
        "flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3",
        className,
      )}
    >
      {conteudo}
    </article>
  );
}

export default CardAgendamento;
