import { Mic, Bot, Check, X } from "lucide-react";

const COMPARATIVOS = [
  { nome: "iClinic", ok: false, label: "IA nao inclusa" },
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
    <section className="relative overflow-hidden bg-[#115E59] py-20 text-white sm:py-24">
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
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#CCFBF1]">
            Diferencial unico
          </span>
          <h2 className="mt-5 text-[28px] font-semibold leading-tight sm:text-[36px]">
            IA inclusa. Sem custo extra. Em todos os planos.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#CCFBF1]/90 sm:text-lg">
            Somos o unico sistema abaixo de R$ 100/mes com inteligencia
            artificial integrada de verdade.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-white/15 bg-white/5 p-7 backdrop-blur">
            <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#0D9488] text-white">
              <Mic size={22} strokeWidth={1.75} aria-hidden="true" />
            </div>
            <h3 className="text-xl font-semibold">Transcricao por voz</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#CCFBF1]/90">
              Grave o atendimento com um toque. A IA transcreve e organiza
              automaticamente na evolucao do paciente. Voce fala, o sistema
              escreve.
            </p>
          </article>

          <article className="rounded-2xl border border-white/15 bg-white/5 p-7 backdrop-blur">
            <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#F97316] text-white">
              <Bot size={22} strokeWidth={1.75} aria-hidden="true" />
            </div>
            <h3 className="text-xl font-semibold">Assistente inteligente</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#CCFBF1]/90">
              Pergunte sobre protocolos, medicamentos, condutas. Seu assistente
              clinico disponivel 24h, dentro do sistema.
            </p>
          </article>
        </div>

        {/* Comparativo */}
        <div className="mt-14 rounded-2xl border border-white/15 bg-white/5 p-6 backdrop-blur sm:p-8">
          <p className="text-center text-sm font-semibold uppercase tracking-wide text-[#CCFBF1]">
            Compare com os concorrentes
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
