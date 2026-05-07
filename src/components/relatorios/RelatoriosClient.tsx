"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
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
  Clock,
  Download,
  Filter,
  UserCheck,
} from "lucide-react";
import {
  getRelatorioAgendamentos,
  getRelatorioFaturamento,
  getRelatorioPacientes,
  listarProcedimentosRelatorios,
  type AgendamentosData,
  type AgendamentosFiltros,
  type FaixaEtaria,
  type FaturamentoData,
  type FaturamentoFiltros,
  type PacientesData,
  type PacientesFiltros,
  type StatusTratamentoFiltro,
} from "@/actions/relatorios";
import {
  listarProfissionaisAtivosTenant,
  type ProfissionalOpcaoTenant,
} from "@/actions/equipe";
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

const COLOR_ORIGEM: Record<string, string> = {
  Instagram: "#E4405F",
  Google: "#4285F4",
  Indicacao: "#22C55E",
  Facebook: "#1877F2",
  Site: "#0D9488",
  Outros: "#64748B",
  "Nao informado": "#CBD5E1",
};

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
const labelClass = "block text-[14px] font-medium text-slate-900";

interface RelatoriosClientProps {
  initialFaturamento: FaturamentoData;
  initialPeriodo: { dataInicio: string; dataFim: string };
}

function RelatoriosClient({
  initialFaturamento,
  initialPeriodo,
}: RelatoriosClientProps) {
  const [profissionais, setProfissionais] = useState<
    ProfissionalOpcaoTenant[]
  >([]);
  const [profissionalId, setProfissionalId] = useState<string>("todos");

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const r = await listarProfissionaisAtivosTenant();
      if (!cancelado && r.ok) setProfissionais(r.data);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <div className="space-y-5 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-[22px] font-semibold text-slate-900 leading-tight">
            Relatórios
          </h1>
          <p className="text-sm text-slate-500">
            Acompanhe seu faturamento, pacientes e agendamentos.
          </p>
        </div>
        {profissionais.length > 1 ? (
          <div className="flex items-center gap-2">
            <label
              htmlFor="rel-prof-filtro"
              className="text-xs font-medium text-slate-500"
            >
              Profissional:
            </label>
            <select
              id="rel-prof-filtro"
              value={profissionalId}
              onChange={(e) => setProfissionalId(e.target.value)}
              className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/10"
            >
              <option value="todos">Todos os profissionais</option>
              {profissionais.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                  {p.is_self ? " (você)" : ""}
                </option>
              ))}
            </select>
          </div>
        ) : null}
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
            profissionalId={profissionalId}
          />
        </Tabs.Content>

        <Tabs.Content value="pacientes" className="focus:outline-none">
          <PacientesTab
            initialPeriodo={initialPeriodo}
            profissionalId={profissionalId}
          />
        </Tabs.Content>

        <Tabs.Content value="agendamentos" className="focus:outline-none">
          <AgendamentosTab
            initialPeriodo={initialPeriodo}
            profissionalId={profissionalId}
          />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

// ============================================================
// FATURAMENTO TAB
// ============================================================

interface FaturamentoTabProps {
  initialData: FaturamentoData;
  initialPeriodo: { dataInicio: string; dataFim: string };
  profissionalId: string;
}

const PAGE_SIZE = 20;

function FaturamentoTab({
  initialData,
  initialPeriodo,
  profissionalId,
}: FaturamentoTabProps) {
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
  const profIniciouRef = useRef(false);

  useEffect(() => {
    if (!profIniciouRef.current) {
      profIniciouRef.current = true;
      return;
    }
    setErro(null);
    startLoading(async () => {
      const r = await getRelatorioFaturamento({
        dataInicio:
          brDateToIso(dataInicioBr) ?? initialPeriodo.dataInicio,
        dataFim: brDateToIso(dataFimBr) ?? initialPeriodo.dataFim,
        formaPagamento,
        pago: statusPago,
        profissionalId,
      });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setData(r.data);
      setPagina(1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profissionalId]);

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
      profissionalId,
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
                className="inline-flex items-center gap-1.5 rounded border border-primary px-3 py-1.5 text-xs font-medium text-primary-text hover:bg-primary-surface disabled:opacity-50 transition-colors"
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

// ============================================================
// PACIENTES TAB
// ============================================================

const GENERO_LABEL: Record<"todos" | "masculino" | "feminino" | "prefiro_nao_informar", string> = {
  todos: "Todos",
  masculino: "Masculino",
  feminino: "Feminino",
  prefiro_nao_informar: "Outro",
};

const FAIXAS: { value: FaixaEtaria | "todos"; label: string }[] = [
  { value: "todos", label: "Todas" },
  { value: "0-17", label: "0-17 anos" },
  { value: "18-30", label: "18-30 anos" },
  { value: "31-50", label: "31-50 anos" },
  { value: "51-65", label: "51-65 anos" },
  { value: "65+", label: "65+ anos" },
];

interface PacientesTabProps {
  initialPeriodo: { dataInicio: string; dataFim: string };
  profissionalId: string;
}

function PacientesTab({ initialPeriodo, profissionalId }: PacientesTabProps) {
  const [dataInicioBr, setDataInicioBr] = useState(
    isoToBrDate(initialPeriodo.dataInicio),
  );
  const [dataFimBr, setDataFimBr] = useState(
    isoToBrDate(initialPeriodo.dataFim),
  );
  const [genero, setGenero] = useState<
    "todos" | "masculino" | "feminino" | "prefiro_nao_informar"
  >("todos");
  const [faixaEtaria, setFaixaEtaria] = useState<FaixaEtaria | "todos">(
    "todos",
  );
  const [statusTratamento, setStatusTratamento] =
    useState<StatusTratamentoFiltro>("todos");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const [data, setData] = useState<PacientesData | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const initialLoadRef = useRef(false);

  const carregar = (filtros: PacientesFiltros) => {
    setErro(null);
    startLoading(async () => {
      const r = await getRelatorioPacientes(filtros);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setData(r.data);
    });
  };

  useEffect(() => {
    initialLoadRef.current = true;
    const ini =
      brDateToIso(dataInicioBr) ?? initialPeriodo.dataInicio;
    const fim = brDateToIso(dataFimBr) ?? initialPeriodo.dataFim;
    carregar({
      dataInicio: ini,
      dataFim: fim,
      genero,
      faixaEtaria,
      profissionalId,
      statusTratamento,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profissionalId]);

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
    carregar({
      dataInicio: ini,
      dataFim: fim,
      genero,
      faixaEtaria,
      profissionalId,
      statusTratamento,
    });
  };

  return (
    <div className="space-y-5">
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
              <label className={labelClass}>Cadastro a partir de</label>
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
              <label className={labelClass}>Cadastro até</label>
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
              <label className={labelClass}>Gênero</label>
              <select
                value={genero}
                onChange={(e) =>
                  setGenero(e.target.value as typeof genero)
                }
                className={inputClass}
              >
                {Object.entries(GENERO_LABEL).map(([v, lbl]) => (
                  <option key={v} value={v}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Faixa etária</label>
              <select
                value={faixaEtaria}
                onChange={(e) =>
                  setFaixaEtaria(e.target.value as FaixaEtaria | "todos")
                }
                className={inputClass}
              >
                {FAIXAS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Status de tratamento</label>
              <select
                value={statusTratamento}
                onChange={(e) =>
                  setStatusTratamento(
                    e.target.value as StatusTratamentoFiltro,
                  )
                }
                className={inputClass}
              >
                <option value="todos">Todos os status</option>
                <option value="ativo">Ativos</option>
                <option value="alta">Com alta</option>
                <option value="inativo">Inativos</option>
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

      {isLoading || !data ? (
        <Skeleton />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <CardResumo
              label="Total de pacientes"
              value={String(data.total)}
              accent="teal"
            />
            <CardResumo
              label="Novos no período"
              value={String(data.novosNoPeriodo)}
              accent="verde"
            />
            <CardResumo
              label="Retornos no período"
              value={String(data.retornosNoPeriodo)}
              accent="azul"
            />
            <CardResumo
              label="Taxa de retorno"
              value={`${data.taxaRetorno.toFixed(1).replace(".", ",")}%`}
              accent="teal"
            />
            {data.pacientesAlta > 0 ? (
              <CardResumo
                label="Pacientes com alta"
                value={String(data.pacientesAlta)}
                accent="verde"
                icon={
                  <UserCheck
                    size={14}
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                }
              />
            ) : null}
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-medium text-slate-700">
                Novos pacientes (últimos 6 meses)
              </h3>
              {data.porMes.every((m) => m.novos === 0) ? (
                <EstadoVazio />
              ) : (
                <div className="mt-3 h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
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
                        allowDecimals={false}
                      />
                      <Tooltip
                        formatter={(v) => [`${Number(v) || 0}`, "Novos"]}
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 6,
                          border: "1px solid #E2E8F0",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="novos"
                        name="Novos"
                        stroke="#0D9488"
                        strokeWidth={2}
                        dot={{ r: 4, fill: "#0D9488" }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-medium text-slate-700">
                Distribuição por gênero
              </h3>
              {data.porGenero.length === 0 ? (
                <EstadoVazio />
              ) : (
                <div className="mt-3 h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.porGenero.map((g) => ({
                          nome: `${g.genero} (${g.total})`,
                          total: g.total,
                        }))}
                        dataKey="total"
                        nameKey="nome"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                      >
                        {data.porGenero.map((_, idx) => (
                          <Cell
                            key={idx}
                            fill={COLOR_PIE[idx % COLOR_PIE.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v) => `${Number(v) || 0}`}
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

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-medium text-slate-700">
              Origem dos pacientes
            </h3>
            {data.porOrigem.length === 0 ? (
              <EstadoVazio />
            ) : (
              <div className="mt-3 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.porOrigem.map((o) => ({
                        nome: o.origem,
                        quantidade: o.quantidade,
                        percentual: o.percentual,
                      }))}
                      dataKey="quantidade"
                      nameKey="nome"
                      cx="50%"
                      cy="50%"
                      outerRadius={95}
                    >
                      {data.porOrigem.map((o, idx) => (
                        <Cell
                          key={`origem-${idx}`}
                          fill={
                            COLOR_ORIGEM[o.origem] ??
                            COLOR_PIE[idx % COLOR_PIE.length]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v, _name, props) => {
                        const pct = (props?.payload as
                          | { percentual?: number }
                          | undefined)?.percentual;
                        return [
                          `${Number(v) || 0}${
                            typeof pct === "number"
                              ? ` (${pct.toFixed(1).replace(".", ",")}%)`
                              : ""
                          }`,
                          "Pacientes",
                        ];
                      }}
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
          </section>

          <section className="rounded-lg border border-slate-200 bg-white">
            <header className="px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm font-medium text-slate-700">
                Top 10 pacientes
              </h3>
              <p className="text-xs text-slate-500">
                Ordenado por consultas concluídas.
              </p>
            </header>
            {data.topPacientes.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-500">
                  Nenhum paciente com consultas concluídas.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.topPacientes.map((p, idx) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <span
                      className={cn(
                        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        idx < 3
                          ? "bg-primary text-white"
                          : "bg-slate-100 text-slate-600",
                      )}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {p.nome}
                      </p>
                      <p className="text-xs text-slate-500">
                        {p.totalConsultas}{" "}
                        {p.totalConsultas === 1 ? "consulta" : "consultas"}
                        {p.ultimaConsulta ? (
                          <>
                            <span className="mx-1 text-slate-300">·</span>
                            Última:{" "}
                            {isoToBrDate(p.ultimaConsulta.slice(0, 10))}
                          </>
                        ) : null}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

// ============================================================
// AGENDAMENTOS TAB
// ============================================================

const STATUS_AGENDAMENTO_LABEL: Record<
  | "todos"
  | "agendado"
  | "confirmado"
  | "em_atendimento"
  | "concluido"
  | "faltou"
  | "cancelado",
  string
> = {
  todos: "Todos",
  agendado: "Agendado",
  confirmado: "Confirmado",
  em_atendimento: "Em atendimento",
  concluido: "Concluído",
  faltou: "Falta",
  cancelado: "Cancelado",
};

interface AgendamentosTabProps {
  initialPeriodo: { dataInicio: string; dataFim: string };
  profissionalId: string;
}

function AgendamentosTab({
  initialPeriodo,
  profissionalId,
}: AgendamentosTabProps) {
  const [dataInicioBr, setDataInicioBr] = useState(
    isoToBrDate(initialPeriodo.dataInicio),
  );
  const [dataFimBr, setDataFimBr] = useState(
    isoToBrDate(initialPeriodo.dataFim),
  );
  const [status, setStatus] = useState<
    keyof typeof STATUS_AGENDAMENTO_LABEL
  >("todos");
  const [procedimentoId, setProcedimentoId] = useState<string>("");
  const [procedimentos, setProcedimentos] = useState<
    { id: string; nome: string }[]
  >([]);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const [data, setData] = useState<AgendamentosData | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const initialLoadRef = useRef(false);

  const carregar = (filtros: AgendamentosFiltros) => {
    setErro(null);
    startLoading(async () => {
      const r = await getRelatorioAgendamentos(filtros);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setData(r.data);
    });
  };

  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      (async () => {
        const procRes = await listarProcedimentosRelatorios();
        if (procRes.ok) setProcedimentos(procRes.data);
      })();
    }
    const ini =
      brDateToIso(dataInicioBr) ?? initialPeriodo.dataInicio;
    const fim = brDateToIso(dataFimBr) ?? initialPeriodo.dataFim;
    carregar({
      dataInicio: ini,
      dataFim: fim,
      status,
      procedimentoId: procedimentoId || undefined,
      profissionalId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profissionalId]);

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
    carregar({
      dataInicio: ini,
      dataFim: fim,
      status,
      procedimentoId: procedimentoId || undefined,
      profissionalId,
    });
  };

  return (
    <div className="space-y-5">
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
              <label className={labelClass}>Status</label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as typeof status)
                }
                className={inputClass}
              >
                {Object.entries(STATUS_AGENDAMENTO_LABEL).map(([v, lbl]) => (
                  <option key={v} value={v}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Procedimento</label>
              <select
                value={procedimentoId}
                onChange={(e) => setProcedimentoId(e.target.value)}
                className={inputClass}
              >
                <option value="">Todos</option>
                {procedimentos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
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

      {isLoading || !data ? (
        <Skeleton />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <CardResumo
              label="Total agendamentos"
              value={String(data.total)}
              accent="teal"
            />
            <CardResumo
              label="Concluídos"
              value={String(data.concluidos)}
              accent="verde"
            />
            <CardResumo
              label="Faltas"
              value={String(data.faltas)}
              accent="vermelho"
            />
            <CardResumo
              label="Taxa de presença"
              value={`${data.taxaPresenca.toFixed(1).replace(".", ",")}%`}
              accent="teal"
            />
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-surface text-primary-dark">
                <Clock size={22} strokeWidth={1.5} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Horário de pico
                </p>
                <p className="text-xl font-semibold leading-tight text-slate-900">
                  {data.horarioPico}
                </p>
                <p className="text-xs text-slate-500">
                  Horário com mais agendamentos
                </p>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-medium text-slate-700">
                Agendamentos por dia da semana
              </h3>
              {data.porDiaSemana.every((d) => d.total === 0) ? (
                <EstadoVazio />
              ) : (
                <div className="mt-3 h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.porDiaSemana}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis
                        dataKey="dia"
                        tick={{ fontSize: 11, fill: "#64748B" }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#64748B" }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        formatter={(v) => [`${Number(v) || 0}`, "Agendamentos"]}
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 6,
                          border: "1px solid #E2E8F0",
                        }}
                      />
                      <Bar
                        dataKey="total"
                        name="Agendamentos"
                        fill="#0D9488"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-medium text-slate-700">
                Top 5 procedimentos
              </h3>
              {data.porProcedimento.length === 0 ? (
                <EstadoVazio />
              ) : (
                <div className="mt-3 h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.porProcedimento}
                      layout="vertical"
                      margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#E2E8F0"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: "#64748B" }}
                        allowDecimals={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="nome"
                        tick={{ fontSize: 11, fill: "#64748B" }}
                        width={120}
                      />
                      <Tooltip
                        formatter={(v) => [`${Number(v) || 0}`, "Agendamentos"]}
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 6,
                          border: "1px solid #E2E8F0",
                        }}
                      />
                      <Bar
                        dataKey="total"
                        name="Agendamentos"
                        fill="#0D9488"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-medium text-slate-700">
              Agendamentos por mês (últimos 6 meses)
            </h3>
            {data.porMes.every((m) => m.total === 0) ? (
              <EstadoVazio />
            ) : (
              <div className="mt-3 h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
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
                      allowDecimals={false}
                    />
                    <Tooltip
                      formatter={(v) => [`${Number(v) || 0}`, "Agendamentos"]}
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 6,
                        border: "1px solid #E2E8F0",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="Agendamentos"
                      stroke="#0D9488"
                      strokeWidth={2}
                      dot={{ r: 4, fill: "#0D9488" }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
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
  icon,
}: {
  label: string;
  value: string;
  accent: "verde" | "vermelho" | "teal" | "azul" | "neutro";
  icon?: React.ReactNode;
}) {
  const accentClass =
    accent === "verde"
      ? "text-[#065F46]"
      : accent === "vermelho"
        ? "text-[#991B1B]"
        : accent === "teal"
          ? "text-primary-dark"
          : accent === "azul"
            ? "text-[#1E40AF]"
            : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {icon ? (
          <span className={cn("inline-flex items-center", accentClass)}>
            {icon}
          </span>
        ) : null}
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
