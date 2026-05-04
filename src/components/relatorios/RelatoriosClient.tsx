"use client";

import { useMemo, useState, useTransition } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
} from "lucide-react";
import {
  getRelatorioFaturamento,
  type FaturamentoData,
  type FaturamentoFiltros,
} from "@/actions/relatorios";
import type { FormaPagamento } from "@/actions/financeiro";
import { formatCurrency, brDateToIso, isoToBrDate, formatDate } from "@/lib/masks";
import { cn } from "@/lib/utils";

const COLOR_VERDE = "#10B981";
const COLOR_VERMELHO = "#EF4444";
const COLOR_PIE = [
  "#0D9488",
  "#10B981",
  "#F59E0B",
  "#3B82F6",
  "#A855F7",
  "#EC4899",
  "#EF4444",
];

const FORMA_LABEL: Record<FormaPagamento, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  convenio: "Convênio",
  transferencia: "Transferência",
  outro: "Outro",
};

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/10 transition";
const labelClass = "block text-[13px] font-medium text-slate-700";

interface RelatoriosClientProps {
  initialFaturamento: FaturamentoData;
  initialPeriodo: { dataInicio: string; dataFim: string };
}

function RelatoriosClient({
  initialFaturamento,
  initialPeriodo,
}: RelatoriosClientProps) {
  return (
    <div className="space-y-5 pb-12">
      <header className="space-y-1">
        <h1 className="text-[22px] font-semibold text-slate-900 leading-tight">
          Relatórios
        </h1>
        <p className="text-sm text-slate-500">
          Acompanhe seu faturamento, pacientes e agendamentos.
        </p>
      </header>

      <Tabs.Root defaultValue="faturamento" className="space-y-5">
        <Tabs.List
          aria-label="Abas de relatórios"
          className="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1"
        >
          {[
            { value: "faturamento", label: "Faturamento" },
            { value: "pacientes", label: "Pacientes" },
            { value: "agendamentos", label: "Agendamentos" },
          ].map((t) => (
            <Tabs.Trigger
              key={t.value}
              value={t.value}
              className={cn(
                "flex-1 whitespace-nowrap rounded px-3 py-2 text-sm font-medium transition-colors",
                "data-[state=active]:bg-primary-surface data-[state=active]:text-primary-dark",
                "text-slate-500 hover:text-slate-900",
              )}
            >
              {t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="faturamento" className="focus:outline-none">
          <FaturamentoTab
            initialData={initialFaturamento}
            initialPeriodo={initialPeriodo}
          />
        </Tabs.Content>

        <Tabs.Content value="pacientes" className="focus:outline-none">
          <EmBreve titulo="Relatório de Pacientes" />
        </Tabs.Content>

        <Tabs.Content value="agendamentos" className="focus:outline-none">
          <EmBreve titulo="Relatório de Agendamentos" />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

function EmBreve({ titulo }: { titulo: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
      <p className="text-sm font-medium text-slate-700">{titulo}</p>
      <p className="mt-1 text-xs text-slate-500">Em breve.</p>
    </div>
  );
}

// ============================================================
// FATURAMENTO TAB
// ============================================================

interface FaturamentoTabProps {
  initialData: FaturamentoData;
  initialPeriodo: { dataInicio: string; dataFim: string };
}

const PAGE_SIZE = 20;

function FaturamentoTab({ initialData, initialPeriodo }: FaturamentoTabProps) {
  const [dataInicioBr, setDataInicioBr] = useState(
    isoToBrDate(initialPeriodo.dataInicio),
  );
  const [dataFimBr, setDataFimBr] = useState(
    isoToBrDate(initialPeriodo.dataFim),
  );
  const [formaPagamento, setFormaPagamento] = useState<
    FormaPagamento | "todos"
  >("todos");
  const [statusPago, setStatusPago] = useState<"todos" | "pago" | "pendente">(
    "todos",
  );
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const [data, setData] = useState<FaturamentoData>(initialData);
  const [pagina, setPagina] = useState(1);
  const [erro, setErro] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();

  const aplicarFiltros = () => {
    setErro(null);
    const ini = brDateToIso(dataInicioBr);
    const fim = brDateToIso(dataFimBr);
    if (!ini || !fim) {
      setErro("Datas inválidas. Use DD/MM/AAAA.");
      return;
    }
    if (fim < ini) {
      setErro("Data fim anterior à data inicio.");
      return;
    }
    const filtros: FaturamentoFiltros = {
      dataInicio: ini,
      dataFim: fim,
      formaPagamento,
      pago: statusPago,
    };
    startLoading(async () => {
      const r = await getRelatorioFaturamento(filtros);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setData(r.data);
      setPagina(1);
    });
  };

  const totalPaginas = Math.max(
    1,
    Math.ceil(data.lancamentos.length / PAGE_SIZE),
  );
  const lancamentosPagina = useMemo(
    () =>
      data.lancamentos.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE),
    [data.lancamentos, pagina],
  );

  const handleExportarCsv = () => {
    const linhas: string[] = [];
    linhas.push("Data;Tipo;Descrição;Paciente;Forma;Status;Valor");
    for (const l of data.lancamentos) {
      const cols = [
        isoToBrDate(l.data),
        l.tipo === "receita" ? "Receita" : "Despesa",
        csvEscape(l.descricao),
        csvEscape(l.paciente_nome ?? ""),
        l.forma_pagamento ? FORMA_LABEL[l.forma_pagamento] : "",
        l.pago ? "Pago" : "Pendente",
        formatCurrency(l.valor).replace("R$", "").trim(),
      ];
      linhas.push(cols.join(";"));
    }
    const bom = "﻿";
    const csv = bom + linhas.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `faturamento_${data.periodo.dataInicio}_${data.periodo.dataFim}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const piePorForma = data.porFormaPagamento.map((p) => ({
    nome:
      (FORMA_LABEL[p.forma as FormaPagamento] ?? p.forma) +
      ` (${formatCurrency(p.total)})`,
    total: p.total,
  }));

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setFiltrosAbertos((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 sm:hidden"
        >
          <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <Filter size={16} strokeWidth={1.5} aria-hidden="true" />
            Filtros
          </span>
          {filtrosAbertos ? (
            <ChevronUp
              size={16}
              strokeWidth={1.5}
              aria-hidden="true"
              className="text-slate-500"
            />
          ) : (
            <ChevronDown
              size={16}
              strokeWidth={1.5}
              aria-hidden="true"
              className="text-slate-500"
            />
          )}
        </button>
        <div
          className={cn(
            "px-4 pb-4 pt-2 sm:p-4 sm:block",
            !filtrosAbertos && "hidden sm:block",
          )}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label className={labelClass}>Data início</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                placeholder="DD/MM/AAAA"
                value={dataInicioBr}
                onChange={(e) => setDataInicioBr(formatDate(e.target.value))}
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Data fim</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                placeholder="DD/MM/AAAA"
                value={dataFimBr}
                onChange={(e) => setDataFimBr(formatDate(e.target.value))}
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Forma de pagamento</label>
              <select
                value={formaPagamento}
                onChange={(e) =>
                  setFormaPagamento(
                    e.target.value as FormaPagamento | "todos",
                  )
                }
                className={inputClass}
              >
                <option value="todos">Todas</option>
                {Object.entries(FORMA_LABEL).map(([v, lbl]) => (
                  <option key={v} value={v}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Status</label>
              <select
                value={statusPago}
                onChange={(e) =>
                  setStatusPago(e.target.value as typeof statusPago)
                }
                className={inputClass}
              >
                <option value="todos">Todos</option>
                <option value="pago">Pago</option>
                <option value="pendente">Pendente</option>
              </select>
            </div>
          </div>

          {erro ? (
            <p className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {erro}
            </p>
          ) : null}

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={aplicarFiltros}
              disabled={isLoading}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-dark disabled:opacity-50 transition-colors"
            >
              {isLoading ? "Atualizando..." : "Aplicar"}
            </button>
          </div>
        </div>
      </section>

      {isLoading ? (
        <Skeleton />
      ) : (
        <>
          {/* Cards */}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <CardResumo
              label="Total receitas"
              value={formatCurrency(data.totalReceitas)}
              accent="verde"
            />
            <CardResumo
              label="Total despesas"
              value={formatCurrency(data.totalDespesas)}
              accent="vermelho"
            />
            <CardResumo
              label="Saldo"
              value={formatCurrency(data.saldo)}
              accent={data.saldo >= 0 ? "teal" : "vermelho"}
            />
            <CardResumo
              label="Ticket médio"
              value={formatCurrency(data.ticketMedio)}
              accent="neutro"
            />
          </section>

          {/* Graficos */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-medium text-slate-700">
                Receitas vs despesas (últimos 6 meses)
              </h3>
              {data.porMes.every(
                (m) => m.receitas === 0 && m.despesas === 0,
              ) ? (
                <EstadoVazio />
              ) : (
                <div className="mt-3 h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.porMes}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis
                        dataKey="mes"
                        tick={{ fontSize: 11, fill: "#64748B" }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#64748B" }}
                        tickFormatter={(v) =>
                          new Intl.NumberFormat("pt-BR", {
                            notation: "compact",
                          }).format(Number(v))
                        }
                      />
                      <Tooltip
                        formatter={(v) => formatCurrency(Number(v) || 0)}
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 6,
                          border: "1px solid #E2E8F0",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar
                        dataKey="receitas"
                        name="Receitas"
                        fill={COLOR_VERDE}
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="despesas"
                        name="Despesas"
                        fill={COLOR_VERMELHO}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-medium text-slate-700">
                Receitas por forma de pagamento
              </h3>
              {piePorForma.length === 0 ? (
                <EstadoVazio />
              ) : (
                <div className="mt-3 h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={piePorForma}
                        dataKey="total"
                        nameKey="nome"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                      >
                        {piePorForma.map((_, idx) => (
                          <Cell
                            key={idx}
                            fill={COLOR_PIE[idx % COLOR_PIE.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v) => formatCurrency(Number(v) || 0)}
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 6,
                          border: "1px solid #E2E8F0",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </section>

          {/* Tabela */}
          <section className="rounded-lg border border-slate-200 bg-white">
            <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-medium text-slate-700">
                  Lançamentos
                </h3>
                <p className="text-xs text-slate-500">
                  {data.lancamentos.length}{" "}
                  {data.lancamentos.length === 1 ? "lançamento" : "lançamentos"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportarCsv}
                disabled={data.lancamentos.length === 0}
                className="inline-flex items-center gap-1.5 rounded border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-surface disabled:opacity-50 transition-colors"
              >
                <Download size={13} strokeWidth={1.5} aria-hidden="true" />
                Exportar CSV
              </button>
            </header>

            {data.lancamentos.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-500">
                  Nenhum dado encontrado para o período selecionado.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">Data</th>
                        <th className="px-3 py-2 font-medium">Descrição</th>
                        <th className="px-3 py-2 font-medium">Paciente</th>
                        <th className="px-3 py-2 font-medium">Forma</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium text-right">
                          Valor
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lancamentosPagina.map((l) => (
                        <tr key={l.id}>
                          <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                            {isoToBrDate(l.data)}
                          </td>
                          <td className="px-3 py-2 text-slate-900">
                            {l.descricao}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {l.paciente_nome ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {l.forma_pagamento
                              ? FORMA_LABEL[l.forma_pagamento]
                              : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                                l.pago
                                  ? "bg-[#D1FAE5] text-[#065F46]"
                                  : "bg-warning-surface text-[#92400E]",
                              )}
                            >
                              {l.pago ? "Pago" : "Pendente"}
                            </span>
                          </td>
                          <td
                            className={cn(
                              "px-3 py-2 text-right font-medium whitespace-nowrap",
                              l.tipo === "receita"
                                ? "text-[#065F46]"
                                : "text-[#991B1B]",
                            )}
                          >
                            {l.tipo === "despesa" ? "− " : ""}
                            {formatCurrency(l.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPaginas > 1 ? (
                  <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setPagina((p) => Math.max(1, p - 1))}
                      disabled={pagina === 1}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <span className="text-xs text-slate-500">
                      Página {pagina} de {totalPaginas}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPagina((p) => Math.min(totalPaginas, p + 1))
                      }
                      disabled={pagina >= totalPaginas}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Próxima
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function csvEscape(value: string): string {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function CardResumo({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "verde" | "vermelho" | "teal" | "neutro";
}) {
  const accentClass =
    accent === "verde"
      ? "text-[#065F46]"
      : accent === "vermelho"
        ? "text-[#991B1B]"
        : accent === "teal"
          ? "text-primary-dark"
          : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className={cn("mt-1 text-lg font-semibold leading-tight", accentClass)}>
        {value}
      </p>
    </div>
  );
}

function EstadoVazio() {
  return (
    <div className="mt-3 flex h-[200px] items-center justify-center rounded border border-dashed border-slate-200 bg-slate-50 text-center">
      <p className="text-sm text-slate-500">
        Nenhum dado encontrado para o período selecionado.
      </p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[68px] animate-pulse rounded-lg border border-slate-200 bg-slate-100"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-[280px] animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
        <div className="h-[280px] animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
      </div>
      <div className="h-[200px] animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
    </div>
  );
}

export default RelatoriosClient;
