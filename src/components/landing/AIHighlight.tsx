import { Mic, Bot, Check, X } from "lucide-react";

const COMPARATIVOS = [
  { nome: "iClinic", ok: false, label: "IA não inclusa" },
  { nome: "Simples Agenda", ok: false, label: "Sem IA" },
  { nome: "AgendaSmart", ok: false, label: "Sem IA" },
  {
    nome: "Agenda4U",
    ok: true,
    label: "IA inclusa desde R$ 29,90",
    destaque: true,
  },
];

export default function AIHighlight() {
  return (
    <section className="relative overflow-hidden bg-[#115E59] py-12 text-white sm:py-20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 top-0 h-[420px] w-[420px] rounded-full bg-[#0D9488]/40 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 bottom-0 h-[320px] w-[320px] rounded-full bg-[#F97316]/15 blur-3xl"
      />

      <div className="relative mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#CCFBF1] sm:px-4 sm:py-1.5 sm:text-xs">
            Diferencial único
          </span>
          <h2 className="mt-4 text-[22px] font-semibold leading-tight sm:mt-5 sm:text-[32px]">
            IA inclusa. Sem custo extra. Em todos os planos.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#CCFBF1]/90 sm:mt-4 sm:text-base lg:text-lg">
            Somos o único sistema abaixo de R$ 100/mês com inteligência
            artificial integrada de verdade.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:mt-12 sm:gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur sm:p-7">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#0D9488] text-white sm:mb-5 sm:h-12 sm:w-12">
              <Mic
                size={18}
                strokeWidth={1.75}
                aria-hidden="true"
                className="sm:h-[22px] sm:w-[22px]"
              />
            </div>
            <h3 className="text-base font-semibold sm:text-xl">
              Transcrição por voz
            </h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#CCFBF1]/90 sm:mt-2 sm:text-sm">
              Grave o atendimento com um toque. A IA transcreve e organiza
              automaticamente na evolução do paciente. Você fala, o sistema
              escreve.
            </p>
          </article>

          <article className="rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur sm:p-7">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#F97316] text-white sm:mb-5 sm:h-12 sm:w-12">
              <Bot
                size={18}
                strokeWidth={1.75}
                aria-hidden="true"
                className="sm:h-[22px] sm:w-[22px]"
              />
            </div>
            <h3 className="text-base font-semibold sm:text-xl">
              Assistente inteligente
            </h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#CCFBF1]/90 sm:mt-2 sm:text-sm">
              Pergunte sobre protocolos, medicamentos, condutas. Seu assistente
              clínico disponível 24h, dentro do sistema.
            </p>
          </article>
        </div>

        {/* Comparativo */}
        <div className="mt-8 rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur sm:mt-12 sm:p-8">
          <p className="text-center text-xs font-semibold uppercase tracking-wide text-[#CCFBF1] sm:text-sm">
            Compare com os concorrentes
          </p>
          <ul className="mt-4 grid gap-2 sm:mt-5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {COMPARATIVOS.map((c) => (
              <li
                key={c.nome}
                className={
                  c.destaque
                    ? "flex items-center gap-3 rounded-xl border border-[#F97316]/60 bg-[#F97316]/10 px-4 py-3"
                    : "flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                }
              >
                {c.ok ? (
                  <Check size={20} className="shrink-0 text-[#22C55E]" aria-hidden="true" />
                ) : (
                  <X size={20} className="shrink-0 text-rose-300" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{c.nome}</p>
                  <p className="text-xs text-[#CCFBF1]/80">{c.label}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
