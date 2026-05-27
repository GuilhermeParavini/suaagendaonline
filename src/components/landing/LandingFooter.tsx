import Link from "next/link";
import { CalendarCheck, ShieldCheck } from "lucide-react";

export default function LandingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 sm:py-12">
        <div className="grid gap-6 sm:grid-cols-2 sm:gap-10 lg:grid-cols-4">
          <div>
            <Link
              href="/"
              className="flex items-center gap-2 text-lg font-semibold text-[#115E59]"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#0D9488] text-white">
                <CalendarCheck size={20} strokeWidth={2} aria-hidden="true" />
              </span>
              Agenda4U
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-slate-500">
              Sistema de gestão para profissionais da saúde com inteligência
              artificial inclusa.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">Produto</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>
                <Link href="#planos" className="hover:text-[#0D9488]">
                  Planos e preços
                </Link>
              </li>
              <li>
                <Link href="/cadastro" className="hover:text-[#0D9488]">
                  Começar grátis
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-[#0D9488]">
                  Entrar
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">Legal</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>
                <Link href="/termos" className="hover:text-[#0D9488]">
                  Termos de uso
                </Link>
              </li>
              <li>
                <Link href="/privacidade" className="hover:text-[#0D9488]">
                  Política de privacidade
                </Link>
              </li>
              <li>
                <a
                  href="mailto:info@appagenda4u.com"
                  className="hover:text-[#0D9488]"
                >
                  Contato
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">Segurança</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#99F6E4] bg-[#F0FDFA] px-3 py-2">
              <ShieldCheck size={16} className="text-[#0D9488]" aria-hidden="true" />
              <span className="text-xs font-semibold text-[#115E59]">
                Dados protegidos pela LGPD
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-slate-100 pt-6 text-[11px] text-slate-500 sm:mt-12 sm:flex-row sm:gap-3 sm:pt-8 sm:text-xs">
          <p>AGPXL &copy; 2026. Todos os direitos reservados.</p>
          <p>appagenda4u.com</p>
        </div>
      </div>
    </footer>
  );
}
