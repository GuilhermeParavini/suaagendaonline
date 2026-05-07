"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import BotaoWhatsApp from "@/components/ui/BotaoWhatsApp";
import { mensagemCobranca } from "@/lib/whatsapp-templates";
import { formatCurrency } from "@/lib/masks";
import { cn } from "@/lib/utils";
import type { InadimplenteResumo } from "@/actions/inadimplencia";

interface CardInadimplenciaProps {
  items: InadimplenteResumo[];
  totalPendente: number;
}

function badgeUrgencia(dias: number): {
  label: string;
  classe: string;
} {
  if (dias > 60) {
    return {
      label: `${dias} dias`,
      classe: "bg-red-100 text-red-700",
    };
  }
  if (dias > 30) {
    return {
      label: `${dias} dias`,
      classe: "bg-orange-100 text-orange-800",
    };
  }
  return {
    label: dias === 0 ? "Hoje" : `${dias} ${dias === 1 ? "dia" : "dias"}`,
    classe: "bg-amber-100 text-amber-800",
  };
}

function valorParaCobranca(valor: number): string {
  // Formato BRL sem prefixo R$ — mensagem ja inclui "R$".
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function CardInadimplencia({
  items,
  totalPendente,
}: CardInadimplenciaProps) {
  const [aberto, setAberto] = useState(false);

  if (items.length === 0) return null;

  return (
    <section
      aria-label="Saldo pendente"
      className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5 space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
    >
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-controls="lista-inadimplencia"
        className="flex w-full items-center gap-3 text-left"
      >
        <span
          aria-hidden="true"
          className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-100"
        >
          <AlertTriangle
            size={20}
            strokeWidth={1.5}
            aria-hidden="true"
            className="text-amber-700"
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium uppercase tracking-wide text-amber-800">
            Saldo pendente
          </p>
          <p className="text-[24px] font-semibold text-slate-900 leading-tight">
            {formatCurrency(totalPendente)}
          </p>
          <p className="text-[13px] text-slate-700">
            {items.length}{" "}
            {items.length === 1
              ? "paciente com pagamento em aberto"
              : "pacientes com pagamento em aberto"}
          </p>
        </div>
        <span
          aria-hidden="true"
          className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-white/60"
        >
          {aberto ? (
            <ChevronUp size={18} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <ChevronDown size={18} strokeWidth={1.5} aria-hidden="true" />
          )}
        </span>
      </button>

      {aberto ? (
        <ul
          id="lista-inadimplencia"
          className="space-y-2 border-t border-amber-200 pt-3"
        >
          {items.map((it) => {
            const badge = badgeUrgencia(it.diasAtraso);
            const mensagem = mensagemCobranca({
              nome: it.nome,
              valor: valorParaCobranca(it.valorPendente),
              diasAtraso: it.diasAtraso,
            });
            return (
              <li
                key={it.pacienteId}
                className="rounded-lg border border-amber-200 bg-white p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-slate-900 truncate">
                      {it.nome}
                    </p>
                    <p className="text-[13px] text-slate-700">
                      {formatCurrency(it.valorPendente)}{" "}
                      <span className="text-slate-500">
                        · {it.lancamentosCount}{" "}
                        {it.lancamentosCount === 1
                          ? "lancamento"
                          : "lancamentos"}
                      </span>
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 inline-flex items-center rounded-full px-2 py-[2px] text-[11px] font-medium",
                      badge.classe,
                    )}
                    aria-label={`Em atraso ha ${it.diasAtraso} ${it.diasAtraso === 1 ? "dia" : "dias"}`}
                  >
                    {badge.label}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <BotaoWhatsApp
                    telefone={it.telefone}
                    mensagem={mensagem}
                    size="sm"
                    label="Cobrar via WhatsApp"
                  />
                  <Link
                    href={`/pacientes/${it.pacienteId}?tab=financeiro`}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    aria-label={`Abrir financeiro de ${it.nome}`}
                  >
                    <ExternalLink
                      size={13}
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                    Marcar como pago
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

export default CardInadimplencia;
