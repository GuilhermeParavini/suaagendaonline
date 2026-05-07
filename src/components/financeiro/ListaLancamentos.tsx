"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Check, Clock, FileText, Trash2, Wallet } from "lucide-react";
import {
  atualizarPago,
  excluirLancamento,
  type FormaPagamento,
  type Lancamento,
} from "@/actions/financeiro";
import { formatCurrency } from "@/lib/masks";
import { cn } from "@/lib/utils";
import EmptyState from "@/components/ui/EmptyState";

interface ListaLancamentosProps {
  lancamentos: Lancamento[];
  onChanged: () => void;
}

const formaLabels: Record<FormaPagamento, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  convenio: "Convênio",
  transferencia: "Transferência",
  outro: "Outro",
};

function ddmm(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}`;
}

function ListaLancamentos({ lancamentos, onChanged }: ListaLancamentosProps) {
  const [isPending, startTransition] = useTransition();

  if (lancamentos.length === 0) {
    return (
      <EmptyState
        Icon={Wallet}
        titulo="Sem lancamentos financeiros"
        descricao="Registre receitas e despesas para acompanhar suas financas."
      />
    );
  }

  const handleTogglePago = (id: string, novoPago: boolean) => {
    startTransition(async () => {
      const result = await atualizarPago(id, novoPago);
      if (result.ok) onChanged();
    });
  };

  const handleExcluir = (id: string) => {
    if (!window.confirm("Deseja excluir este lançamento?")) return;
    startTransition(async () => {
      const result = await excluirLancamento(id);
      if (result.ok) onChanged();
    });
  };

  return (
    <ul
      className={cn(
        "divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white",
        isPending && "opacity-60",
      )}
    >
      {lancamentos.map((l) => {
        const ehReceita = l.tipo === "receita";
        const valorFormatado = formatCurrency(l.valor);
        const valorTexto = ehReceita
          ? valorFormatado
          : `- ${valorFormatado}`;
        const titulo = l.paciente?.nome ?? l.descricao;
        const subtitulo = l.paciente ? l.descricao : l.categoria ?? null;
        const valorComissao = Number(l.valor_comissao) || 0;
        const percentualComissao = Number(l.percentual_comissao) || 0;
        const valorLiquido = ehReceita ? l.valor - valorComissao : 0;
        const mostrarComissao = ehReceita && l.comissao_aplicavel && valorComissao > 0;

        return (
          <li key={l.id} className="px-3 py-3 sm:px-4">
            <div className="flex items-start gap-3">
              <div className="w-10 shrink-0 text-center">
                <span className="text-[11px] font-medium text-slate-500">
                  {ddmm(l.data_lancamento)}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {titulo}
                </p>
                {subtitulo ? (
                  <p className="text-xs text-slate-500 truncate">{subtitulo}</p>
                ) : null}
                {!ehReceita && l.fornecedor ? (
                  <p className="text-xs text-slate-500 truncate">
                    {l.fornecedor}
                  </p>
                ) : null}
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {l.forma_pagamento ? (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-[2px] text-[11px] font-medium text-slate-700">
                      {formaLabels[l.forma_pagamento]}
                    </span>
                  ) : null}
                  {!ehReceita && l.categoria_despesa ? (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-[2px] text-[11px] font-medium text-slate-600">
                      {l.categoria_despesa}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleTogglePago(l.id, !l.pago)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[11px] font-medium transition-colors disabled:opacity-50",
                      l.pago
                        ? "bg-[#D1FAE5] text-[#065F46] hover:bg-[#A7F3D0]"
                        : "bg-[#FEF3C7] text-[#92400E] hover:bg-[#FDE68A]",
                    )}
                    aria-label={
                      l.pago ? "Marcar como pendente" : "Marcar como pago"
                    }
                  >
                    {l.pago ? (
                      <Check size={11} strokeWidth={2} aria-hidden="true" />
                    ) : (
                      <Clock size={11} strokeWidth={2} aria-hidden="true" />
                    )}
                    {l.pago ? "Pago" : "Pendente"}
                  </button>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                <span
                  className={cn(
                    "text-sm font-semibold",
                    ehReceita ? "text-[#065F46]" : "text-[#991B1B]",
                  )}
                >
                  {valorTexto}
                </span>
                {mostrarComissao ? (
                  <>
                    <span className="text-[11px] text-slate-500">
                      Comissao: {formatCurrency(valorComissao)}
                      {percentualComissao > 0
                        ? ` (${String(percentualComissao).replace(".", ",")}%)`
                        : ""}
                    </span>
                    <span className="text-[11px] font-semibold text-primary-dark">
                      Liquido: {formatCurrency(valorLiquido)}
                    </span>
                  </>
                ) : null}
                <div className="flex items-center gap-1">
                  {ehReceita && l.pago ? (
                    <Link
                      href={`/financeiro/recibo/${l.id}`}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                      aria-label="Emitir recibo"
                    >
                      <FileText size={12} strokeWidth={1.5} aria-hidden="true" />
                      Recibo
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleExcluir(l.id)}
                    disabled={isPending}
                    aria-label="Excluir lançamento"
                    className="inline-flex items-center justify-center rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default ListaLancamentos;
