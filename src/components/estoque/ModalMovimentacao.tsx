"use client";

import { useEffect, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  History,
  Settings2,
  X,
} from "lucide-react";
import {
  getMovimentacoes,
  registrarMovimentacao,
  type MovimentacaoEstoque,
  type ProdutoEstoque,
  type TipoMovimentacao,
} from "@/actions/estoque";
import { cn } from "@/lib/utils";

interface ModalMovimentacaoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMoved: () => void;
  produto: ProdutoEstoque | null;
  tipoInicial?: TipoMovimentacao;
}

const TIPO_LABEL: Record<TipoMovimentacao, string> = {
  entrada: "Entrada",
  saida: "Saida",
  ajuste: "Ajuste",
};

function fmtQtd(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
}

function fmtDateHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function ModalMovimentacao({
  open,
  onOpenChange,
  onMoved,
  produto,
  tipoInicial = "entrada",
}: ModalMovimentacaoProps) {
  const [tipo, setTipo] = useState<TipoMovimentacao>(tipoInicial);
  const [quantidade, setQuantidade] = useState("");
  const [motivo, setMotivo] = useState("");
  const [aba, setAba] = useState<"nova" | "historico">("nova");
  const [historico, setHistorico] = useState<MovimentacaoEstoque[]>([]);
  const [carregandoHist, setCarregandoHist] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setTipo(tipoInicial);
    setQuantidade("");
    setMotivo("");
    setAba("nova");
    setError(null);
  }, [open, tipoInicial]);

  useEffect(() => {
    if (!open || !produto || aba !== "historico") return;
    let cancelado = false;
    setCarregandoHist(true);
    (async () => {
      const r = await getMovimentacoes(produto.id, { limite: 50 });
      if (cancelado) return;
      setCarregandoHist(false);
      if (r.ok) setHistorico(r.data);
    })();
    return () => {
      cancelado = true;
    };
  }, [open, produto, aba]);

  if (!produto) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const qtd = Number(quantidade.replace(",", "."));
    if (!Number.isFinite(qtd) || qtd < 0) {
      setError("Quantidade invalida.");
      return;
    }
    if (tipo !== "ajuste" && qtd <= 0) {
      setError("Quantidade deve ser maior que zero.");
      return;
    }
    startTransition(async () => {
      const result = await registrarMovimentacao({
        produtoId: produto.id,
        tipo,
        quantidade: qtd,
        motivo: motivo.trim() || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onMoved();
      onOpenChange(false);
    });
  };

  const previa = (() => {
    const qtd = Number(quantidade.replace(",", "."));
    if (!Number.isFinite(qtd)) return null;
    const atual = produto.quantidade;
    if (tipo === "entrada") return atual + qtd;
    if (tipo === "saida") return atual - qtd;
    return qtd; // ajuste
  })();

  const previaInvalida =
    previa !== null && tipo === "saida" && previa < 0;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className={cn(
            "fixed z-50 bg-white shadow-lg focus:outline-none flex flex-col",
            "inset-x-0 bottom-0 max-h-[92vh] rounded-t-2xl px-4 pt-5 pb-[max(env(safe-area-inset-bottom),16px)]",
            "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[480px] md:max-w-[calc(100vw-32px)] md:max-h-[90vh] md:rounded-2xl md:p-6",
          )}
        >
          <div className="md:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 shrink-0" />

          <div className="flex items-start justify-between gap-3 shrink-0">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold text-slate-900 truncate">
                {produto.nome}
              </Dialog.Title>
              <p className="text-xs text-slate-500">
                Atual: {fmtQtd(produto.quantidade)} {produto.unidade}
                {" - "}
                Minimo: {fmtQtd(produto.quantidade_minima)}
              </p>
            </div>
            <Dialog.Close
              aria-label="Fechar"
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
            >
              <X size={18} strokeWidth={1.5} />
            </Dialog.Close>
          </div>

          <div className="mt-3 inline-flex w-full rounded-lg border border-slate-200 bg-white p-1 shrink-0">
            <button
              type="button"
              onClick={() => setAba("nova")}
              className={cn(
                "flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors",
                aba === "nova"
                  ? "bg-primary-surface text-primary-dark"
                  : "text-slate-500 hover:text-slate-900",
              )}
            >
              Nova movimentacao
            </button>
            <button
              type="button"
              onClick={() => setAba("historico")}
              className={cn(
                "flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors",
                aba === "historico"
                  ? "bg-primary-surface text-primary-dark"
                  : "text-slate-500 hover:text-slate-900",
              )}
            >
              Historico
            </button>
          </div>

          {aba === "nova" ? (
            <form
              onSubmit={handleSubmit}
              className="mt-4 flex-1 overflow-y-auto space-y-4"
            >
              <div className="grid grid-cols-3 gap-2 rounded border border-slate-200 p-1">
                <TipoButton
                  current={tipo}
                  value="entrada"
                  onChange={setTipo}
                  Icon={ArrowUpCircle}
                  label="Entrada"
                  activeClass="bg-[#D1FAE5] text-[#065F46]"
                />
                <TipoButton
                  current={tipo}
                  value="saida"
                  onChange={setTipo}
                  Icon={ArrowDownCircle}
                  label="Saida"
                  activeClass="bg-[#FEE2E2] text-[#991B1B]"
                />
                <TipoButton
                  current={tipo}
                  value="ajuste"
                  onChange={setTipo}
                  Icon={Settings2}
                  label="Ajuste"
                  activeClass="bg-[#DBEAFE] text-[#1E40AF]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[13px] font-medium text-slate-700">
                  {tipo === "ajuste" ? "Nova quantidade *" : "Quantidade *"}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  placeholder="0"
                  className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                />
                {previa !== null && quantidade ? (
                  <p
                    className={cn(
                      "text-[11px]",
                      previaInvalida ? "text-danger" : "text-slate-500",
                    )}
                  >
                    Apos a movimentacao: {fmtQtd(previa)} {produto.unidade}
                    {previaInvalida ? " (estoque insuficiente)" : ""}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1">
                <label className="block text-[13px] font-medium text-slate-700">
                  Motivo
                </label>
                <input
                  type="text"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder={
                    tipo === "entrada"
                      ? "Ex.: Compra do fornecedor X"
                      : tipo === "saida"
                        ? "Ex.: Uso em atendimento"
                        : "Ex.: Correcao de inventario"
                  }
                  maxLength={200}
                  className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                />
              </div>

              {error ? (
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </p>
              ) : null}

              <div className="pt-1 sticky bottom-0 bg-white">
                <button
                  type="submit"
                  disabled={isPending || previaInvalida}
                  className="w-full rounded bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isPending
                    ? "Salvando..."
                    : `Registrar ${TIPO_LABEL[tipo].toLowerCase()}`}
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-4 flex-1 overflow-y-auto">
              {carregandoHist ? (
                <p className="text-sm text-slate-500">Carregando...</p>
              ) : historico.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <History
                    size={28}
                    strokeWidth={1.5}
                    className="text-slate-300"
                  />
                  <p className="text-sm text-slate-500">
                    Sem movimentacoes registradas.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                  {historico.map((m) => {
                    const sinal =
                      m.tipo === "entrada"
                        ? "+"
                        : m.tipo === "saida"
                          ? "-"
                          : "=";
                    const cor =
                      m.tipo === "entrada"
                        ? "text-[#065F46]"
                        : m.tipo === "saida"
                          ? "text-[#991B1B]"
                          : "text-[#1E40AF]";
                    return (
                      <li key={m.id} className="px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900">
                              {TIPO_LABEL[m.tipo]}
                            </p>
                            {m.motivo ? (
                              <p className="text-xs text-slate-500 truncate">
                                {m.motivo}
                              </p>
                            ) : null}
                            <p className="text-[11px] text-slate-400">
                              {fmtDateHora(m.created_at)}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={cn("text-sm font-semibold", cor)}>
                              {sinal} {fmtQtd(m.quantidade)}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {fmtQtd(m.quantidade_anterior)} {"->"}{" "}
                              {fmtQtd(m.quantidade_posterior)}
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface TipoButtonProps {
  current: TipoMovimentacao;
  value: TipoMovimentacao;
  onChange: (v: TipoMovimentacao) => void;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  activeClass: string;
}

function TipoButton({
  current,
  value,
  onChange,
  Icon,
  label,
  activeClass,
}: TipoButtonProps) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={cn(
        "flex flex-col items-center gap-1 rounded px-2 py-2 text-xs font-medium transition-colors",
        active ? activeClass : "text-slate-500 hover:bg-slate-50",
      )}
    >
      <Icon size={18} strokeWidth={1.5} />
      {label}
    </button>
  );
}

export default ModalMovimentacao;
