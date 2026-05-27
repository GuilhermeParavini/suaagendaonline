"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Periodo = "mensal" | "anual";

type Plano = {
  id: string;
  nome: string;
  precoMensal: number;
  precoAnual: number;
  precoAnualTotal: number;
  profissionais: string;
  transcricao: string;
  assistente: string;
  popular?: boolean;
};

const PLANOS: Plano[] = [
  {
    id: "individual",
    nome: "Individual",
    precoMensal: 39.9,
    precoAnual: 29.9,
    precoAnualTotal: 358.8,
    profissionais: "1 profissional",
    transcricao: "60 min/mês",
    assistente: "100 perguntas/mês",
  },
  {
    id: "equipe3",
    nome: "Equipe 3",
    precoMensal: 49.9,
    precoAnual: 39.9,
    precoAnualTotal: 478.8,
    profissionais: "Até 3 profissionais",
    transcricao: "120 min/mês",
    assistente: "200 perguntas/mês",
    popular: true,
  },
  {
    id: "equipe5",
    nome: "Equipe 5",
    precoMensal: 59.9,
    precoAnual: 49.9,
    precoAnualTotal: 598.8,
    profissionais: "Até 5 profissionais",
    transcricao: "200 min/mês",
    assistente: "350 perguntas/mês",
  },
  {
    id: "clinica10",
    nome: "Clínica 10",
    precoMensal: 79.9,
    precoAnual: 69.9,
    precoAnualTotal: 838.8,
    profissionais: "Até 10 profissionais",
    transcricao: "400 min/mês",
    assistente: "700 perguntas/mês",
  },
];

const INCLUSO = [
  "Todas as funcionalidades",
  "Agenda online",
  "Anamnese personalizável",
  "Financeiro completo",
  "Suporte por e-mail",
];

function brl(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function formatarPreco(valor: number): string {
  return valor.toFixed(2).replace(".", ",");
}

export default function Pricing() {
  const [periodo, setPeriodo] = useState<Periodo>("anual");

  return (
    <section id="planos" className="scroll-mt-16 bg-slate-50 py-12 sm:py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-[22px] font-semibold leading-tight text-slate-900 sm:text-[28px]">
            Planos simples. Sem surpresas.
          </h2>
          <p className="mt-3 text-sm text-slate-600 sm:mt-4 sm:text-base">
            Todas as funcionalidades inclusas em todos os planos. A única
            diferença é o número de profissionais.
          </p>
        </div>

        {/* Toggle Mensal | Anual */}
        <div className="mt-6 flex justify-center sm:mt-10">
          <div
            role="tablist"
            aria-label="Período de cobrança"
            className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 text-sm shadow-sm"
          >
            <button
              type="button"
              role="tab"
              aria-selected={periodo === "mensal"}
              onClick={() => setPeriodo("mensal")}
              className={cn(
                "rounded-full px-5 py-2 font-medium transition-colors",
                periodo === "mensal"
                  ? "bg-[#0D9488] text-white"
                  : "text-slate-600 hover:bg-slate-100",
              )}
            >
              Mensal
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={periodo === "anual"}
              onClick={() => setPeriodo("anual")}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-5 py-2 font-medium transition-colors",
                periodo === "anual"
                  ? "bg-[#0D9488] text-white"
                  : "text-slate-600 hover:bg-slate-100",
              )}
            >
              Anual
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  periodo === "anual"
                    ? "bg-white text-[#115E59]"
                    : "bg-[#F97316]/15 text-[#F97316]",
                )}
              >
                Economize ~25%
              </span>
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:mt-12 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {PLANOS.map((plano) => {
            const preco =
              periodo === "anual" ? plano.precoAnual : plano.precoMensal;
            return (
              <article
                key={plano.id}
                className={
                  plano.popular
                    ? "relative flex flex-col rounded-2xl border-2 border-[#0D9488] bg-white p-4 shadow-[0_10px_30px_-10px_rgba(13,148,136,0.35)] sm:p-6"
                    : "relative flex flex-col rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"
                }
              >
                {plano.popular ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#F97316] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm">
                    Mais popular
                  </span>
                ) : null}

                <h3 className="text-base font-semibold text-slate-900 sm:text-lg">
                  {plano.nome}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 sm:mt-1 sm:text-sm">
                  {plano.profissionais}
                </p>

                <div className="mt-3 flex items-baseline gap-1 sm:mt-5">
                  <span className="text-xs font-medium text-slate-500 sm:text-sm">
                    R$
                  </span>
                  <span className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                    {formatarPreco(preco)}
                  </span>
                  <span className="text-xs text-slate-500 sm:text-sm">
                    /mês
                  </span>
                </div>

                {periodo === "anual" ? (
                  <p className="mt-1 text-xs leading-snug text-slate-500">
                    cobrado anualmente {brl(plano.precoAnualTotal)} em
                    parcela única
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">
                    cobrança mensal recorrente
                  </p>
                )}

                <ul className="mt-4 space-y-1.5 text-xs text-slate-700 sm:mt-6 sm:space-y-2.5 sm:text-sm">
                  <li className="flex items-start gap-2">
                    <Check
                      size={16}
                      className="mt-0.5 shrink-0 text-[#0D9488]"
                      aria-hidden="true"
                    />
                    <span>
                      Transcrição IA:{" "}
                      <strong className="text-slate-900">
                        {plano.transcricao}
                      </strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check
                      size={16}
                      className="mt-0.5 shrink-0 text-[#0D9488]"
                      aria-hidden="true"
                    />
                    <span>
                      Assistente IA:{" "}
                      <strong className="text-slate-900">
                        {plano.assistente}
                      </strong>
                    </span>
                  </li>
                  {INCLUSO.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check
                        size={16}
                        className="mt-0.5 shrink-0 text-[#0D9488]"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/cadastro"
                  className={
                    plano.popular
                      ? "mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-[#0D9488] text-sm font-semibold text-white transition-colors hover:bg-[#115E59] sm:mt-7 sm:h-11"
                      : "mt-5 inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 sm:mt-7 sm:h-11"
                  }
                >
                  Experimentar grátis
                </Link>
              </article>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500 sm:mt-10 sm:text-sm">
          14 dias grátis. Sem cartão de crédito. Cancele quando quiser.
        </p>
      </div>
    </section>
  );
}
