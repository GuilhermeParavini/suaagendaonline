import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type StatusVariant =
  | "agendado"
  | "confirmado"
  | "em_atendimento"
  | "concluido"
  | "faltou"
  | "cancelado";

interface StatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  status: StatusVariant;
}

const statusStyles: Record<StatusVariant, { className: string; label: string }> = {
  agendado: {
    className: "bg-[#DBEAFE] text-[#1E40AF]",
    label: "Agendado",
  },
  confirmado: {
    className: "bg-[#CCFBF1] text-[#115E59]",
    label: "Confirmado",
  },
  em_atendimento: {
    className: "bg-[#FEF3C7] text-[#92400E]",
    label: "Em atendimento",
  },
  concluido: {
    className: "bg-[#D1FAE5] text-[#065F46]",
    label: "Concluido",
  },
  faltou: {
    className: "bg-[#FEE2E2] text-[#991B1B]",
    label: "Faltou",
  },
  cancelado: {
    className: "bg-slate-200 text-slate-700",
    label: "Cancelado",
  },
};

function StatusPill({ status, className, children, ...props }: StatusPillProps) {
  const style = statusStyles[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-[3px] text-[11px] font-medium leading-none",
        style.className,
        className,
      )}
      {...props}
    >
      {children ?? style.label}
    </span>
  );
}

export default StatusPill;
