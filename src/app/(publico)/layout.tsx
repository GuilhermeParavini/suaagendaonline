import type { ReactNode } from "react";
import SeloLGPD from "@/components/ui/SeloLGPD";

export default function PublicoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex h-12 max-w-[480px] items-center justify-center px-4">
          <p className="text-[13px] font-semibold tracking-tight text-primary-dark">
            Sua Agenda Online
          </p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[480px] flex-1 px-4 py-6">
        {children}
        <div className="mt-8 flex justify-center">
          <SeloLGPD />
        </div>
      </main>
      <footer className="border-t border-slate-200 py-4">
        <p className="text-center text-[11px] text-slate-500">
          Sua Agenda Online
        </p>
      </footer>
    </div>
  );
}
