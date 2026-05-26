import Link from "next/link";
import { CalendarCheck } from "lucide-react";

export default function LandingHeader() {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold text-[#115E59]"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#0D9488] text-white">
            <CalendarCheck size={20} strokeWidth={2} aria-hidden="true" />
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
            className="inline-flex h-10 items-center rounded-lg bg-[#0D9488] px-4 text-sm font-semibold text-white hover:bg-[#115E59] transition-colors"
          >
            Comecar gratis
          </Link>
        </nav>
      </div>
    </header>
  );
}
