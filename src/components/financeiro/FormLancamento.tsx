"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  brDateToIso,
  formatCurrencyInput,
  formatDate,
  isValidDate,
  parseCurrency,
} from "@/lib/masks";
import {
  criarLancamento,
  type FinanceiroTipo,
  type FormaPagamento,
  type PacienteOption,
} from "@/actions/financeiro";
import { getConveniosExistentes } from "@/actions/pacientes";
import { cn } from "@/lib/utils";

const formaPagamentoOptions: { value: FormaPagamento; label: string }[] = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "convenio", label: "Convênio" },
  { value: "transferencia", label: "Transferência" },
  { value: "outro", label: "Outro" },
];

const CATEGORIAS_DESPESA = [
  "Produtos",
  "Equipamentos",
  "Descartaveis",
  "Aluguel",
  "Marketing",
  "Outros",
] as const;

const formSchema = z.object({
  tipo: z.enum(["receita", "despesa"]),
  descricao: z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s.length >= 2, "Descrição obrigatória"),
  valor: z
    .string()
    .refine((s) => parseCurrency(s) > 0, "Valor invalido"),
  forma_pagamento: z.string().optional(),
  data_lancamento: z
    .string()
    .min(1, "Data obrigatoria")
    .refine((s) => /^\d{2}\/\d{2}\/\d{4}$/.test(s) && isValidDate(s), "Data invalida"),
  categoria: z.string().optional(),
  categoria_despesa: z.string().optional(),
  fornecedor: z.string().optional(),
  pago: z.boolean(),
  paciente_id: z.string().optional(),
  convenio: z.string().optional(),
  observacoes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface FormLancamentoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  pacientes: PacienteOption[];
}

const inputClass =
  "w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10";
const labelClass = "block text-[13px] font-medium text-slate-700";
const errorClass = "text-xs text-danger";

function todayBR(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function FormLancamento({
  open,
  onOpenChange,
  onCreated,
  pacientes,
}: FormLancamentoProps) {
  const [apiError, setApiError] = useState<string | null>(null);
  const [convenios, setConvenios] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    (async () => {
      const r = await getConveniosExistentes();
      if (!cancelado && r.ok) setConvenios(r.data);
    })();
    return () => {
      cancelado = true;
    };
  }, [open]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: {
      tipo: "receita",
      descricao: "",
      valor: "",
      forma_pagamento: "",
      data_lancamento: todayBR(),
      categoria: "",
      categoria_despesa: "",
      fornecedor: "",
      pago: true,
      paciente_id: "",
      convenio: "",
      observacoes: "",
    },
  });

  const tipo = watch("tipo");
  const formaSelecionada = watch("forma_pagamento");
  const isConvenio = formaSelecionada === "convenio";

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      reset({
        tipo: "receita",
        descricao: "",
        valor: "",
        forma_pagamento: "",
        data_lancamento: todayBR(),
        categoria: "",
        pago: true,
        paciente_id: "",
        convenio: "",
        observacoes: "",
      });
      setApiError(null);
    }
    onOpenChange(next);
  };

  const handleTipoChange = (next: FinanceiroTipo) => {
    setValue("tipo", next, { shouldDirty: true });
    setValue("pago", next === "receita", { shouldDirty: true });
  };

  const onSubmit = (data: FormData) => {
    setApiError(null);
    const isoData = brDateToIso(data.data_lancamento);
    if (!isoData) {
      setApiError("Data invalida.");
      return;
    }
    const valorNumerico = parseCurrency(data.valor);
    const forma = data.forma_pagamento as FormaPagamento | "";

    const convenioVal =
      forma === "convenio" ? data.convenio?.trim() ?? "" : "";
    const obsBase = data.observacoes?.trim() ?? "";
    const obsCombinada = convenioVal
      ? [`Convênio: ${convenioVal}`, obsBase].filter(Boolean).join(" — ")
      : obsBase;

    startTransition(async () => {
      const result = await criarLancamento({
        tipo: data.tipo,
        descricao: data.descricao,
        valor: valorNumerico,
        forma_pagamento: forma || null,
        data_lancamento: isoData,
        pago: data.pago,
        categoria: data.categoria?.trim() || undefined,
        observacoes: obsCombinada || undefined,
        paciente_id: data.paciente_id?.trim() || null,
        categoria_despesa:
          data.tipo === "despesa"
            ? data.categoria_despesa?.trim() || null
            : null,
        fornecedor:
          data.tipo === "despesa" ? data.fornecedor?.trim() || null : null,
      });
      if (!result.ok) {
        setApiError(result.error);
        return;
      }
      handleOpenChange(false);
      onCreated();
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
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
            <Dialog.Title className="text-base font-semibold text-slate-900">
              Novo lançamento
            </Dialog.Title>
            <Dialog.Close
              aria-label="Fechar"
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
            >
              <X size={18} strokeWidth={1.5} />
            </Dialog.Close>
          </div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="mt-4 flex-1 overflow-y-auto space-y-4"
          >
            <div className="grid grid-cols-2 gap-2 rounded border border-slate-200 p-1">
              <button
                type="button"
                onClick={() => handleTipoChange("receita")}
                className={cn(
                  "rounded px-3 py-2 text-sm font-medium transition-colors",
                  tipo === "receita"
                    ? "bg-[#D1FAE5] text-[#065F46]"
                    : "text-slate-500 hover:bg-slate-50",
                )}
              >
                Receita
              </button>
              <button
                type="button"
                onClick={() => handleTipoChange("despesa")}
                className={cn(
                  "rounded px-3 py-2 text-sm font-medium transition-colors",
                  tipo === "despesa"
                    ? "bg-[#FEE2E2] text-[#991B1B]"
                    : "text-slate-500 hover:bg-slate-50",
                )}
              >
                Despesa
              </button>
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Descrição *</label>
              <input
                {...register("descricao")}
                type="text"
                placeholder="Ex.: consulta, aluguel, material"
                className={inputClass}
              />
              {errors.descricao ? (
                <p className={errorClass}>{errors.descricao.message}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelClass}>Valor *</label>
                <input
                  {...register("valor", {
                    onChange: (e) => {
                      setValue("valor", formatCurrencyInput(e.target.value), {
                        shouldDirty: true,
                      });
                    },
                  })}
                  type="text"
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  className={inputClass}
                />
                {errors.valor ? (
                  <p className={errorClass}>{errors.valor.message}</p>
                ) : null}
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Data *</label>
                <input
                  {...register("data_lancamento", {
                    onChange: (e) => {
                      setValue(
                        "data_lancamento",
                        formatDate(e.target.value),
                        { shouldDirty: true },
                      );
                    },
                  })}
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="DD/MM/AAAA"
                  className={inputClass}
                />
                {errors.data_lancamento ? (
                  <p className={errorClass}>{errors.data_lancamento.message}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Forma de pagamento</label>
              <select {...register("forma_pagamento")} className={inputClass}>
                <option value="">Selecione</option>
                {formaPagamentoOptions.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {isConvenio ? (
              <div className="space-y-1">
                <label className={labelClass}>Qual convênio?</label>
                <input
                  {...register("convenio")}
                  type="text"
                  list="convenios-financeiro"
                  autoComplete="off"
                  placeholder="Ex: Unimed, Bradesco Saude, SulAmerica"
                  className={inputClass}
                />
                <datalist id="convenios-financeiro">
                  {convenios.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            ) : null}

            {tipo === "receita" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={labelClass}>Categoria</label>
                  <input
                    {...register("categoria")}
                    type="text"
                    placeholder="Ex.: consulta, material"
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Vincular a paciente</label>
                  <select {...register("paciente_id")} className={inputClass}>
                    <option value="">Nenhum</option>
                    {pacientes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={labelClass}>Categoria</label>
                  <select
                    {...register("categoria_despesa")}
                    className={inputClass}
                  >
                    <option value="">Selecione</option>
                    {CATEGORIAS_DESPESA.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Fornecedor</label>
                  <input
                    {...register("fornecedor")}
                    type="text"
                    maxLength={120}
                    placeholder="Nome do fornecedor"
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...register("pago")}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
              />
              <span className="text-sm text-slate-700">Pago</span>
            </label>

            <div className="space-y-1">
              <label className={labelClass}>Observações</label>
              <textarea
                {...register("observacoes")}
                rows={2}
                maxLength={500}
                className={cn(inputClass, "resize-none")}
              />
            </div>

            {apiError ? (
              <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {apiError}
              </p>
            ) : null}

            <div className="pt-1 sticky bottom-0 bg-white">
              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isPending ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default FormLancamento;
