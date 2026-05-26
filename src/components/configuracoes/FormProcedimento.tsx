"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  atualizarProcedimento,
  criarProcedimento,
} from "@/actions/configuracoes";
import type { Procedimento } from "@/lib/configuracoes-types";
import { formatCurrency, formatCurrencyInput, parseCurrency } from "@/lib/masks";
import { cn } from "@/lib/utils";

const schema = z.object({
  nome: z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s.length >= 2, "Nome obrigatório"),
  duracao_min: z
    .string()
    .refine((s) => {
      const n = Number(s);
      return Number.isInteger(n) && n > 0 && n <= 600;
    }, "Duração inválida"),
  valor: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface FormProcedimentoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  procedimento: Procedimento | null;
  onSaved: () => void;
}

const inputClass =
  "w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10";
const labelClass = "block text-[14px] font-medium text-slate-900";
const errorClass = "text-xs text-danger";

function FormProcedimento({
  open,
  onOpenChange,
  procedimento,
  onSaved,
}: FormProcedimentoProps) {
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const editando = procedimento !== null;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      nome: procedimento?.nome ?? "",
      duracao_min: String(procedimento?.duracao_min ?? 30),
      valor:
        procedimento?.valor !== null && procedimento?.valor !== undefined
          ? formatCurrency(procedimento.valor)
          : "",
    },
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      reset({
        nome: procedimento?.nome ?? "",
        duracao_min: String(procedimento?.duracao_min ?? 30),
        valor:
          procedimento?.valor !== null && procedimento?.valor !== undefined
            ? formatCurrency(procedimento.valor)
            : "",
      });
      setErro(null);
    }
    onOpenChange(next);
  };

  const onSubmit = (data: FormData) => {
    setErro(null);
    const valor = data.valor ? parseCurrency(data.valor) : null;
    const duracao = Number(data.duracao_min);

    startTransition(async () => {
      const result = editando
        ? await atualizarProcedimento(procedimento.id, {
            nome: data.nome,
            duracao_min: duracao,
            valor,
          })
        : await criarProcedimento({
            nome: data.nome,
            duracao_min: duracao,
            valor,
          });
      if (!result.ok) {
        setErro(result.error);
        return;
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
            "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[420px] md:max-w-[calc(100vw-32px)] md:rounded-2xl md:p-6",
          )}
        >
          <div className="md:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 shrink-0" />

          <div className="flex items-start justify-between gap-3 shrink-0">
            <Dialog.Title className="text-base font-semibold text-slate-900">
              {editando ? "Editar procedimento" : "Novo procedimento"}
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
            className="mt-4 space-y-4 overflow-y-auto"
          >
            <div className="space-y-1">
              <label className={labelClass}>Nome *</label>
              <input
                {...register("nome")}
                type="text"
                placeholder="Ex.: Avaliação fisioterapêutica"
                className={inputClass}
              />
              {errors.nome ? (
                <p className={errorClass}>{errors.nome.message}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelClass}>Duração (min) *</label>
                <input
                  {...register("duracao_min")}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={600}
                  className={inputClass}
                />
                {errors.duracao_min ? (
                  <p className={errorClass}>{errors.duracao_min.message}</p>
                ) : null}
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Valor</label>
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
              </div>
            </div>

            {erro ? (
              <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {erro}
              </p>
            ) : null}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
                className="rounded px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
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

export default FormProcedimento;
