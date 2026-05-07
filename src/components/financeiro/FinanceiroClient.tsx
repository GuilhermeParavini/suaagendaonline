"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { ChevronDown, ChevronUp, Filter, Plus } from "lucide-react";
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
import {
  getComissoesMensais,
  type ComissaoMensal,
} from "@/actions/comissoes";
import MetricCard from "@/components/ui/MetricCard";
import { formatCurrency } from "@/lib/masks";
import { cn } from "@/lib/utils";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import ListaLancamentos from "./ListaLancamentos";
import FormLancamento from "./FormLancamento";
import FinanceiroAdmin from "./FinanceiroAdmin";

interface FinanceiroClientProps {
  initialMes: number;
  initialAno: number;
  initialResumo: ResumoFinanceiro;
  initialLancamentos: Lancamento[];
  pacientes: PacienteOption[];
  role: "admin" | "profissional" | "secretaria";
  totalComissoesAtivas: number;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const formaPagamentoOptions: { value: FormaPagamento | "todos"; label: string }[] = [
  { value: "todos", label: "Todas" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "convenio", label: "Convênio" },
  { value: "transferencia", label: "Transferência" },
  { value: "outro", label: "Outro" },
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function mesAnterior(mes: number, ano: number): { mes: number; ano: number } {
  if (mes === 1) return { mes: 12, ano: ano - 1 };
  return { mes: mes - 1, ano };
}

function FinanceiroClient({
  initialMes,
  initialAno,
  initialResumo,
  initialLancamentos,
  pacientes,
  role,
  totalComissoesAtivas,
}: FinanceiroClientProps) {
  useScrollRestore("scroll-financeiro");
  const [mes, setMes] = useState(initialMes);
  const [ano, setAno] = useState(initialAno);
  const [tipo, setTipo] = useState<FinanceiroTipo>("receita");
  const [vista, setVista] = useState<"lancamentos" | "comissoes">("lancamentos");
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

  const [fechAnt, setFechAnt] = useState<ComissaoMensal | null>(null);
  const [fechExpandido, setFechExpandido] = useState(false);

  const mostrarTabComissoes = role === "admin" && totalComissoesAtivas > 0;

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

  // Carregar fechamento do mes anterior se ha comissao
  useEffect(() => {
    if (!resumo.temComissao) {
      // Limpa estado anterior quando o mes nao tem comissao.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFechAnt(null);
      return;
    }
    let cancelado = false;
    const ant = mesAnterior(mes, ano);
    const mesAno = `${ant.ano}-${pad2(ant.mes)}`;
    (async () => {
      const r = await getComissoesMensais({ mesAno });
      if (cancelado) return;
      if (r.ok && r.data.length > 0) {
        setFechAnt(r.data[0]);
      } else {
        setFechAnt(null);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [mes, ano, resumo.temComissao]);

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
    resumo.saldo >= 0 ? "text-primary-text" : "text-danger";

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

      {resumo.temComissao ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          <MetricCard
            label="Faturado"
            value={
              <span className="text-[#16A34A]">
                {formatCurrency(resumo.receita)}
              </span>
            }
          />
          <MetricCard
            label="Comissao clinica"
            value={
              <span className="text-[#92400E]">
                {formatCurrency(resumo.totalComissao)}
              </span>
            }
          />
          <MetricCard
            label="Liquido"
            value={
              <span className="text-primary-dark">
                {formatCurrency(resumo.valorLiquido)}
              </span>
            }
          />
          <MetricCard
            label="Despesas"
            value={
              <span className="text-danger">
                {formatCurrency(resumo.despesa)}
              </span>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          <MetricCard
            label="Receita do mês"
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
      )}

      {fechAnt && resumo.temComissao ? (
        <FechamentoMesAnteriorCard
          fechamento={fechAnt}
          expandido={fechExpandido}
          onToggle={() => setFechExpandido((v) => !v)}
        />
      ) : null}

      {mostrarTabComissoes ? (
        <Tabs.Root
          value={vista}
          onValueChange={(v) =>
            setVista(v === "comissoes" ? "comissoes" : "lancamentos")
          }
        >
          <Tabs.List
            aria-label="Visao do financeiro"
            className="inline-flex w-full rounded-lg border border-slate-200 bg-white p-1 sm:w-auto"
          >
            <Tabs.Trigger
              value="lancamentos"
              className={cn(
                "flex-1 rounded px-4 py-1.5 text-sm font-medium transition-colors sm:flex-initial",
                "data-[state=active]:bg-primary-surface data-[state=active]:text-primary-dark",
                "text-slate-500 hover:text-slate-900",
              )}
            >
              Lancamentos
            </Tabs.Trigger>
            <Tabs.Trigger
              value="comissoes"
              className={cn(
                "flex-1 rounded px-4 py-1.5 text-sm font-medium transition-colors sm:flex-initial",
                "data-[state=active]:bg-primary-surface data-[state=active]:text-primary-dark",
                "text-slate-500 hover:text-slate-900",
              )}
            >
              Comissoes
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      ) : null}

      {vista === "comissoes" && mostrarTabComissoes ? (
        <FinanceiroAdmin mes={mes} ano={ano} />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Tabs.Root
              value={tipo}
              onValueChange={handleTipoChange}
              className="flex-1"
            >
              <Tabs.List
                className="inline-flex w-full rounded-lg border border-slate-200 bg-white p-1"
                aria-label="Tipo de lançamento"
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
                filtrosAbertos &&
                  "border-primary text-primary-dark bg-primary-surface",
              )}
            >
              <Filter size={14} strokeWidth={1.5} aria-hidden="true" />
              Filtros
            </button>
          </div>

          {filtrosAbertos ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="block text-[14px] font-medium text-slate-900">
                  Mês
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
                <label className="block text-[14px] font-medium text-slate-900">
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
                <label className="block text-[14px] font-medium text-slate-900">
                  Forma de pagamento
                </label>
                <select
                  value={formaPagamento}
                  onChange={(e) =>
                    handleFormaChange(
                      e.target.value as FormaPagamento | "todos",
                    )
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
                <label className="block text-[14px] font-medium text-slate-900">
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
            className={
              isPending ? "opacity-60 transition-opacity" : "transition-opacity"
            }
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
        </>
      )}

      <FormLancamento
        open={modalAberto}
        onOpenChange={setModalAberto}
        onCreated={handleAtualizado}
        pacientes={pacientes}
      />

      <button
        type="button"
        aria-label="Novo lançamento"
        onClick={() => setModalAberto(true)}
        className="fixed right-4 bottom-[calc(56px+env(safe-area-inset-bottom)+16px)] lg:bottom-6 lg:right-6 h-14 w-14 rounded-full bg-primary text-white shadow-md hover:shadow-lg hover:bg-primary-dark transition flex items-center justify-center z-40"
      >
        <Plus size={24} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}

function FechamentoMesAnteriorCard({
  fechamento,
  expandido,
  onToggle,
}: {
  fechamento: ComissaoMensal;
  expandido: boolean;
  onToggle: () => void;
}) {
  const [anoStr, mesStr] = fechamento.mes_ano.split("-");
  const mesIdx = Math.max(0, Math.min(11, Number(mesStr) - 1));
  const titulo = `Fechamento ${MESES[mesIdx]} / ${anoStr}`;
  const isPago = fechamento.status === "pago";

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors rounded-lg hover:bg-slate-50"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">
            {titulo}
          </p>
          <p className="text-xs text-slate-500">
            Comissao: {formatCurrency(fechamento.total_comissao)} · Liquido:{" "}
            {formatCurrency(fechamento.valor_liquido)}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-[2px] text-[11px] font-medium",
            isPago
              ? "bg-[#D1FAE5] text-[#065F46]"
              : "bg-[#FEF3C7] text-[#92400E]",
          )}
        >
          {isPago ? "Pago" : "Pendente"}
        </span>
        {expandido ? (
          <ChevronUp size={16} strokeWidth={1.5} className="text-slate-500" />
        ) : (
          <ChevronDown size={16} strokeWidth={1.5} className="text-slate-500" />
        )}
      </button>
      {expandido ? (
        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 px-4 py-3 text-sm">
          <Linha
            label="Faturado"
            value={formatCurrency(fechamento.faturamento_bruto)}
            cor="text-[#16A34A]"
          />
          <Linha
            label="Comissao"
            value={formatCurrency(fechamento.total_comissao)}
            cor="text-[#92400E]"
          />
          <Linha
            label="Despesas"
            value={formatCurrency(fechamento.total_despesas)}
            cor="text-danger"
          />
          <Linha
            label="Lucro real"
            value={formatCurrency(fechamento.lucro_real)}
            cor="text-primary-dark"
          />
        </div>
      ) : null}
    </section>
  );
}

function Linha({
  label,
  value,
  cor,
}: {
  label: string;
  value: string;
  cor: string;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={cn("text-sm font-semibold", cor)}>{value}</p>
    </div>
  );
}

export default FinanceiroClient;
