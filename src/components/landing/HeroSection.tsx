import Link from "next/link";
import { ArrowRight, Sparkles, CalendarDays, Mic, Bot } from "lucide-react";
import LandingHeader from "./LandingHeader";

export default function HeroSection() {
  return (
    <>
      <LandingHeader />
      <section className="relative overflow-hidden bg-gradient-to-b from-[#F0FDFA] via-white to-slate-50">
        {/* blob decorativo */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full bg-[#99F6E4]/40 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 top-40 h-[320px] w-[320px] rounded-full bg-[#F97316]/10 blur-3xl"
        />

        <div className="relative mx-auto max-w-[1200px] px-4 py-20 sm:px-6 sm:py-24 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Coluna esquerda */}
            <div className="space-y-7 text-center lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#99F6E4] bg-[#F0FDFA] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#115E59]">
                <Sparkles size={14} aria-hidden="true" />
                IA inclusa - a partir de R$ 29,90/mês
              </span>

              <h1 className="text-[36px] font-semibold leading-[1.1] text-slate-900 sm:text-[44px] lg:text-[52px]">
                Sua agenda.{" "}
                <span className="text-[#0D9488]">Seus pacientes.</span>{" "}
                Sua IA.
              </h1>

              <p className="mx-auto max-w-[560px] text-base leading-relaxed text-slate-600 sm:text-lg lg:mx-0">
                Sistema completo de agendamento e gestão clínica com
                inteligência artificial inclusa. Para podólogos, fisioterapeutas,
                nutricionistas e profissionais da saúde.
              </p>

              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center lg:items-start lg:justify-start">
                <Link
                  href="/cadastro"
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0D9488] px-7 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#115E59] sm:w-auto"
                >
                  Experimentar grátis por 14 dias
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <Link
                  href="#planos"
                  className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-6 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:w-auto"
                >
                  Ver planos
                </Link>
              </div>

              <p className="text-xs text-slate-500">
                Sem cartão de crédito. Cancele quando quiser.
              </p>
            </div>

            {/* Coluna direita - mockup ilustrativo */}
            <div className="relative mx-auto w-full max-w-[480px]">
              <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-15px_rgba(13,148,136,0.25)]">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <CalendarDays
                      size={18}
                      className="text-[#0D9488]"
                      aria-hidden="true"
                    />
                    <span className="text-sm font-semibold text-slate-900">
                      Agenda de hoje
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">26 mai</span>
                </div>

                <ul className="mt-4 space-y-2.5">
                  {[
                    {
                      h: "09:00",
                      nome: "Maria Santos",
                      proc: "Consulta inicial",
                      status: "Confirmado",
                      cor: "bg-[#CCFBF1] text-[#115E59]",
                    },
                    {
                      h: "10:30",
                      nome: "João Pedro",
                      proc: "Retorno",
                      status: "Em atendimento",
                      cor: "bg-[#FEF3C7] text-[#92400E]",
                    },
                    {
                      h: "14:00",
                      nome: "Carla Lima",
                      proc: "Avaliação",
                      status: "Agendado",
                      cor: "bg-[#DBEAFE] text-[#1E40AF]",
                    },
                  ].map((ag) => (
                    <li
                      key={ag.h}
                      className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5"
                    >
                      <span className="w-12 shrink-0 text-sm font-semibold text-slate-900">
                        {ag.h}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {ag.nome}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {ag.proc}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${ag.cor}`}
                      >
                        {ag.status}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex items-center justify-between rounded-lg bg-[#F0FDFA] px-3 py-2.5">
                  <div className="flex items-center gap-2 text-[#115E59]">
                    <Mic size={16} aria-hidden="true" />
                    <span className="text-xs font-semibold">
                      Gravar evolução por voz
                    </span>
                  </div>
                  <Bot size={16} className="text-[#0D9488]" aria-hidden="true" />
                </div>
              </div>

              {/* Cards flutuantes decorativos */}
              <div className="absolute -left-6 -top-4 hidden rotate-[-4deg] rounded-lg bg-white px-3 py-2 shadow-md sm:block">
                <p className="text-[11px] font-semibold text-[#0D9488]">
                  IA inclusa
                </p>
                <p className="text-[10px] text-slate-500">100 perguntas/mês</p>
              </div>
              <div className="absolute -right-4 bottom-6 hidden rotate-[3deg] rounded-lg bg-white px-3 py-2 shadow-md sm:block">
                <p className="text-[11px] font-semibold text-[#F97316]">
                  R$ 29,90/mês
                </p>
                <p className="text-[10px] text-slate-500">Plano Individual</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
