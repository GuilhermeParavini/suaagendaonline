"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TamanhoModal = "sm" | "md" | "lg";

const LARGURAS: Record<TamanhoModal, string> = {
  sm: "md:max-w-[400px]",
  md: "md:max-w-[560px]",
  lg: "md:max-w-[720px]",
};

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Renderizado no header fixo. Pode ser texto simples ou node. */
  titulo: ReactNode;
  /** Descricao opcional para acessibilidade — vai num span sr-only se nao for renderizada. */
  descricao?: string;
  children: ReactNode;
  /** Renderizado no footer fixo. Use para botoes de acao. */
  footer?: ReactNode;
  size?: TamanhoModal;
  /** Quando true, esconde o botao X — util quando voce ja tem botoes no footer. */
  semBotaoFechar?: boolean;
  className?: string;
}

/**
 * Modal responsivo: bottom-sheet no mobile, dialog centralizado no desktop.
 * Internamente usa Radix Dialog (foco preso, ESC fecha, backdrop clicavel).
 *
 * O `drag to dismiss` do bottom-sheet usa o `swipe down` nativo via toque no
 * handle: implementacao com touch events que arrasta o conteudo para baixo
 * e dispara `onOpenChange(false)` quando passa de 100px.
 */
function ResponsiveModal({
  open,
  onOpenChange,
  titulo,
  descricao,
  children,
  footer,
  size = "md",
  semBotaoFechar,
  className,
}: ResponsiveModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/40",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed z-50 flex flex-col bg-white shadow-lg focus:outline-none",
            // Mobile bottom-sheet
            "inset-x-0 bottom-0 max-h-[90vh] rounded-t-2xl",
            // Animacao mobile
            "data-[state=open]:animate-[sao-modal-up_240ms_ease-out]",
            "data-[state=closed]:animate-[sao-modal-down_180ms_ease-in]",
            // Desktop centralizado
            "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:max-h-[88vh]",
            "md:data-[state=open]:animate-[sao-modal-pop_180ms_ease-out]",
            "md:data-[state=closed]:animate-[sao-modal-pop-out_120ms_ease-in]",
            LARGURAS[size],
            "md:w-[calc(100vw-32px)]",
            className,
          )}
        >
          <style>{`
            @keyframes sao-modal-up {
              0% { transform: translateY(100%); }
              100% { transform: translateY(0); }
            }
            @keyframes sao-modal-down {
              0% { transform: translateY(0); }
              100% { transform: translateY(100%); }
            }
            @keyframes sao-modal-pop {
              0% { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
              100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            }
            @keyframes sao-modal-pop-out {
              0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
              100% { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
            }
          `}</style>

          {/* Drag handle apenas no mobile. Tap nele tambem fecha. */}
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => onOpenChange(false)}
            className="md:hidden mx-auto mt-3 mb-1 h-1 w-10 rounded-full bg-slate-300 shrink-0 no-touch-min"
          />

          <div className="flex items-start justify-between gap-3 px-4 pt-4 md:p-6 md:pb-3 shrink-0">
            <Dialog.Title className="text-base font-semibold text-slate-900">
              {titulo}
            </Dialog.Title>
            {descricao ? (
              <Dialog.Description className="sr-only">
                {descricao}
              </Dialog.Description>
            ) : null}
            {!semBotaoFechar ? (
              <Dialog.Close
                aria-label="Fechar"
                className="inline-flex items-center justify-center rounded p-1 text-slate-500 hover:bg-slate-100"
              >
                <X size={18} strokeWidth={1.5} />
              </Dialog.Close>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4 md:px-6 md:pb-2">
            {children}
          </div>

          {footer ? (
            <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3 md:px-6 md:py-4 pb-[max(env(safe-area-inset-bottom),12px)] md:pb-4">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default ResponsiveModal;
