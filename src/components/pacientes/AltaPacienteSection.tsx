"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { UserCheck, UserPlus, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { darAlta, reativarPaciente } from "@/actions/pacientes";
import { cn } from "@/lib/utils";

interface AltaPacienteSectionProps {
  pacienteId: string;
  pacienteNome: string;
  status: "ativo" | "alta" | "inativo";
  dataAlta: string | null;
  motivoAlta: string | null;
}

function AltaPacienteSection({
  pacienteId,
  pacienteNome,
  status,
  dataAlta,
  motivoAlta,
}: AltaPacienteSectionProps) {
  const router = useRouter();
  const [modalAberto, setModalAberto] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleReativar = () => {
    startTransition(async () => {
      const r = await reativarPaciente(pacienteId);
      if (r.ok) router.refresh();
    });
  };

  if (status === "alta") {
    const dataFmt = dataAlta
      ? format(new Date(dataAlta), "dd/MM/yyyy", { locale: ptBR })
      : "—";
    return (
      <section className="rounded-lg border border-[#A7F3D0] bg-[#F0FDF4] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#065F46]">
              Paciente com alta em {dataFmt}
            </p>
            {motivoAlta ? (
              <p className="mt-1 text-xs text-[#065F46] whitespace-pre-wrap break-words">
                {motivoAlta}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleReativar}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-surface transition-colors disabled:opacity-50"
          >
            <UserPlus size={13} strokeWidth={1.5} aria-hidden="true" />
            {isPending ? "Reativando..." : "Reativar paciente"}
          </button>
        </div>
      </section>
    );
  }

  if (status === "inativo") {
    return (
      <section className="rounded-lg border border-slate-200 bg-slate-100 p-4">
        <p className="text-sm font-semibold text-slate-700">Paciente inativo</p>
      </section>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalAberto(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#16A34A] px-3 py-1.5 text-xs font-medium text-[#16A34A] hover:bg-[#F0FDF4] transition-colors"
      >
        <UserCheck size={14} strokeWidth={1.5} aria-hidden="true" />
        Dar alta
      </button>
      {modalAberto ? (
        <ModalDarAlta
          pacienteId={pacienteId}
          pacienteNome={pacienteNome}
          onClose={() => setModalAberto(false)}
          onConfirmado={() => {
            setModalAberto(false);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

function ModalDarAlta({
  pacienteId,
  pacienteNome,
  onClose,
  onConfirmado,
}: {
  pacienteId: string;
  pacienteNome: string;
  onClose: () => void;
  onConfirmado: (agendamentosFuturos: number) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<number | null>(null);
  const [salvando, startSalvar] = useTransition();

  const handleConfirmar = () => {
    setErro(null);
    if (motivo.trim().length < 3) {
      setErro("Informe o motivo da alta.");
      return;
    }
    startSalvar(async () => {
      const r = await darAlta(pacienteId, motivo);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      if (r.agendamentosFuturos > 0) {
        setAviso(r.agendamentosFuturos);
        window.setTimeout(() => onConfirmado(r.agendamentosFuturos), 1500);
        return;
      }
      onConfirmado(0);
    });
  };

  return (
    <Dialog.Root open={true} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className={cn(
            "fixed z-50 bg-white shadow-lg focus:outline-none flex flex-col",
            "inset-x-0 bottom-0 max-h-[92vh] rounded-t-2xl px-4 pt-5 pb-[max(env(safe-area-inset-bottom),16px)]",
            "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[480px] md:max-w-[calc(100vw-32px)] md:rounded-2xl md:p-6",
          )}
        >
          <div className="md:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 shrink-0" />
          <div className="flex items-start justify-between gap-3 shrink-0">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-900">
                Dar alta
              </Dialog.Title>
              <p className="text-xs text-slate-500">{pacienteNome}</p>
            </div>
            <Dialog.Close
              aria-label="Fechar"
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
            >
              <X size={18} strokeWidth={1.5} />
            </Dialog.Close>
          </div>

          <div className="mt-4 space-y-3">
            <div className="space-y-1">
              <label className="block text-[13px] font-medium text-slate-700">
                Motivo da alta *
              </label>
              <textarea
                rows={4}
                maxLength={1000}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex: Tratamento concluido com sucesso, paciente sem queixas."
                className="w-full resize-y rounded border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
              />
            </div>

            {aviso !== null ? (
              <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Este paciente tem {aviso}{" "}
                {aviso === 1 ? "agendamento futuro" : "agendamentos futuros"}.
                Verifique se precisa cancelar.
              </p>
            ) : null}

            {erro ? (
              <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {erro}
              </p>
            ) : null}
          </div>

          <div className="mt-4 flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:justify-end shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="rounded px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmar}
              disabled={salvando}
              className="rounded bg-[#16A34A] px-4 py-2 text-sm font-medium text-white hover:bg-[#15803D] disabled:opacity-50 transition-colors"
            >
              {salvando ? "Confirmando..." : "Confirmar alta"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default AltaPacienteSection;
