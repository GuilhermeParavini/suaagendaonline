import { Sparkles, Users } from "lucide-react";

export default function Testimonials() {
  return (
    <section className="bg-slate-50 py-12 sm:py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-[22px] font-semibold leading-tight text-slate-900 sm:text-[28px]">
            Profissionais que já usam
          </h2>
          <p className="mt-3 text-sm text-slate-600 sm:mt-4 sm:text-base">
            Estamos na fase beta com profissionais selecionados. Quer ser um dos
            primeiros?
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:mt-12 sm:gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-7">
            <div className="flex items-center gap-2 text-[#F97316]">
              <Sparkles size={18} aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                Em fase beta
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-700 sm:mt-4 sm:text-lg">
              &ldquo;Eu usava papel e perdia tempo digitando tudo. Agora gravo o
              atendimento e o sistema faz o resto. Sobra mais tempo pro
              paciente.&rdquo;
            </p>
            <div className="mt-6 flex items-center gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#F0FDFA] text-base font-semibold text-[#115E59]">
                PG
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Podóloga parceira
                </p>
                <p className="text-xs text-slate-500">Em fase beta - 2026</p>
              </div>
            </div>
          </article>

          <article className="flex flex-col justify-between rounded-2xl border border-dashed border-[#0D9488]/40 bg-[#F0FDFA]/40 p-4 sm:p-7">
            <div>
              <div className="flex items-center gap-2 text-[#115E59]">
                <Users size={18} aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wide">
                  Você pode ser o próximo
                </span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-900 sm:mt-4 sm:text-xl">
                Feito para podólogos, fisioterapeutas e nutricionistas em todo
                o Brasil.
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600 sm:mt-3 sm:text-sm">
                Estamos abrindo vagas em fase beta. Teste grátis por 14 dias e,
                se gostar, escolha o plano que faz sentido pra você.
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
