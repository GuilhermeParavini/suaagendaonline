"use client";

import { useEffect, useState } from "react";
import { Bell, Search } from "lucide-react";
import CommandPalette from "./CommandPalette";

interface HeaderProps {
  userName?: string;
}

function Header({ userName = "Profissional" }: HeaderProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

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
