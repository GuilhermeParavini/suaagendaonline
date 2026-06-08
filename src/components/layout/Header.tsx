"use client";

import { useEffect, useState } from "react";
import { Bell, Clock, Search } from "lucide-react";
import CommandPalette from "./CommandPalette";

interface HeaderProps {
  userName?: string;
  plano?: string;
  trialExpiraEm?: string | null;
}

function Header({
  userName = "Profissional",
  plano,
  trialExpiraEm,
}: HeaderProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

  // Badge de trial: dias restantes ate o fim do periodo de teste. Trial
  // expirado nao mostra badge (o usuario ja e levado a /plano-expirado).
  const diasTrial =
    plano === "trial" && trialExpiraEm
      ? Math.ceil(
          (new Date(trialExpiraEm).getTime() - Date.now()) / 86_400_000,
        )
      : null;
  const mostrarBadgeTrial =
    diasTrial !== null && Number.isFinite(diasTrial) && diasTrial > 0;
  const trialUrgente = diasTrial !== null && diasTrial < 3;

  // Listener global de Ctrl+K / Cmd+K para abrir o palette.
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsMac(/mac|iphone|ipad|ipod/i.test(navigator.platform));
    }
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k !== "k") return;
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      setPaletteOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const atalho = isMac ? "⌘K" : "Ctrl+K";

  return (
    <>
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between gap-2 h-14 px-4 lg:px-6">
          <p className="text-base font-medium text-slate-900 lg:hidden truncate">
            Ola, {userName}
          </p>
          <div className="hidden lg:block" aria-hidden="true" />

          <div className="flex items-center gap-1 sm:gap-2">
            {mostrarBadgeTrial ? (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium ${
                  trialUrgente
                    ? "bg-red-50 text-red-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                <Clock size={13} strokeWidth={1.5} aria-hidden="true" />
                Trial: {diasTrial} {diasTrial === 1 ? "dia" : "dias"} restantes
              </span>
            ) : null}

            <button
              type="button"
              aria-label="Buscar"
              onClick={() => setPaletteOpen(true)}
              data-tour="search"
              className="hidden lg:inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors min-h-[40px]"
            >
              <Search size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>Buscar...</span>
              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-mono text-slate-500">
                {atalho}
              </kbd>
            </button>

            <button
              type="button"
              aria-label="Buscar"
              onClick={() => setPaletteOpen(true)}
              data-tour="search"
              className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Search size={20} strokeWidth={1.5} aria-hidden="true" />
            </button>

            <button
              type="button"
              aria-label="Notificacoes"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Bell size={20} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}

export default Header;
