"use client";

import Link from "next/link";
import { ChevronRight, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Avatar from "@/components/ui/Avatar";
import SwipeableCard, {
  type SwipeAction,
} from "@/components/ui/SwipeableCard";
import { cleanPhone, formatPhone } from "@/lib/masks";
import { cn } from "@/lib/utils";
import type { PacienteListItem } from "@/actions/pacientes";
import { IconeContatoPreferencial } from "./ContatoPreferencial";

interface CardPacienteProps {
  paciente: PacienteListItem;
}

function CardPaciente({ paciente }: CardPacienteProps) {
  const telefoneFormatado = formatPhone(paciente.telefone);
  const ultimaConsultaLabel = paciente.ultima_consulta
    ? format(new Date(paciente.ultima_consulta), "dd MMM yyyy", { locale: ptBR })
    : "Sem consultas";

  const telefoneLimpo = cleanPhone(paciente.telefone ?? "");
  const podeWhatsApp = telefoneLimpo.length === 10 || telefoneLimpo.length === 11;

  const link = (
    <Link
      href={`/pacientes/${paciente.id}`}
      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 hover:border-slate-300 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <Avatar name={paciente.nome} className="h-10 w-10 text-sm" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          {/* Informacao primaria: nome do paciente — 16px semibold Slate 900 */}
          <p className="text-[16px] font-semibold text-slate-900 truncate">
            {paciente.nome}
          </p>
          {paciente.status_tratamento === "alta" ? (
            <span className="shrink-0 inline-flex items-center rounded-full bg-[#D1FAE5] px-2 py-[2px] text-[12px] font-medium leading-none text-[#065F46]">
              Alta
            </span>
          ) : null}
          {paciente.status_tratamento === "inativo" ? (
            <span className="shrink-0 inline-flex items-center rounded-full bg-slate-200 px-2 py-[2px] text-[12px] font-medium leading-none text-slate-600">
              Inativo
            </span>
          ) : null}
          {paciente.menor_idade ? (
            <span className="shrink-0 inline-flex items-center rounded-full bg-warning-surface px-2 py-[2px] text-[12px] font-medium leading-none text-[#92400E]">
              Menor
            </span>
          ) : null}
          {paciente.convenio ? (
            <span className="shrink-0 inline-flex items-center rounded-full bg-primary-surface px-2 py-[2px] text-[12px] font-medium leading-none text-primary-text">
              {paciente.convenio}
            </span>
          ) : null}
          {!paciente.email ? (
            <span className="shrink-0 inline-flex items-center rounded-full bg-slate-100 px-2 py-[2px] text-[12px] font-medium leading-none text-slate-500">
              Sem e-mail
            </span>
          ) : null}
        </div>
        {/* Metadados: 14px Slate 500 */}
        <div className="mt-1 flex items-center gap-2 text-[14px]">
          {telefoneFormatado ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 truncate",
                paciente.email
                  ? "text-slate-500"
                  : "font-medium text-slate-700",
              )}
            >
              <IconeContatoPreferencial
                canal={paciente.contato_preferencial}
                size={14}
              />
              {telefoneFormatado}
            </span>
          ) : null}
          {telefoneFormatado ? (
            <span aria-hidden="true" className="text-slate-500">
              •
            </span>
          ) : null}
          <span className="truncate text-slate-500">
            {ultimaConsultaLabel}
          </span>
        </div>
      </div>

      <ChevronRight
        size={18}
        strokeWidth={1.5}
        aria-hidden="true"
        className="shrink-0 text-slate-500"
      />
    </Link>
  );

  if (!podeWhatsApp) {
    return <li>{link}</li>;
  }

  const acaoWhatsApp: SwipeAction = {
    acao: () => {
      // wa.me com codigo do pais quando faltar (DDD+numero, BR=55)
      const numeroComPais = telefoneLimpo.startsWith("55")
        ? telefoneLimpo
        : `55${telefoneLimpo}`;
      window.open(
        `https://wa.me/${numeroComPais}`,
        "_blank",
        "noopener,noreferrer",
      );
    },
    icone: MessageCircle,
    cor: "bg-[#25D366]",
    label: "WhatsApp",
  };

  return (
    <li>
      <SwipeableCard onSwipeRight={acaoWhatsApp}>{link}</SwipeableCard>
    </li>
  );
}

export default CardPaciente;
