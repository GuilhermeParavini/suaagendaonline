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
    <section id="planos" className="scroll-mt-20 bg-slate-50 py-20 sm:py-24">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-[28px] font-semibold leading-tight text-slate-900 sm:text-[32px]">
            Planos simples. Sem surpresas.
          </h2>
          <p className="mt-4 text-base text-slate-600">
            Todas as funcionalidades inclusas em todos os planos. A única
            diferença é o número de profissionais.
          </p>
        </div>

        {/* Toggle Mensal | Anual */}
        <div className="mt-10 flex justify-center">
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

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PLANOS.map((plano) => {
            const preco =
              periodo === "anual" ? plano.precoAnual : plano.precoMensal;
            return (
              <article
                key={plano.id}
                className={
                  plano.popular
                    ? "relative flex flex-col rounded-2xl border-2 border-[#0D9488] bg-white p-6 shadow-[0_10px_30px_-10px_rgba(13,148,136,0.35)]"
                    : "relative flex flex-col rounded-2xl border border-slate-200 bg-white p-6"
                }
              >
                {plano.popular ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#F97316] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm">
                    Mais popular
                  </span>
                ) : null}

                <h3 className="text-lg font-semibold text-slate-900">
                  {plano.nome}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {plano.profissionais}
                </p>

                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-sm font-medium text-slate-500">
                    R$
                  </span>
                  <span className="text-4xl font-semibold text-slate-900">
                    {formatarPreco(preco)}
                  </span>
                  <span className="text-sm text-slate-500">/mês</span>
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

                <ul className="mt-6 space-y-2.5 text-sm text-slate-700">
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
                      ? "mt-7 inline-flex h-11 items-center justify-center rounded-lg bg-[#0D9488] text-sm font-semibold text-white transition-colors hover:bg-[#115E59]"
                      : "mt-7 inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50"
                  }
                >
                  Experimentar grátis
                </Link>
              </article>
            );
          })}
        </div>

        <p className="mt-10 text-center text-sm text-slate-500">
          14 dias grátis. Sem cartão de crédito. Cancele quando quiser.
        </p>
      </div>
    </section>
  );
}
