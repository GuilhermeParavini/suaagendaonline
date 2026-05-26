import Link from "next/link";
import { Check } from "lucide-react";

type Plano = {
  id: string;
  nome: string;
  preco: string;
  profissionais: string;
  transcricao: string;
  assistente: string;
  popular?: boolean;
};

const PLANOS: Plano[] = [
  {
    id: "individual",
    nome: "Individual",
    preco: "29,90",
    profissionais: "1 profissional",
    transcricao: "60 min/mes",
    assistente: "100 perguntas/mes",
  },
  {
    id: "equipe3",
    nome: "Equipe 3",
    preco: "39,90",
    profissionais: "Ate 3 profissionais",
    transcricao: "120 min/mes",
    assistente: "200 perguntas/mes",
    popular: true,
  },
  {
    id: "equipe5",
    nome: "Equipe 5",
    preco: "49,90",
    profissionais: "Ate 5 profissionais",
    transcricao: "200 min/mes",
    assistente: "350 perguntas/mes",
  },
  {
    id: "clinica10",
    nome: "Clinica 10",
    preco: "69,90",
    profissionais: "Ate 10 profissionais",
    transcricao: "400 min/mes",
    assistente: "700 perguntas/mes",
  },
];

const INCLUSO = [
  "Todas as funcionalidades",
  "Agenda online",
  "Anamnese personalizavel",
  "Financeiro completo",
  "Suporte por email",
];

export default function Pricing() {
  return (
    <section id="planos" className="scroll-mt-20 bg-slate-50 py-20 sm:py-24">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-[28px] font-semibold leading-tight text-slate-900 sm:text-[32px]">
            Planos simples. Sem surpresas.
          </h2>
          <p className="mt-4 text-base text-slate-600">
            Todas as funcionalidades inclusas em todos os planos. A unica
            diferenca e o numero de profissionais.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PLANOS.map((plano) => (
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
                <span className="text-sm font-medium text-slate-500">R$</span>
                <span className="text-4xl font-semibold text-slate-900">
                  {plano.preco}
                </span>
                <span className="text-sm text-slate-500">/mes</span>
              </div>

              <ul className="mt-6 space-y-2.5 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <Check
                    size={16}
                    className="mt-0.5 shrink-0 text-[#0D9488]"
                    aria-hidden="true"
                  />
                  <span>
                    Transcricao IA:{" "}
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
                Experimentar gratis
              </Link>
            </article>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-slate-500">
          14 dias gratis. Sem cartao de credito. Cancele quando quiser.
        </p>
      </div>
    </section>
  );
}
