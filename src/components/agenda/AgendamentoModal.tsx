"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Check } from "lucide-react";
import {
  atualizarStatusAgendamento,
  type AgendamentoDia,
  type StatusAgendamento,
} from "@/actions/agendamentos";
import StatusPill from "@/components/ui/StatusPill";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface AgendamentoModalProps {
  agendamento: AgendamentoDia | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (id: string, novoStatus: StatusAgendamento) => void;
}

type AcaoStatus = {
  status: Exclude<StatusAgendamento, "agendado">;
  label: string;
  toast: string;
  className: string;
};

const ESTADOS_FINAIS: StatusAgendamento[] = ["concluido", "faltou", "cancelado"];
const TOAST_DURATION_MS = 2000;
const FECHAMENTO_FINAL_MS = 1000;

const ACOES_POR_STATUS: Record<StatusAgendamento, AcaoStatus[]> = {
  agendado: [
    {
      status: "confirmado",
      label: "Confirmar presença",
      toast: "Presença confirmada",
      className: "bg-primary text-white hover:bg-primary-dark border-transparent",
    },
  ],
  confirmado: [
    {
      status: "em_atendimento",
      label: "Iniciar atendimento",
      toast: "Atendimento iniciado",
      className:
        "bg-[#F59E0B] text-white hover:bg-[#D97706] border-transparent",
    },
  ],
  em_atendimento: [
    {
      status: "concluido",
      label: "Concluir atendimento",
      toast: "Atendimento concluido",
      className:
        "bg-[#22C55E] text-white hover:bg-[#16A34A] border-transparent",
    },
    {
      status: "faltou",
      label: "Registrar falta",
      toast: "Falta registrada",
      className: "bg-[#EF4444] text-white hover:bg-[#DC2626] border-transparent",
    },
  ],
  concluido: [],
  faltou: [],
  cancelado: [],
};

const PODE_CANCELAR: StatusAgendamento[] = ["agendado", "confirmado"];

function AgendamentoModal({
  agendamento,
  open,
  onOpenChange,
  onUpdated,
}: AgendamentoModalProps) {
  const router = useRouter();
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const limparTimers = () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      limparTimers();
    };
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      limparTimers();
      setConfirmandoCancelamento(false);
      setMotivo("");
      setErro(null);
      setToast(null);
    }
    onOpenChange(next);
  };

  if (!agendamento) return null;

  const dt = new Date(agendamento.data_hora);
  const horario = dt.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

  const nomePaciente = agendamento.paciente?.nome ?? "Paciente";
  const nomeProcedimento = agendamento.procedimento?.nome ?? null;
  const acoes = ACOES_POR_STATUS[agendamento.status] ?? [];
  const podeCancelar = PODE_CANCELAR.includes(agendamento.status);
  const ehFinal = acoes.length === 0 && !podeCancelar;

  const aplicarStatus = (
    novoStatus: StatusAgendamento,
    mensagemToast: string,
    motivoTexto?: string,
  ) => {
    setErro(null);
    startTransition(async () => {
      const result = await atualizarStatusAgendamento(
        agendamento.id,
        novoStatus,
        motivoTexto,
      );
      if (!result.ok) {
        setErro(result.error);
        return;
      }

      onUpdated(agendamento.id, novoStatus);
      limparTimers();
      setConfirmandoCancelamento(false);
      setMotivo("");
      setToast(mensagemToast);

      if (novoStatus === "em_atendimento") {
        handleOpenChange(false);
        router.push(`/atendimento/${agendamento.id}`);
        return;
      }

      const ehFinalAgora = ESTADOS_FINAIS.includes(novoStatus);
      if (ehFinalAgora) {
        closeTimerRef.current = setTimeout(() => {
          handleOpenChange(false);
        }, FECHAMENTO_FINAL_MS);
      } else {
        toastTimerRef.current = setTimeout(() => {
          setToast(null);
        }, TOAST_DURATION_MS);
      }
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed z-50 bg-white shadow-lg focus:outline-none",
            // Mobile: bottom sheet
            "inset-x-0 bottom-0 rounded-t-2xl px-4 pt-5 pb-[max(env(safe-area-inset-bottom),16px)]",
            // Desktop: centered modal
            "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[400px] md:max-w-[calc(100vw-32px)] md:rounded-2xl md:p-6 md:pb-6",
          )}
        >
          {/* Drag handle (mobile only) */}
          <div className="md:hidden mx-auto mb-4 h-1 w-10 rounded-full bg-slate-300" />

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-semibold text-slate-900 truncate">
                {nomePaciente}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-slate-500">
                {horario} - {agendamento.duracao_min} min
                {nomeProcedimento ? ` - ${nomeProcedimento}` : ""}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Fechar"
              className="rounded p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <X size={18} strokeWidth={1.5} />
            </Dialog.Close>
          </div>

          {toast ? (
            <div
              role="status"
              aria-live="polite"
              className="mt-4 flex items-center gap-2 rounded border border-[#CCFBF1] bg-[#F0FDFA] px-3 py-2 text-xs font-medium text-[#115E59]"
            >
              <Check size={14} strokeWidth={2} aria-hidden="true" />
              <span>{toast}</span>
            </div>
          ) : null}

          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-slate-500">Status atual:</span>
            <StatusPill status={agendamento.status} />
          </div>

          {erro ? (
            <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {erro}
            </p>
          ) : null}

          {ehFinal ? (
            <p className="mt-5 text-sm text-slate-500">
              Este agendamento está em estado final.
            </p>
          ) : confirmandoCancelamento ? (
            <div className="mt-5 space-y-3">
              <p className="text-sm text-slate-700">
                Deseja cancelar este agendamento?
              </p>
              <div className="space-y-1">
                <label
                  htmlFor="motivo-cancelamento"
                  className="block text-[13px] font-medium text-slate-700"
                >
                  Motivo (opcional)
                </label>
                <textarea
                  id="motivo-cancelamento"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Ex.: paciente solicitou remarcar"
                  className="w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  variant="destructive"
                  disabled={isPending}
                  onClick={() =>
                    aplicarStatus("cancelado", "Agendamento cancelado", motivo)
                  }
                  className="w-full"
                >
                  {isPending ? "Cancelando..." : "Cancelar agendamento"}
                </Button>
                <Button
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => {
                    setConfirmandoCancelamento(false);
                    setMotivo("");
                  }}
                  className="w-full"
                >
                  Voltar
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-2">
              {acoes.map((acao) => (
                <button
                  key={acao.status}
                  type="button"
                  disabled={isPending}
                  onClick={() => aplicarStatus(acao.status, acao.toast)}
                  className={cn(
                    "inline-flex w-full items-center justify-center rounded border px-5 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
                    acao.className,
                  )}
                >
                  {isPending ? "Salvando..." : acao.label}
                </button>
              ))}
              {podeCancelar ? (
                <Button
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => setConfirmandoCancelamento(true)}
                  className="w-full"
                >
                  Cancelar agendamento
                </Button>
              ) : null}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default AgendamentoModal;
