"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import NovoAgendamentoModal from "@/components/agenda/NovoAgendamentoModal";

function NovoAgendamentoFab() {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const router = useRouter();

  return (
    <>
      <button
        type="button"
        aria-label="Novo agendamento"
        onClick={() => setOpen(true)}
        data-tour="novo-agendamento"
        className="fixed right-4 bottom-[calc(56px+env(safe-area-inset-bottom)+16px)] lg:bottom-6 lg:right-6 h-14 w-14 rounded-full bg-primary text-white shadow-md hover:shadow-lg hover:bg-primary/90 transition flex items-center justify-center z-40"
      >
        <Plus size={24} strokeWidth={2} aria-hidden="true" />
      </button>

      <NovoAgendamentoModal
        open={open}
        onOpenChange={setOpen}
        onCriado={() => {
          setToast("Agendamento criado");
          window.setTimeout(() => setToast(null), 2500);
          router.refresh();
        }}
      />

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 -translate-x-1/2 bottom-[calc(56px+env(safe-area-inset-bottom)+96px)] lg:bottom-24 z-50 inline-flex items-center gap-2 rounded-lg border border-[#CCFBF1] bg-[#F0FDFA] px-4 py-2.5 text-sm font-medium text-[#115E59] shadow-md"
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}

export default NovoAgendamentoFab;
