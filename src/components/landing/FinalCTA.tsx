import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function FinalCTA() {
  return (
    <section className="bg-white py-12 sm:py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0D9488] via-[#0D9488] to-[#115E59] px-5 py-10 text-center text-white sm:px-12 sm:py-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-[#F97316]/20 blur-3xl"
          />

          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-[22px] font-semibold leading-tight sm:text-[32px]">
              Pronto para simplificar sua rotina?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#CCFBF1]/90 sm:mt-4 sm:text-base lg:text-lg">
              14 dias grátis. Sem cartão. Todas as funcionalidades.
            </p>

            <Link
              href="/cadastro"
              className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-6 text-sm font-semibold text-[#115E59] shadow-sm transition-colors hover:bg-[#F0FDFA] sm:mt-8 sm:h-12 sm:px-7 sm:text-base"
            >
              Criar minha conta grátis
              <ArrowRight size={16} aria-hidden="true" />
            </Link>

            <p className="mt-3 text-[11px] text-[#CCFBF1]/80 sm:mt-4 sm:text-xs">
              Setup em menos de 3 minutos. Cancele quando quiser.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
