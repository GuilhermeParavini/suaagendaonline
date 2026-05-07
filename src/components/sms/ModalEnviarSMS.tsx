"use client";

import { useEffect, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { MessageSquare, X } from "lucide-react";
import { enviarSMSManual, getUsoSMSAtual } from "@/actions/sms";
import { useToast } from "@/contexts/ToastContext";
import { formatPhone } from "@/lib/masks";
import { cn } from "@/lib/utils";

interface ModalEnviarSMSProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paciente: {
    id: string;
    nome: string;
    telefone: string | null;
  };
  /** Mensagem inicial pre-preenchida (vinda de templates externos). */
  mensagemInicial?: string;
  /** Callback chamado apos envio bem-sucedido. */
  onEnviado?: () => void;
}

const TEMPLATES_RAPIDOS: Array<{ id: string; label: string; texto: string }> = [
  {
    id: "lembrete",
    label: "Lembrete",
    texto:
      "Lembrete: voce tem consulta marcada conosco. Confirme a presenca por favor!",
  },
  {
    id: "retorno",
    label: "Retorno",
    texto:
      "Faz tempo que nao nos vemos. Que tal agendar um retorno? Estamos a disposicao!",
  },
  {
    id: "confirmacao",
    label: "Confirmacao",
    texto:
      "Sua consulta esta confirmada. Chegue 5-10 minutos antes. Ate la!",
  },
];

const LIMITE_CHARS = 160;

function ModalEnviarSMS({
  open,
  onOpenChange,
  paciente,
  mensagemInicial,
  onEnviado,
}: ModalEnviarSMSProps) {
  const [mensagem, setMensagem] = useState(mensagemInicial ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [usoSMS, setUsoSMS] = useState<{
    usado: number;
    limite: number;
    disponivel: number;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  // Reseta estado e carrega uso atual ao abrir.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMensagem(mensagemInicial ?? "");
    setErro(null);
    let cancelado = false;
    (async () => {
      const r = await getUsoSMSAtual();
      if (cancelado) return;
      if (r.ok) {
        setUsoSMS({
          usado: r.data.usado,
          limite: r.data.limite,
          disponivel: r.data.disponivel,
        });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [open, mensagemInicial]);

  const charCount = mensagem.length;
  const acima = charCount > LIMITE_CHARS;
  const limiteExcedido = usoSMS ? usoSMS.disponivel <= 0 : false;
  const podeEnviar =
    !isPending && !acima && charCount > 0 && !limiteExcedido;

  const aplicarTemplate = (texto: string) => {
    setMensagem(texto);
    setErro(null);
  };

  const handleEnviar = () => {
    setErro(null);
    if (!paciente.telefone) {
      setErro("Paciente sem telefone cadastrado.");
      return;
    }
    if (charCount === 0) {
      setErro("Digite uma mensagem.");
      return;
    }
    if (acima) {
      setErro(`Mensagem acima de ${LIMITE_CHARS} caracteres.`);
      return;
    }
    startTransition(async () => {
      const r = await enviarSMSManual({
        pacienteId: paciente.id,
        mensagem,
      });
      if (!r.enviado) {
        const msg =
          r.motivo === "limite_excedido"
            ? "Limite de SMS atingido. Contrate um pacote nas configuracoes."
            : r.motivo === "telefone_invalido"
              ? "Telefone invalido."
              : `Falha ao enviar: ${r.motivo ?? "erro desconhecido"}`;
        setErro(msg);
        return;
      }
      toast.sucesso(`SMS enviado para ${paciente.nome}`);
      onOpenChange(false);
      onEnviado?.();
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
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
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare
                size={18}
                strokeWidth={1.5}
                aria-hidden="true"
                className="text-primary-text shrink-0"
              />
              <Dialog.Title className="text-base font-semibold text-slate-900">
                Enviar SMS
              </Dialog.Title>
            </div>
            <Dialog.Close
              aria-label="Fechar"
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
            >
              <X size={18} strokeWidth={1.5} />
            </Dialog.Close>
          </div>

          <div className="mt-4 flex-1 overflow-y-auto space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[12px] font-medium text-slate-500 uppercase tracking-wide">
                Para
              </p>
              <p className="mt-0.5 text-[14px] text-slate-900 truncate">
                {paciente.nome}
              </p>
              <p className="text-[12px] text-slate-500">
                {paciente.telefone
                  ? formatPhone(paciente.telefone)
                  : "Sem telefone"}
              </p>
            </div>

            {usoSMS && limiteExcedido ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                Limite de SMS atingido ({usoSMS.usado}/{usoSMS.limite}).
                Contrate um pacote nas configuracoes para continuar enviando.
              </p>
            ) : usoSMS && usoSMS.disponivel <= 5 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                Apenas {usoSMS.disponivel} SMS disponiveis este mes.
              </p>
            ) : null}

            <div className="space-y-1">
              <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">
                Templates rapidos
              </p>
              <div className="flex flex-wrap gap-2">
                {TEMPLATES_RAPIDOS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => aplicarTemplate(t.texto)}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[14px] font-medium text-slate-900">
                Mensagem
              </label>
              <textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={4}
                placeholder="Digite a mensagem do SMS..."
                className="w-full resize-y rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/10"
              />
              <div className="flex items-center justify-between">
                <p
                  className={cn(
                    "text-[11px]",
                    acima
                      ? "text-red-600 font-medium"
                      : charCount > 140
                        ? "text-amber-600"
                        : "text-slate-500",
                  )}
                  aria-live="polite"
                >
                  {charCount}/{LIMITE_CHARS}
                </p>
                {acima ? (
                  <p className="text-[11px] text-red-600">
                    Acima do limite — sera fragmentado em multiplos SMS
                  </p>
                ) : null}
              </div>
            </div>

            {erro ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                {erro}
              </p>
            ) : null}
          </div>

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end shrink-0">
            <Dialog.Close
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </Dialog.Close>
            <button
              type="button"
              onClick={handleEnviar}
              disabled={!podeEnviar}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <MessageSquare
                size={14}
                strokeWidth={1.5}
                aria-hidden="true"
              />
              {isPending ? "Enviando..." : "Enviar SMS"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default ModalEnviarSMS;
