"use client";

import { useState, useTransition, useCallback } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Filter, Plus } from "lucide-react";
import {
  getLancamentos,
  getResumoFinanceiro,
  type FinanceiroTipo,
  type FormaPagamento,
  type Lancamento,
  type LancamentosFiltros,
  type PacienteOption,
  type ResumoFinanceiro,
} from "@/actions/financeiro";
import MetricCard from "@/components/ui/MetricCard";
import { formatCurrency } from "@/lib/masks";
import { cn } from "@/lib/utils";
import ListaLancamentos from "./ListaLancamentos";
import FormLancamento from "./FormLancamento";

interface FinanceiroClientProps {
  initialMes: number;
  initialAno: number;
  initialResumo: ResumoFinanceiro;
  initialLancamentos: Lancamento[];
  pacientes: PacienteOption[];
}

const MESES = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const formaPagamentoOptions: { value: FormaPagamento | "todos"; label: string }[] = [
  { value: "todos", label: "Todas" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "cartao_credito", label: "Cartao Credito" },
  { value: "cartao_debito", label: "Cartao Debito" },
  { value: "convenio", label: "Convenio" },
  { value: "transferencia", label: "Transferencia" },
  { value: "outro", label: "Outro" },
];

function FinanceiroClient({
  initialMes,
  initialAno,
  initialResumo,
  initialLancamentos,
  pacientes,
}: FinanceiroClientProps) {
  const [mes, setMes] = useState(initialMes);
  const [ano, setAno] = useState(initialAno);
  const [tipo, setTipo] = useState<FinanceiroTipo>("receita");
  const [formaPagamento, setFormaPagamento] = useState<
    FormaPagamento | "todos"
  >("todos");
  const [statusPago, setStatusPago] = useState<"todos" | "pago" | "pendente">(
    "todos",
  );
  const [resumo, setResumo] = useState<ResumoFinanceiro>(initialResumo);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>(
    initialLancamentos,
  );
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const recarregar = useCallback(
    (
      filtros: Pick<LancamentosFiltros, "mes" | "ano"> & {
        tipo: FinanceiroTipo;
        forma_pagamento: FormaPagamento | "todos";
        status: "todos" | "pago" | "pendente";
      },
    ) => {
      setError(null);
      startTransition(async () => {
        const [resumoRes, listaRes] = await Promise.all([
          getResumoFinanceiro(filtros.mes, filtros.ano),
          getLancamentos({
            mes: filtros.mes,
            ano: filtros.ano,
            tipo: filtros.tipo,
            forma_pagamento: filtros.forma_pagamento,
            status: filtros.status,
          }),
        ]);
        if (!resumoRes.ok) {
          setError(resumoRes.error);
          return;
        }
        if (!listaRes.ok) {
          setError(listaRes.error);
          return;
        }
        setResumo(resumoRes.data);
        setLancamentos(listaRes.data);
      });
    },
    [],
  );

  const handleTipoChange = (next: string) => {
    if (next !== "receita" && next !== "despesa") return;
    const novo = next as FinanceiroTipo;
    setTipo(novo);
    recarregar({
      mes,
      ano,
      tipo: novo,
      forma_pagamento: formaPagamento,
      status: statusPago,
    });
  };

  const handleMesChange = (novoMes: number) => {
    setMes(novoMes);
    recarregar({
      mes: novoMes,
      ano,
      tipo,
      forma_pagamento: formaPagamento,
      status: statusPago,
    });
  };

  const handleAnoChange = (novoAno: number) => {
    setAno(novoAno);
    recarregar({
      mes,
      ano: novoAno,
      tipo,
      forma_pagamento: formaPagamento,
      status: statusPago,
    });
  };

  const handleFormaChange = (nova: FormaPagamento | "todos") => {
    setFormaPagamento(nova);
    recarregar({
      mes,
      ano,
      tipo,
      forma_pagamento: nova,
      status: statusPago,
    });
  };

  const handleStatusChange = (novo: "todos" | "pago" | "pendente") => {
    setStatusPago(novo);
    recarregar({
      mes,
      ano,
      tipo,
      forma_pagamento: formaPagamento,
      status: novo,
    });
  };

  const handleAtualizado = () => {
    recarregar({
      mes,
      ano,
      tipo,
      forma_pagamento: formaPagamento,
      status: statusPago,
    });
  };

  const saldoColor =
    resumo.saldo >= 0 ? "text-primary" : "text-danger";

  const anos = Array.from({ length: 5 }, (_, i) => ano - 2 + i);

  return (
    <div className="space-y-5 relative pb-20">
      <header className="space-y-1">
        <h1 className="text-[22px] font-semibold text-slate-900 leading-tight">
          Financeiro
        </h1>
        <p className="text-sm text-slate-500">
          {MESES[mes - 1]} de {ano}
        </p>
      </header>

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <MetricCard
          label="Receita do mes"
          value={
            <span className="text-[#16A34A]">
              {formatCurrency(resumo.receita)}
            </span>
          }
        />
        <MetricCard
          label="Despesas"
          value={
            <span className="text-danger">{formatCurrency(resumo.despesa)}</span>
          }
        />
        <MetricCard
          label="Saldo"
          value={
            <span className={saldoColor}>{formatCurrency(resumo.saldo)}</span>
          }
        />
      </div>

      <div className="flex items-center gap-2">
        <Tabs.Root value={tipo} onValueChange={handleTipoChange} className="flex-1">
          <Tabs.List
            className="inline-flex w-full rounded-lg border border-slate-200 bg-white p-1"
            aria-label="Tipo de lancamento"
          >
            <Tabs.Trigger
              value="receita"
              className={cn(
                "flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors",
                "data-[state=active]:bg-primary-surface data-[state=active]:text-primary-dark",
                "text-slate-500 hover:text-slate-900",
              )}
            >
              Receitas
            </Tabs.Trigger>
            <Tabs.Trigger
              value="despesa"
              className={cn(
                "flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors",
                "data-[state=active]:bg-[#FEE2E2] data-[state=active]:text-[#991B1B]",
                "text-slate-500 hover:text-slate-900",
              )}
            >
              Despesas
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>

        <button
          type="button"
          onClick={() => setFiltrosAbertos((v) => !v)}
          aria-expanded={filtrosAbertos}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors",
            filtrosAbertos && "border-primary text-primary-dark bg-primary-surface",
          )}
        >
          <Filter size={14} strokeWidth={1.5} aria-hidden="true" />
          Filtros
        </button>
      </div>

      {filtrosAbertos ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="block text-[13px] font-medium text-slate-700">
              Mes
            </label>
            <select
              value={mes}
              onChange={(e) => handleMesChange(Number(e.target.value))}
              className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {MESES.map((nome, i) => (
                <option key={i} value={i + 1}>
                  {nome}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[13px] font-medium text-slate-700">
              Ano
            </label>
            <select
              value={ano}
              onChange={(e) => handleAnoChange(Number(e.target.value))}
              className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {anos.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[13px] font-medium text-slate-700">
              Forma de pagamento
            </label>
            <select
              value={formaPagamento}
              onChange={(e) =>
                handleFormaChange(e.target.value as FormaPagamento | "todos")
              }
              className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {formaPagamentoOptions.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[13px] font-medium text-slate-700">
              Status
            </label>
            <select
              value={statusPago}
              onChange={(e) =>
                handleStatusChange(
                  e.target.value as "todos" | "pago" | "pendente",
                )
              }
              className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="todos">Todos</option>
              <option value="pago">Pago</option>
              <option value="pendente">Pendente</option>
            </select>
          </div>
        </div>
      ) : null}

      <section
        aria-busy={isPending}
        aria-live="polite"
        className={isPending ? "opacity-60 transition-opacity" : "transition-opacity"}
      >
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : (
          <ListaLancamentos
            lancamentos={lancamentos}
            onChanged={handleAtualizado}
          />
        )}
      </section>

      <FormLancamento
        open={modalAberto}
        onOpenChange={setModalAberto}
        onCreated={handleAtualizado}
        pacientes={pacientes}
      />

      <button
        type="button"
        aria-label="Novo lancamento"
        onClick={() => setModalAberto(true)}
        className="fixed right-4 bottom-[calc(56px+env(safe-area-inset-bottom)+16px)] lg:bottom-6 lg:right-6 h-14 w-14 rounded-full bg-primary text-white shadow-md hover:shadow-lg hover:bg-primary-dark transition flex items-center justify-center z-40"
      >
        <Plus size={24} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}

export default FinanceiroClient;
