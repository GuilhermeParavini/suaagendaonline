"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Package, AlertTriangle, TrendingUp, Wallet } from "lucide-react";
import {
  getRelatorioEstoque,
  type RelatorioEstoque as RelatorioEstoqueData,
  type RelatorioEstoqueFiltros,
} from "@/actions/estoque";
import MetricCard from "@/components/ui/MetricCard";
import { formatCurrency } from "@/lib/masks";

interface ProfissionalOpcao {
  id: string;
  nome: string;
}

interface RelatorioEstoqueProps {
  role: "admin" | "profissional" | "secretaria";
  profissionais: ProfissionalOpcao[];
  profissionalId: string;
}

const PERIODOS: { value: number; label: string }[] = [
  { value: 7, label: "Ultimos 7 dias" },
  { value: 30, label: "Ultimos 30 dias" },
  { value: 90, label: "Ultimos 90 dias" },
];

function diasAtras(dias: number): { inicio: string; fim: string } {
  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - dias);
  const fmt = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };
  return { inicio: fmt(inicio), fim: fmt(hoje) };
}

function RelatorioEstoque({
  role,
  profissionais,
  profissionalId,
}: RelatorioEstoqueProps) {
  const [periodo, setPeriodo] = useState<number>(30);
  const [profFiltro, setProfFiltro] = useState<string>(profissionalId);
  const [dados, setDados] = useState<RelatorioEstoqueData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setProfFiltro(profissionalId);
  }, [profissionalId]);

  useEffect(() => {
    setError(null);
    const { inicio, fim } = diasAtras(periodo);
    const filtros: RelatorioEstoqueFiltros = {
      periodoInicio: inicio,
      periodoFim: fim,
    };
    if (role === "admin" && profFiltro) {
      filtros.profissionalId = profFiltro;
    }
    startTransition(async () => {
      const r = await getRelatorioEstoque(filtros);
      if (!r.ok) {
        setError(r.error);
        setDados(null);
        return;
      }
      setDados(r.data);
    });
  }, [periodo, profFiltro, role]);

  const dadosGrafico =
    dados?.topMovimentados.map((t) => ({
      nome: t.nome.length > 18 ? t.nome.slice(0, 18) + "..." : t.nome,
      saidas: t.totalSaidas,
    })) ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-[14px] font-medium text-slate-900">
            Periodo
          </label>
          <select
            value={periodo}
            onChange={(e) => setPeriodo(Number(e.target.value))}
            className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {PERIODOS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {role === "admin" && profissionais.length > 1 ? (
          <div className="space-y-1">
            <label className="block text-[14px] font-medium text-slate-900">
              Profissional
            </label>
            <select
              value={profFiltro}
              onChange={(e) => setProfFiltro(e.target.value)}
              className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {profissionais.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section
        aria-busy={isPending}
        aria-live="polite"
        className={
          isPending ? "opacity-60 transition-opacity" : "transition-opacity"
        }
      >
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          <MetricCard
            label="Total de produtos"
            value={
              <span className="inline-flex items-center gap-1.5">
                <Package
                  size={18}
                  strokeWidth={1.5}
                  className="text-slate-500"
                  aria-hidden="true"
                />
                {dados?.totalProdutos ?? 0}
              </span>
            }
          />
          <MetricCard
            label="Em alerta"
            value={
              <span className="inline-flex items-center gap-1.5 text-amber-700">
                <AlertTriangle
                  size={18}
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                {dados?.produtosAlerta ?? 0}
              </span>
            }
          />
          <MetricCard
            label="Movimentacoes"
            value={
              <span className="inline-flex items-center gap-1.5">
                <TrendingUp
                  size={18}
                  strokeWidth={1.5}
                  className="text-slate-500"
                  aria-hidden="true"
                />
                {dados?.movimentacoesPeriodo ?? 0}
              </span>
            }
          />
          <MetricCard
            label="Valor total"
            value={
              <span className="inline-flex items-center gap-1.5 text-primary-dark">
                <Wallet size={18} strokeWidth={1.5} aria-hidden="true" />
                {formatCurrency(dados?.valorTotalEstoque ?? 0)}
              </span>
            }
          />
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-medium text-slate-700">
            Top 5 produtos mais movimentados
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Ranking por quantidade total de saidas no periodo
          </p>
          {dadosGrafico.length === 0 ? (
            <p className="mt-6 text-center text-sm text-slate-500">
              Nenhuma saida registrada no periodo.
            </p>
          ) : (
            <div className="mt-3 h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dadosGrafico}
                  layout="vertical"
                  margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "#64748B" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    tick={{ fontSize: 11, fill: "#64748B" }}
                    width={120}
                  />
                  <Tooltip
                    formatter={(v) => [String(v), "Saidas"]}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 6,
                      border: "1px solid #E2E8F0",
                    }}
                  />
                  <Bar
                    dataKey="saidas"
                    fill="#0D9488"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default RelatorioEstoque;
