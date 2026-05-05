"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import {
  getComissoesMensais,
  getComissoesTenant,
  marcarComissaoPaga,
  recalcularFechamento,
  type ComissaoMensal,
  type ComissaoProfissionalComNome,
  type StatusComissaoMensal,
} from "@/actions/comissoes";
import { listarProfissionaisAtivosTenant } from "@/actions/equipe";
import MetricCard from "@/components/ui/MetricCard";
import { formatCurrency } from "@/lib/masks";
import { cn } from "@/lib/utils";

interface FinanceiroAdminProps {
  mes: number;
  ano: number;
}

const FORMAS_PAGAMENTO_OPTIONS: { value: string; label: string }[] = [
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "transferencia", label: "Transferência" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "outro", label: "Outro" },
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function mesAnoStr(mes: number, ano: number): string {
  return `${ano}-${pad2(mes)}`;
}

type LinhaTabela = {
  comissao: ComissaoProfissionalComNome;
  fechamento: ComissaoMensal | null;
};

const STATUS_LABEL: Record<StatusComissaoMensal, string> = {
  aberto: "Pendente",
  pago: "Pago",
  cancelado: "Cancelado",
};

function StatusPill({
  status,
  atrasado,
}: {
  status: StatusComissaoMensal;
  atrasado: boolean;
}) {
  if (status === "pago") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#D1FAE5] px-2 py-[2px] text-[11px] font-medium text-[#065F46]">
        <CheckCircle2 size={11} strokeWidth={2} aria-hidden="true" />
        Pago
      </span>
    );
  }
  if (atrasado) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#FEE2E2] px-2 py-[2px] text-[11px] font-medium text-[#991B1B]">
        <AlertTriangle size={11} strokeWidth={2} aria-hidden="true" />
        Atrasado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF3C7] px-2 py-[2px] text-[11px] font-medium text-[#92400E]">
      <Clock size={11} strokeWidth={2} aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

function FinanceiroAdmin({ mes, ano }: FinanceiroAdminProps) {
  const [profFiltro, setProfFiltro] = useState<string>("todos");
  const [profissionais, setProfissionais] = useState<
    { id: string; nome: string }[]
  >([]);
  const [comissoes, setComissoes] = useState<ComissaoProfissionalComNome[]>([]);
  const [fechamentos, setFechamentos] = useState<ComissaoMensal[]>([]);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [recalculando, startRecalc] = useTransition();

  const [pagamentoTarget, setPagamentoTarget] =
    useState<ComissaoMensal | null>(null);

  const ymd = mesAnoStr(mes, ano);

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    const [pr, cm, fm] = await Promise.all([
      listarProfissionaisAtivosTenant(),
      getComissoesTenant(),
      getComissoesMensais({ mesAno: ymd }),
    ]);
    if (pr.ok) setProfissionais(pr.data);
    if (cm.ok) setComissoes(cm.data);
    else setErro(cm.error);
    if (fm.ok) setFechamentos(fm.data);
    else setErro(fm.error);
    setCarregando(false);
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ymd]);

  const linhasTodas: LinhaTabela[] = useMemo(() => {
    const fechMap = new Map<string, ComissaoMensal>();
    for (const f of fechamentos) {
      fechMap.set(f.profissional_id, f);
    }
    return comissoes
      .filter((c) => c.ativo)
      .map((c) => ({
        comissao: c,
        fechamento: fechMap.get(c.profissional_id) ?? null,
      }));
  }, [comissoes, fechamentos]);

  const linhasFiltradas = useMemo(() => {
    if (profFiltro === "todos") return linhasTodas;
    return linhasTodas.filter((l) => l.comissao.profissional_id === profFiltro);
  }, [linhasTodas, profFiltro]);

  const totais = useMemo(() => {
    let faturamentoTotal = 0;
    let comissoesPendentes = 0;
    let fixosPendentes = 0;
    let receitaClinica = 0;
    for (const linha of linhasFiltradas) {
      const f = linha.fechamento;
      if (!f) continue;
      faturamentoTotal += f.faturamento_bruto;
      const fixo = f.valor_fixo_mensal;
      const percComissao = f.valor_comissao_percentual;
      if (f.status !== "pago") {
        comissoesPendentes += percComissao;
        fixosPendentes += fixo;
      }
      // Receita da clinica = faturamento - comissao percentual + fixo (clinica recebe fixo do prof)
      // Aqui interpretamos: clinica fica com (faturamento - total_comissao) + valor fixo do prof.
      // Como o "total_comissao" inclui o fixo do prof, valor_liquido ja eh o que sobra para a clinica
      // do percentual, e o fixo recebido pela clinica entra como "fixos_pendentes" ate ser pago.
      receitaClinica += (f.faturamento_bruto - f.valor_comissao_percentual);
    }
    return {
      faturamentoTotal,
      comissoesPendentes,
      fixosPendentes,
      receitaClinica,
    };
  }, [linhasFiltradas]);

  const handleRecalcular = () => {
    setOkMsg(null);
    setErro(null);
    startRecalc(async () => {
      const alvos = linhasTodas
        .filter(
          (l) =>
            profFiltro === "todos" ||
            l.comissao.profissional_id === profFiltro,
        )
        .map((l) => l.comissao.profissional_id);
      const erros: string[] = [];
      for (const profId of alvos) {
        const r = await recalcularFechamento(ymd, profId);
        if (!r.ok) erros.push(r.error);
      }
      if (erros.length > 0) {
        setErro(erros.join(" | "));
      } else {
        setOkMsg(
          `Fechamento recalculado para ${alvos.length} ${
            alvos.length === 1 ? "profissional" : "profissionais"
          }.`,
        );
        window.setTimeout(() => setOkMsg(null), 3000);
      }
      await carregar();
    });
  };

  const handlePagamentoSalvo = async () => {
    setPagamentoTarget(null);
    setOkMsg("Pagamento registrado.");
    window.setTimeout(() => setOkMsg(null), 3000);
    await carregar();
  };

  // Verifica se o mes selecionado esta no passado (para flag atrasado)
  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();
  const mesNoPassado =
    ano < anoAtual || (ano === anoAtual && mes < mesAtual);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Comissoes do mes
          </h2>
          <p className="text-xs text-slate-500">
            Visao consolidada da equipe (admin)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={profFiltro}
            onChange={(e) => setProfFiltro(e.target.value)}
            className="rounded border border-slate-200 bg-white px-2 py-2 text-sm"
          >
            <option value="todos">Todos profissionais</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleRecalcular}
            disabled={recalculando}
            className="inline-flex items-center gap-1.5 rounded border border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-primary-surface transition-colors disabled:opacity-50"
          >
            {recalculando ? (
              <Loader2
                size={14}
                strokeWidth={1.5}
                className="animate-spin"
                aria-hidden="true"
              />
            ) : (
              <RefreshCw size={14} strokeWidth={1.5} aria-hidden="true" />
            )}
            Recalcular
          </button>
        </div>
      </header>

      {okMsg ? (
        <p className="rounded border border-[#CCFBF1] bg-[#F0FDFA] px-3 py-2 text-xs font-medium text-[#115E59]">
          {okMsg}
        </p>
      ) : null}
      {erro ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {erro}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <MetricCard
          label="Faturamento total"
          value={
            <span className="text-primary-dark">
              {formatCurrency(totais.faturamentoTotal)}
            </span>
          }
        />
        <MetricCard
          label="Comissoes a pagar"
          value={
            <span className="text-[#92400E]">
              {formatCurrency(totais.comissoesPendentes)}
            </span>
          }
        />
        <MetricCard
          label="Fixos a receber"
          value={
            <span className="text-[#1E40AF]">
              {formatCurrency(totais.fixosPendentes)}
            </span>
          }
        />
        <MetricCard
          label="Receita clinica"
          value={
            <span className="text-[#16A34A]">
              {formatCurrency(totais.receitaClinica)}
            </span>
          }
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Profissional</th>
              <th className="px-3 py-2 text-right">Faturado</th>
              <th className="px-3 py-2 text-right">%</th>
              <th className="px-3 py-2 text-right">Comissao</th>
              <th className="px-3 py-2 text-right">Fixo</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {carregando && linhasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                  Carregando...
                </td>
              </tr>
            ) : linhasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                  Nenhum profissional com comissao configurada.
                </td>
              </tr>
            ) : (
              linhasFiltradas.map((linha) => {
                const f = linha.fechamento;
                const status: StatusComissaoMensal = f?.status ?? "aberto";
                const atrasado = status !== "pago" && mesNoPassado;
                return (
                  <tr
                    key={linha.comissao.profissional_id}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-3 py-2.5 text-slate-900">
                      <p className="font-medium">{linha.comissao.profissional.nome}</p>
                      {linha.comissao.profissional.especialidade ? (
                        <p className="text-[11px] text-slate-500">
                          {linha.comissao.profissional.especialidade}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-700">
                      {f ? formatCurrency(f.faturamento_bruto) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-700">
                      {f && f.percentual_aplicado > 0
                        ? `${String(f.percentual_aplicado).replace(".", ",")}%`
                        : linha.comissao.percentual > 0
                          ? `${String(linha.comissao.percentual).replace(".", ",")}%`
                          : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-700">
                      {f ? formatCurrency(f.valor_comissao_percentual) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-700">
                      {f ? formatCurrency(f.valor_fixo_mensal) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-900">
                      {f ? formatCurrency(f.total_comissao) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {f ? (
                        <StatusPill status={status} atrasado={atrasado} />
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          Sem fechamento
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {f && f.status !== "pago" ? (
                        <button
                          type="button"
                          onClick={() => setPagamentoTarget(f)}
                          className="rounded border border-primary px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary-surface transition-colors"
                        >
                          Marcar pago
                        </button>
                      ) : f && f.status === "pago" && f.data_pagamento ? (
                        <span className="text-[11px] text-slate-500">
                          {f.data_pagamento.slice(8, 10)}/
                          {f.data_pagamento.slice(5, 7)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagamentoTarget ? (
        <ModalMarcarPago
          key={pagamentoTarget.id}
          comissao={pagamentoTarget}
          onClose={() => setPagamentoTarget(null)}
          onSaved={handlePagamentoSalvo}
        />
      ) : null}
    </div>
  );
}

function ModalMarcarPago({
  comissao,
  onClose,
  onSaved,
}: {
  comissao: ComissaoMensal;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [forma, setForma] = useState<string>("pix");
  const [obs, setObs] = useState<string>("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startSalvar] = useTransition();

  const handleSalvar = () => {
    setErro(null);
    startSalvar(async () => {
      const r = await marcarComissaoPaga(comissao.id, forma, obs.trim());
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      onSaved();
    });
  };

  return (
    <Dialog.Root open={true} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className={cn(
            "fixed z-50 bg-white shadow-lg focus:outline-none flex flex-col",
            "inset-x-0 bottom-0 max-h-[92vh] rounded-t-2xl px-4 pt-5 pb-[max(env(safe-area-inset-bottom),16px)]",
            "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[460px] md:max-w-[calc(100vw-32px)] md:rounded-2xl md:p-6",
          )}
        >
          <div className="md:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 shrink-0" />
          <div className="flex items-start justify-between gap-3 shrink-0">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-900">
                Marcar como pago
              </Dialog.Title>
              <p className="text-xs text-slate-500">
                {comissao.profissional?.nome ?? "Profissional"} ·{" "}
                {comissao.mes_ano}
              </p>
            </div>
            <Dialog.Close
              aria-label="Fechar"
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
            >
              <X size={18} strokeWidth={1.5} />
            </Dialog.Close>
          </div>

          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Total a pagar</span>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(comissao.total_comissao)}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[13px] font-medium text-slate-700">
                Forma de pagamento *
              </label>
              <select
                value={forma}
                onChange={(e) => setForma(e.target.value)}
                className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {FORMAS_PAGAMENTO_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[13px] font-medium text-slate-700">
                Observacoes
              </label>
              <textarea
                rows={2}
                maxLength={500}
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Opcional"
                className="w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>

            {erro ? (
              <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {erro}
              </p>
            ) : null}
          </div>

          <div className="mt-4 flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:justify-end shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="rounded px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSalvar}
              disabled={salvando}
              className="inline-flex items-center justify-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
            >
              {salvando ? (
                <>
                  <Loader2
                    size={14}
                    strokeWidth={1.5}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                  Confirmando...
                </>
              ) : (
                "Confirmar pagamento"
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default FinanceiroAdmin;
