import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Avatar from "@/components/ui/Avatar";
import { formatPhone } from "@/lib/masks";
import type { PacienteListItem } from "@/actions/pacientes";

interface CardPacienteProps {
  paciente: PacienteListItem;
}

function CardPaciente({ paciente }: CardPacienteProps) {
  const telefoneFormatado = formatPhone(paciente.telefone);
  const ultimaConsultaLabel = paciente.ultima_consulta
    ? format(new Date(paciente.ultima_consulta), "dd MMM yyyy", { locale: ptBR })
    : "Sem consultas";

  return (
    <li>
      <Link
        href={`/pacientes/${paciente.id}`}
        className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 hover:border-slate-300 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Avatar name={paciente.nome} className="h-10 w-10 text-sm" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {paciente.nome}
            </p>
            {paciente.menor_idade ? (
              <span className="shrink-0 inline-flex items-center rounded-full bg-warning-surface px-2 py-[2px] text-[11px] font-medium leading-none text-[#92400E]">
                Menor
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
            {telefoneFormatado ? (
              <span className="truncate">{telefoneFormatado}</span>
            ) : null}
            {telefoneFormatado ? <span aria-hidden="true">•</span> : null}
            <span className="truncate">{ultimaConsultaLabel}</span>
          </div>
        </div>

        <ChevronRight
          size={18}
          strokeWidth={1.5}
          aria-hidden="true"
          className="shrink-0 text-slate-400"
        />
      </Link>
    </li>
  );
}

export default CardPaciente;
