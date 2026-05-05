"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import {
  formatCurrency,
  formatCurrencyInput,
  parseCurrency,
} from "@/lib/masks";
import {
  criarPlano,
  type CriarPlanoInput,
  type TipoPlano,
} from "@/actions/planos-tratamento";
import {
  listarProcedimentosPainel,
  type ProcedimentoOpcao,
} from "@/actions/agendamentos";
import { cn } from "@/lib/utils";

interface FormPlanoTratamentoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pacienteId: string;
  onCriado: (info: {
    sessoesAgendadas: number;
    totalSessoes: number;
  }) => void;
}

const inputClass =
  "w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10";
const labelClass = "block text-[13px] font-medium text-slate-700";

const MENSAGEM_DEFAULT =
  "Voce esta conseguindo cuidar dos seus pes em casa?";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function somarDiasIso(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + dias);
  return date.toISOString().slice(0, 10);
}

function ddmmyyyy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function FormPlanoTratamento({
  open,
  onOpenChange,
  pacienteId,
  onCriado,
}: FormPlanoTratamentoProps) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoPlano>("avulso");
  const [procedimentos, setProcedimentos] = useState<ProcedimentoOpcao[]>([]);
  const [procedimentoId, setProcedimentoId] = useState<string>("");
  const [qtdSessoes, setQtdSessoes] = useState<string>("1");
  const [periodicidadeDias, setPeriodicidadeDias] = useState<string>("");
  const [valorPorSessao, setValorPorSessao] = useState<string>("");
  const [agendarAutomatico, setAgendarAutomatico] = useState(false);
  const [mensagemAutomatica, setMensagemAutomatica] = useState(false);
  const [mensagemTexto, setMensagemTexto] = useState(MENSAGEM_DEFAULT);
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startSalvar] = useTransition();

  // Reset on open
  useEffect(() => {
    if (open) {
      setNome("");
      setTipo("avulso");
      setProcedimentoId("");
      setQtdSessoes("1");
      setPeriodicidadeDias("");
      setValorPorSessao("");
      setAgendarAutomatico(false);
      setMensagemAutomatica(false);
      setMensagemTexto(MENSAGEM_DEFAULT);
      setObservacoes("");
      setErro(null);
    }
  }, [open]);

  // Carrega procedimentos uma vez
  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    (async () => {
      const r = await listarProcedimentosPainel();
      if (!cancelado && r.ok) setProcedimentos(r.data);
    })();
    return () => {
      cancelado = true;
    };
  }, [open]);

  // Forca qtd_sessoes = 1 quando avulso
  useEffect(() => {
    if (tipo === "avulso") {
      setQtdSessoes("1");
      setPeriodicidadeDias("");
    } else if (tipo === "mensal" && !periodicidadeDias) {
      setPeriodicidadeDias("30");
    } else if (tipo === "anual" && !periodicidadeDias) {
      setPeriodicidadeDias("30");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  const handleProcedimentoChange = (id: string) => {
    setProcedimentoId(id);
    if (!id) return;
    const proc = procedimentos.find((p) => p.id === id);
    if (proc && proc.valor !== null && proc.valor !== undefined) {
      setValorPorSessao(formatCurrency(Number(proc.valor)));
    }
  };

  const qtdNum = useMemo(() => {
    const n = Number(qtdSessoes);
    return Number.isFinite(n) ? Math.max(1, Math.round(n)) : 1;
  }, [qtdSessoes]);

  const valorNum = useMemo(() => parseCurrency(valorPorSessao), [valorPorSessao]);
  const valorTotal = qtdNum * valorNum;
  const periodicidadeNum = useMemo(() => {
    if (tipo === "avulso") return 0;
    const n = Number(periodicidadeDias);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  }, [periodicidadeDias, tipo]);

  const dataInicio = hojeIso();
  const dataFim = useMemo(() => {
    if (tipo === "avulso") return dataInicio;
    if (tipo === "anual") return somarDiasIso(dataInicio, 365);
    if (tipo === "mensal" && periodicidadeNum > 0) {
      return somarDiasIso(dataInicio, qtdNum * periodicidadeNum);
    }
    return dataInicio;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, qtdNum, periodicidadeNum]);

  const handleSubmit = () => {
    setErro(null);
    if (nome.trim().length < 2) {
      setErro("Nome do plano obrigatorio.");
      return;
    }
    if (valorNum <= 0) {
      setErro("Valor por sessao invalido.");
      return;
    }
    if (qtdNum < 1 || qtdNum > 365) {
      setErro("Quantidade de sessoes deve estar entre 1 e 365.");
      return;
    }
    if (
      (tipo === "mensal" || tipo === "anual") &&
      periodicidadeNum <= 0
    ) {
      setErro("Periodicidade obrigatoria.");
      return;
    }

    const payload: CriarPlanoInput = {
      pacienteId,
      nome: nome.trim(),
      tipo,
      qtdSessoes: qtdNum,
      periodicidadeDias: tipo === "avulso" ? null : periodicidadeNum,
      valorPorSessao: valorNum,
      procedimentoId: procedimentoId || null,
      agendarAutomatico,
      mensagemAutomatica,
      mensagemTexto: mensagemAutomatica ? mensagemTexto.trim() || null : null,
      observacoes: observacoes.trim() || null,
    };

    startSalvar(async () => {
      const r = await criarPlano(payload);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      const sessoesAgendadas = r.data.sessoes.filter(
        (s) => s.status === "agendada",
      ).length;
      onCriado({
        sessoesAgendadas,
        totalSessoes: r.data.sessoes.length,
      });
      onOpenChange(false);
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className={cn(
            "fixed z-50 bg-white shadow-lg focus:outline-none flex flex-col",
            "inset-x-0 bottom-0 max-h-[92vh] rounded-t-2xl px-4 pt-5 pb-[max(env(safe-area-inset-bottom),16px)]",
            "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[560px] md:max-w-[calc(100vw-32px)] md:max-h-[90vh] md:rounded-2xl md:p-6",
          )}
        >
          <div className="md:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 shrink-0" />
          <div className="flex items-start justify-between gap-3 shrink-0">
            <Dialog.Title className="text-base font-semibold text-slate-900">
              Novo plano de tratamento
            </Dialog.Title>
            <Dialog.Close
              aria-label="Fechar"
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
            >
              <X size={18} strokeWidth={1.5} />
            </Dialog.Close>
          </div>

          <div className="mt-4 flex-1 overflow-y-auto space-y-4">
            <div className="space-y-1">
              <label className={labelClass}>Nome do plano *</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Podoprofilaxia Anual"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Tipo *</label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { v: "avulso", lbl: "Avulso" },
                    { v: "mensal", lbl: "Mensal" },
                    { v: "anual", lbl: "Anual" },
                  ] as { v: TipoPlano; lbl: string }[]
                ).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setTipo(opt.v)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      tipo === opt.v
                        ? "border-primary bg-primary text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    {opt.lbl}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Procedimento vinculado</label>
              <select
                value={procedimentoId}
                onChange={(e) => handleProcedimentoChange(e.target.value)}
                className={inputClass}
              >
                <option value="">Nenhum</option>
                {procedimentos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} ({p.duracao_min} min)
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500">
                Selecionar um procedimento preenche o valor por sessao.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelClass}>Quantidade de sessoes *</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={qtdSessoes}
                  onChange={(e) => setQtdSessoes(e.target.value)}
                  disabled={tipo === "avulso"}
                  className={cn(
                    inputClass,
                    tipo === "avulso" && "bg-slate-50 text-slate-500",
                  )}
                />
              </div>

              {tipo !== "avulso" ? (
                <div className="space-y-1">
                  <label className={labelClass}>Periodicidade (dias) *</label>
                  <input
                    type="number"
                    min={1}
                    value={periodicidadeDias}
                    onChange={(e) => setPeriodicidadeDias(e.target.value)}
                    placeholder="30"
                    className={inputClass}
                  />
                  <p className="text-[11px] text-slate-500">
                    A cada quantos dias uma sessao.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelClass}>Valor por sessao *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={valorPorSessao}
                  onChange={(e) =>
                    setValorPorSessao(formatCurrencyInput(e.target.value))
                  }
                  placeholder="R$ 0,00"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Valor total</label>
                <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
                  {formatCurrency(valorTotal)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelClass}>Data de inicio</label>
                <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {ddmmyyyy(dataInicio)}
                </p>
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Data de fim</label>
                <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {ddmmyyyy(dataFim)}
                </p>
              </div>
            </div>

            <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-slate-200 bg-white p-3">
              <input
                type="checkbox"
                checked={agendarAutomatico}
                onChange={(e) => setAgendarAutomatico(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                disabled={!procedimentoId}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  Agendar sessoes automaticamente
                </p>
                <p className="text-[11px] text-slate-500">
                  O sistema tentara agendar cada sessao no primeiro horario
                  disponivel.
                  {!procedimentoId
                    ? " Requer procedimento vinculado."
                    : ""}
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-slate-200 bg-white p-3">
              <input
                type="checkbox"
                checked={mensagemAutomatica}
                onChange={(e) => setMensagemAutomatica(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  Mensagem automatica de acompanhamento
                </p>
                <p className="text-[11px] text-slate-500">
                  Envia mensagem ao paciente entre as sessoes.
                </p>
              </div>
            </label>

            {mensagemAutomatica ? (
              <div className="space-y-1">
                <label className={labelClass}>Mensagem personalizada</label>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={mensagemTexto}
                  onChange={(e) => setMensagemTexto(e.target.value)}
                  className={cn(inputClass, "resize-none")}
                />
              </div>
            ) : null}

            <div className="space-y-1">
              <label className={labelClass}>Observacoes</label>
              <textarea
                rows={2}
                maxLength={1000}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Detalhes do plano, combinados com paciente..."
                className={cn(inputClass, "resize-none")}
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
              onClick={() => onOpenChange(false)}
              disabled={salvando}
              className="rounded px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
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
                  Criando...
                </>
              ) : (
                "Criar plano"
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default FormPlanoTratamento;
