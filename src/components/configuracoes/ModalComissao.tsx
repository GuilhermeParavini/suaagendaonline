"use client";

import { useEffect, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import {
  getComissaoProfissional,
  salvarComissao,
  type IncideSobreComissao,
  type TipoCobrancaComissao,
} from "@/actions/comissoes";
import {
  formatCurrency,
  formatCurrencyInput,
  parseCurrency,
} from "@/lib/masks";
import { cn } from "@/lib/utils";

interface ModalComissaoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profissional: { id: string; nome: string };
  onSaved?: () => void;
}

const inputClass =
  "w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10";
const labelClass = "block text-[14px] font-medium text-slate-900";

function ModalComissao({
  open,
  onOpenChange,
  profissional,
  onSaved,
}: ModalComissaoProps) {
  const [tipoCobranca, setTipoCobranca] =
    useState<TipoCobrancaComissao>("percentual");
  const [percentual, setPercentual] = useState<string>("");
  const [valorFixo, setValorFixo] = useState<string>("");
  const [incideSobre, setIncideSobre] =
    useState<IncideSobreComissao>("atendimentos");
  const [observacoes, setObservacoes] = useState<string>("");
  const [ativo, setAtivo] = useState<boolean>(true);
  const [carregando, setCarregando] = useState<boolean>(false);
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [salvando, startSalvar] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    setErro(null);
    setOkMsg(null);
    setCarregando(true);
    (async () => {
      const r = await getComissaoProfissional(profissional.id);
      if (cancelado) return;
      setCarregando(false);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      const cfg = r.data;
      if (cfg) {
        setTipoCobranca(cfg.tipo_cobranca);
        setPercentual(
          cfg.percentual > 0 ? String(cfg.percentual).replace(".", ",") : "",
        );
        setValorFixo(
          cfg.valor_fixo_mensal > 0
            ? formatCurrency(cfg.valor_fixo_mensal)
            : "",
        );
        setIncideSobre(cfg.incide_sobre);
        setObservacoes(cfg.observacoes ?? "");
        setAtivo(cfg.ativo);
      } else {
        setTipoCobranca("percentual");
        setPercentual("");
        setValorFixo("");
        setIncideSobre("atendimentos");
        setObservacoes("");
        setAtivo(true);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [open, profissional.id]);

  const usaPercentual = tipoCobranca === "percentual" || tipoCobranca === "misto";
  const usaFixo = tipoCobranca === "fixo" || tipoCobranca === "misto";

  const handlePercentualChange = (raw: string) => {
    const onlyDigits = raw.replace(/[^0-9,.]/g, "");
    setPercentual(onlyDigits);
  };

  const handleSalvar = () => {
    setErro(null);
    setOkMsg(null);

    const percNum = usaPercentual
      ? Number(percentual.replace(",", "."))
      : 0;
    if (usaPercentual) {
      if (!Number.isFinite(percNum) || percNum < 0 || percNum > 100) {
        setErro("Percentual deve estar entre 0 e 100.");
        return;
      }
    }
    const valorFixoNum = usaFixo ? parseCurrency(valorFixo) : 0;
    if (usaFixo && (!Number.isFinite(valorFixoNum) || valorFixoNum < 0)) {
      setErro("Valor fixo invalido.");
      return;
    }

    startSalvar(async () => {
      const r = await salvarComissao({
        profissionalId: profissional.id,
        tipoCobranca,
        percentual: percNum,
        valorFixoMensal: valorFixoNum,
        incideSobre,
        ativo,
        observacoes: observacoes.trim() || undefined,
      });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setOkMsg("Comissao salva.");
      onSaved?.();
      window.setTimeout(() => onOpenChange(false), 600);
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
            "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[520px] md:max-w-[calc(100vw-32px)] md:max-h-[90vh] md:rounded-2xl md:p-6",
          )}
        >
          <div className="md:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 shrink-0" />

          <div className="flex items-start justify-between gap-3 shrink-0">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-900">
                Comissao
              </Dialog.Title>
              <p className="text-xs text-slate-500">{profissional.nome}</p>
            </div>
            <Dialog.Close
              aria-label="Fechar"
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
            >
              <X size={18} strokeWidth={1.5} />
            </Dialog.Close>
          </div>

          <div className="mt-4 flex-1 overflow-y-auto space-y-4">
            {carregando ? (
              <p className="text-sm text-slate-500">Carregando...</p>
            ) : (
              <>
                <div className="space-y-2">
                  <label className={labelClass}>Tipo de cobranca</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(
                      [
                        { v: "percentual", lbl: "Percentual" },
                        { v: "fixo", lbl: "Valor fixo mensal" },
                        { v: "misto", lbl: "Misto (% + fixo)" },
                      ] as { v: TipoCobrancaComissao; lbl: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setTipoCobranca(opt.v)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                          tipoCobranca === opt.v
                            ? "border-primary bg-primary-surface text-primary-dark"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                        )}
                      >
                        {opt.lbl}
                      </button>
                    ))}
                  </div>
                </div>

                {usaPercentual ? (
                  <div className="space-y-1">
                    <label className={labelClass}>Percentual (%)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={percentual}
                      onChange={(e) => handlePercentualChange(e.target.value)}
                      placeholder="Ex: 30"
                      maxLength={6}
                      className={inputClass}
                    />
                    <p className="text-[11px] text-slate-500">
                      Entre 0 e 100. Use virgula para decimais.
                    </p>
                  </div>
                ) : null}

                {usaFixo ? (
                  <div className="space-y-1">
                    <label className={labelClass}>Valor fixo mensal</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={valorFixo}
                      onChange={(e) =>
                        setValorFixo(formatCurrencyInput(e.target.value))
                      }
                      placeholder="R$ 0,00"
                      className={inputClass}
                    />
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label className={labelClass}>Incide sobre</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(
                      [
                        {
                          v: "atendimentos",
                          lbl: "Apenas atendimentos",
                          hint: "Receitas com agendamento vinculado",
                        },
                        {
                          v: "tudo",
                          lbl: "Todo faturamento",
                          hint: "Inclui produtos e outros lancamentos",
                        },
                      ] as {
                        v: IncideSobreComissao;
                        lbl: string;
                        hint: string;
                      }[]
                    ).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setIncideSobre(opt.v)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-left transition-colors",
                          incideSobre === opt.v
                            ? "border-primary bg-primary-surface"
                            : "border-slate-200 bg-white hover:bg-slate-50",
                        )}
                      >
                        <p
                          className={cn(
                            "text-sm font-medium",
                            incideSobre === opt.v
                              ? "text-primary-dark"
                              : "text-slate-700",
                          )}
                        >
                          {opt.lbl}
                        </p>
                        <p className="text-[11px] text-slate-500">{opt.hint}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Observacoes</label>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Ex: Negociado em maio/2026, revisao em nov/2026"
                    className={cn(inputClass, "resize-none")}
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ativo}
                    onChange={(e) => setAtivo(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-primary-text focus:ring-primary/40"
                  />
                  <span className="text-sm text-slate-700">Ativo</span>
                </label>

                {erro ? (
                  <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {erro}
                  </p>
                ) : null}
                {okMsg ? (
                  <p className="rounded border border-[#CCFBF1] bg-[#F0FDFA] px-3 py-2 text-xs font-medium text-[#115E59]">
                    {okMsg}
                  </p>
                ) : null}
              </>
            )}
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
              onClick={handleSalvar}
              disabled={salvando || carregando}
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
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default ModalComissao;
