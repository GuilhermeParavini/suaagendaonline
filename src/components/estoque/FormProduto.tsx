"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  criarProduto,
  atualizarProduto,
  type CategoriaEstoque,
  type ProdutoEstoque,
  type UnidadeEstoque,
} from "@/actions/estoque";
import {
  formatCurrencyInput,
  parseCurrency,
  formatCurrency,
} from "@/lib/masks";
import { cn } from "@/lib/utils";

const CATEGORIAS: { value: CategoriaEstoque; label: string }[] = [
  { value: "descartaveis", label: "Descartaveis" },
  { value: "equipamentos", label: "Equipamentos" },
  { value: "outros", label: "Outros" },
];

const UNIDADES: { value: UnidadeEstoque; label: string }[] = [
  { value: "unidade", label: "Unidade" },
  { value: "ml", label: "Mililitro (ml)" },
  { value: "litro", label: "Litro" },
  { value: "kg", label: "Quilograma (kg)" },
  { value: "pacote", label: "Pacote" },
  { value: "caixa", label: "Caixa" },
  { value: "rolo", label: "Rolo" },
  { value: "par", label: "Par" },
];

const formSchema = z.object({
  nome: z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s.length >= 2, "Nome obrigatorio"),
  categoria: z.enum(["descartaveis", "equipamentos", "outros"]),
  quantidade: z.string().refine((s) => {
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) && n >= 0;
  }, "Quantidade invalida"),
  quantidadeMinima: z.string().refine((s) => {
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) && n >= 0;
  }, "Minimo invalido"),
  unidade: z.enum([
    "unidade",
    "ml",
    "litro",
    "kg",
    "pacote",
    "caixa",
    "rolo",
    "par",
  ]),
  valorUnitario: z.string().optional(),
  fornecedorPadrao: z.string().optional(),
  observacoes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface FormProdutoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  produto?: ProdutoEstoque | null;
}

const inputClass =
  "w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10";
const labelClass = "block text-[13px] font-medium text-slate-700";
const errorClass = "text-xs text-danger";

function toQtdStr(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
}

function FormProduto({
  open,
  onOpenChange,
  onSaved,
  produto,
}: FormProdutoProps) {
  const [apiError, setApiError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(produto);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: {
      nome: "",
      categoria: "outros",
      quantidade: "0",
      quantidadeMinima: "0",
      unidade: "unidade",
      valorUnitario: "",
      fornecedorPadrao: "",
      observacoes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    setApiError(null);
    if (produto) {
      reset({
        nome: produto.nome,
        categoria: produto.categoria,
        quantidade: toQtdStr(produto.quantidade),
        quantidadeMinima: toQtdStr(produto.quantidade_minima),
        unidade: produto.unidade,
        valorUnitario:
          produto.valor_unitario === null
            ? ""
            : formatCurrency(produto.valor_unitario),
        fornecedorPadrao: produto.fornecedor_padrao ?? "",
        observacoes: produto.observacoes ?? "",
      });
    } else {
      reset({
        nome: "",
        categoria: "outros",
        quantidade: "0",
        quantidadeMinima: "0",
        unidade: "unidade",
        valorUnitario: "",
        fornecedorPadrao: "",
        observacoes: "",
      });
    }
  }, [open, produto, reset]);

  const handleOpenChange = (next: boolean) => {
    if (!next) setApiError(null);
    onOpenChange(next);
  };

  const onSubmit = (data: FormData) => {
    setApiError(null);
    const quantidade = Number(data.quantidade.replace(",", "."));
    const quantidadeMinima = Number(data.quantidadeMinima.replace(",", "."));
    const valorUnitario = data.valorUnitario
      ? parseCurrency(data.valorUnitario)
      : null;

    startTransition(async () => {
      if (isEdit && produto) {
        const result = await atualizarProduto(produto.id, {
          nome: data.nome,
          categoria: data.categoria,
          quantidadeMinima,
          unidade: data.unidade,
          valorUnitario,
          fornecedorPadrao: data.fornecedorPadrao?.trim() || null,
          observacoes: data.observacoes?.trim() || null,
        });
        if (!result.ok) {
          setApiError(result.error);
          return;
        }
      } else {
        const result = await criarProduto({
          nome: data.nome,
          categoria: data.categoria,
          quantidade,
          quantidadeMinima,
          unidade: data.unidade,
          valorUnitario,
          fornecedorPadrao: data.fornecedorPadrao?.trim() || null,
          observacoes: data.observacoes?.trim() || null,
        });
        if (!result.ok) {
          setApiError(result.error);
          return;
        }
      }
      handleOpenChange(false);
      onSaved();
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
            "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[520px] md:max-w-[calc(100vw-32px)] md:max-h-[90vh] md:rounded-2xl md:p-6",
          )}
        >
          <div className="md:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 shrink-0" />

          <div className="flex items-start justify-between gap-3 shrink-0">
            <Dialog.Title className="text-base font-semibold text-slate-900">
              {isEdit ? "Editar produto" : "Novo produto"}
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
            <div className="space-y-1">
              <label className={labelClass}>Nome *</label>
              <input
                {...register("nome")}
                type="text"
                placeholder="Ex.: Algodao, Bisturi, Luva"
                className={inputClass}
              />
              {errors.nome ? (
                <p className={errorClass}>{errors.nome.message}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelClass}>Categoria *</label>
                <select {...register("categoria")} className={inputClass}>
                  {CATEGORIAS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Unidade *</label>
                <select {...register("unidade")} className={inputClass}>
                  {UNIDADES.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelClass}>
                  {isEdit ? "Quantidade atual" : "Quantidade inicial"} *
                </label>
                <input
                  {...register("quantidade")}
                  type="text"
                  inputMode="decimal"
                  disabled={isEdit}
                  className={cn(inputClass, isEdit && "bg-slate-50 text-slate-500")}
                />
                {isEdit ? (
                  <p className="text-[11px] text-slate-500">
                    Use o botao + ou - na lista para movimentar.
                  </p>
                ) : null}
                {errors.quantidade ? (
                  <p className={errorClass}>{errors.quantidade.message}</p>
                ) : null}
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Quantidade minima *</label>
                <input
                  {...register("quantidadeMinima")}
                  type="text"
                  inputMode="decimal"
                  className={inputClass}
                />
                <p className="text-[11px] text-slate-500">
                  Alerta quando atingir este valor.
                </p>
                {errors.quantidadeMinima ? (
                  <p className={errorClass}>
                    {errors.quantidadeMinima.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Valor unitario</label>
              <input
                {...register("valorUnitario", {
                  onChange: (e) => {
                    setValue(
                      "valorUnitario",
                      formatCurrencyInput(e.target.value),
                      { shouldDirty: true },
                    );
                  },
                })}
                type="text"
                inputMode="numeric"
                placeholder="R$ 0,00"
                className={inputClass}
              />
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Fornecedor padrao</label>
              <input
                {...register("fornecedorPadrao")}
                type="text"
                maxLength={120}
                placeholder="Nome do fornecedor"
                className={inputClass}
              />
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Observacoes</label>
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
                {isPending ? "Salvando..." : isEdit ? "Salvar" : "Cadastrar"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default FormProduto;
