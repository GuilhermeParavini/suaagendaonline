import { Bell } from "lucide-react";

function Header() {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="flex items-center justify-between h-14 px-4 lg:px-6">
        <p className="text-base font-medium text-slate-900 lg:hidden">
          Olá, Profissional
        </p>
        <div className="hidden lg:block" aria-hidden="true" />
        <button
          type="button"
          aria-label="Notificacoes"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Bell size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

export default Header;
