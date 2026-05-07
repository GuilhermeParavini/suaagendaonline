"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Info,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useToast, type Toast as ToastModel, type TipoToast } from "@/contexts/ToastContext";
import { cn } from "@/lib/utils";

const ICONES: Record<TipoToast, LucideIcon> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const ESTILO_BORDA: Record<TipoToast, string> = {
  success: "border-l-[#22C55E]",
  error: "border-l-danger",
  warning: "border-l-[#F59E0B]",
  info: "border-l-primary",
};

const ESTILO_ICONE: Record<TipoToast, string> = {
  success: "text-[#22C55E]",
  error: "text-danger",
  warning: "text-[#F59E0B]",
  info: "text-primary-text",
};

function Toaster() {
  const { toasts } = useToast();

  return (
    <ol
      role="region"
      aria-label="Notificacoes"
      className={cn(
        "fixed z-[70] flex w-full max-w-[440px] flex-col gap-2 px-4 sm:px-0 pointer-events-none",
        // Mobile: bottom-center; Desktop: bottom-right
        "bottom-[calc(56px+env(safe-area-inset-bottom)+16px)] left-1/2 -translate-x-1/2",
        "lg:bottom-6 lg:right-6 lg:left-auto lg:translate-x-0",
      )}
    >
      {toasts.map((t) => (
        <li key={t.id} className="pointer-events-auto">
          <ItemToast toast={t} />
        </li>
      ))}
    </ol>
  );
}

function ItemToast({ toast }: { toast: ToastModel }) {
  const { remover } = useToast();
  const [saindo, setSaindo] = useState(false);
  const [progresso, setProgresso] = useState(100);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const Icon = ICONES[toast.tipo];

  useEffect(() => {
    const inicio = Date.now();

    const tick = () => {
      const decorrido = Date.now() - inicio;
      const restante = Math.max(0, 1 - decorrido / toast.duracao);
      setProgresso(restante * 100);
      if (restante > 0) {
        animFrameRef.current = window.requestAnimationFrame(tick);
      }
    };
    animFrameRef.current = window.requestAnimationFrame(tick);

    dismissTimerRef.current = setTimeout(() => {
      setSaindo(true);
    }, toast.duracao);

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [toast.duracao]);

  // Apos a animacao de saida, remove do array.
  useEffect(() => {
    if (!saindo) return;
    const id = setTimeout(() => remover(toast.id), 220);
    return () => clearTimeout(id);
  }, [saindo, remover, toast.id]);

  const handleAcao = () => {
    if (toast.acao) {
      toast.acao.onClick();
    }
    setSaindo(true);
  };

  const handleFechar = () => setSaindo(true);

  return (
    <div
      role="alert"
      aria-live={toast.tipo === "error" ? "assertive" : "polite"}
      className={cn(
        "relative overflow-hidden rounded-lg bg-white shadow-lg border border-slate-200 border-l-4 w-full",
        ESTILO_BORDA[toast.tipo],
        "transition-all duration-200",
        saindo
          ? "opacity-0 translate-y-2"
          : "opacity-100 translate-y-0 animate-[sao-toast-in_220ms_ease-out]",
      )}
    >
      <style>{`
        @keyframes sao-toast-in {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="flex items-start gap-3 px-4 py-3">
        <Icon
          size={18}
          strokeWidth={1.5}
          aria-hidden="true"
          className={cn("mt-0.5 shrink-0", ESTILO_ICONE[toast.tipo])}
        />
        <p className="min-w-0 flex-1 text-[14px] text-slate-900 leading-snug">
          {toast.mensagem}
        </p>
        {toast.acao ? (
          <button
            type="button"
            onClick={handleAcao}
            className="shrink-0 rounded px-2 py-1 text-[13px] font-semibold text-primary-text hover:bg-primary-surface no-touch-min"
          >
            {toast.acao.label}
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleFechar}
          aria-label="Fechar notificacao"
          className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 no-touch-min"
        >
          <X size={14} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      {/* Barra de progresso */}
      <div
        className="absolute bottom-0 left-0 h-0.5 bg-slate-200/60"
        style={{ width: `${progresso}%` }}
        aria-hidden="true"
      />
    </div>
  );
}

export default Toaster;
