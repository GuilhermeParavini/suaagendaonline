"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type TipoToast = "success" | "error" | "warning" | "info";

export interface AcaoToast {
  label: string;
  /** Disparado quando o usuario clica no botao de acao (ex: "Desfazer"). */
  onClick: () => void;
}

export interface Toast {
  id: string;
  tipo: TipoToast;
  mensagem: string;
  acao?: AcaoToast;
  /** Tempo de exibicao em ms. Default 5000; com acao usa 8000. */
  duracao: number;
  criadoEm: number;
}

type EntradaToast = {
  tipo?: TipoToast;
  acao?: AcaoToast;
  duracao?: number;
};

interface ToastContextValue {
  toasts: Toast[];
  remover: (id: string) => void;
  sucesso: (mensagem: string, opts?: EntradaToast) => string;
  erro: (mensagem: string, opts?: EntradaToast) => string;
  aviso: (mensagem: string, opts?: EntradaToast) => string;
  info: (mensagem: string, opts?: EntradaToast) => string;
  /** Versao crua para casos especiais. */
  exibir: (mensagem: string, opts?: EntradaToast) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_VISIBLE = 3;
const DEFAULT_DURATION = 5000;
const DEFAULT_DURATION_COM_ACAO = 8000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const remover = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const exibir = useCallback(
    (mensagem: string, opts?: EntradaToast & { tipo?: TipoToast }): string => {
      idRef.current += 1;
      const id = `toast-${Date.now()}-${idRef.current}`;
      const tipo = opts?.tipo ?? "info";
      const duracao =
        opts?.duracao ??
        (opts?.acao ? DEFAULT_DURATION_COM_ACAO : DEFAULT_DURATION);
      const novo: Toast = {
        id,
        tipo,
        mensagem,
        acao: opts?.acao,
        duracao,
        criadoEm: Date.now(),
      };
      // FIFO: mantem no maximo MAX_VISIBLE; descarta os mais antigos.
      setToasts((prev) => {
        const proximo = [...prev, novo];
        if (proximo.length <= MAX_VISIBLE) return proximo;
        return proximo.slice(proximo.length - MAX_VISIBLE);
      });
      return id;
    },
    [],
  );

  const sucesso = useCallback(
    (m: string, opts?: EntradaToast) => exibir(m, { ...opts, tipo: "success" }),
    [exibir],
  );
  const erro = useCallback(
    (m: string, opts?: EntradaToast) => exibir(m, { ...opts, tipo: "error" }),
    [exibir],
  );
  const aviso = useCallback(
    (m: string, opts?: EntradaToast) => exibir(m, { ...opts, tipo: "warning" }),
    [exibir],
  );
  const info = useCallback(
    (m: string, opts?: EntradaToast) => exibir(m, { ...opts, tipo: "info" }),
    [exibir],
  );

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, remover, sucesso, erro, aviso, info, exibir }),
    [toasts, remover, sucesso, erro, aviso, info, exibir],
  );

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fail-safe: em testes/SSR retornamos um stub que loga warning.
    if (typeof window !== "undefined") {
      console.warn(
        "[useToast] usado fora do ToastProvider — chamadas serao ignoradas.",
      );
    }
    const noop = () => "";
    return {
      toasts: [],
      remover: () => undefined,
      sucesso: noop,
      erro: noop,
      aviso: noop,
      info: noop,
      exibir: noop,
    };
  }
  return ctx;
}
