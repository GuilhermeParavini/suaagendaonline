"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { excluirPaciente } from "@/actions/pacientes";
import { cn } from "@/lib/utils";

interface ExcluirPacienteDialogProps {
  pacienteId: string;
  pacienteNome: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ExcluirPacienteDialog({
  pacienteId,
  pacienteNome,
  open,
  onOpenChange,
}: ExcluirPacienteDialogProps) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleOpenChange = (next: boolean) => {
    if (!next) setErro(null);
    onOpenChange(next);
  };

  const handleExcluir = () => {
    setErro(null);
    startTransition(async () => {
      const result = await excluirPaciente(pacienteId);
      if (!result.ok) {
        setErro(result.error);
        return;
      }
      handleOpenChange(false);
      router.push("/pacientes");
      router.refresh();
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className={cn(
            "fixed z-50 bg-white shadow-lg focus:outline-none",
            "inset-x-0 bottom-0 rounded-t-2xl px-4 pt-5 pb-[max(env(safe-area-inset-bottom),16px)]",
            "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[400px] md:max-w-[calc(100vw-32px)] md:rounded-2xl md:p-6",
          )}
        >
          <div className="md:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" />

          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-base font-semibold text-slate-900">
              Excluir paciente
            </Dialog.Title>
            <Dialog.Close
              aria-label="Fechar"
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
            >
              <X size={18} strokeWidth={1.5} />
            </Dialog.Close>
          </div>

          <Dialog.Description className="mt-3 text-sm text-slate-600">
            Deseja excluir{" "}
            <span className="font-medium text-slate-900">{pacienteNome}</span>?
            Esta ação não pode ser desfeita.
          </Dialog.Description>

          {erro ? (
            <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {erro}
            </p>
          ) : null}

          <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
              className="rounded px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleExcluir}
              disabled={isPending}
              className="rounded border border-danger bg-transparent px-4 py-2 text-sm font-medium text-danger hover:bg-danger-surface transition-colors disabled:opacity-50"
            >
              {isPending ? "Excluindo..." : "Excluir paciente"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default ExcluirPacienteDialog;
