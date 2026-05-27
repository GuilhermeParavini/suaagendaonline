import Link from "next/link";
import { CalendarCheck } from "lucide-react";

export default function LandingHeader() {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4 sm:h-16 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-base font-semibold text-[#115E59] sm:text-lg"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#0D9488] text-white sm:h-9 sm:w-9">
            <CalendarCheck
              size={18}
              strokeWidth={2}
              aria-hidden="true"
              className="sm:h-5 sm:w-5"
            />
          </span>
          Agenda4U
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="hidden sm:inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Entrar
          </Link>
          <Link
            href="/cadastro"
            className="inline-flex h-9 items-center rounded-lg bg-[#0D9488] px-3 text-xs font-semibold text-white hover:bg-[#115E59] transition-colors sm:h-10 sm:px-4 sm:text-sm"
          >
            Começar grátis
          </Link>
        </nav>
      </div>
    </header>
  );
}
