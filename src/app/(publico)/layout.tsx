import type { ReactNode } from "react";

export default function PublicoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex h-12 max-w-[480px] items-center justify-center px-4">
          <p className="text-[13px] font-semibold tracking-tight text-primary-dark">
            Sua Agenda Online
          </p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[480px] px-4 py-6">{children}</main>
    </div>
  );
}
