"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, X, CalendarOff, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  criarBloqueio,
  excluirBloqueio,
  getBloqueiosEFeriados,
  type Bloqueio,
  type BloqueioTipo,
} from "@/actions/bloqueios";
import {
  criarFeriadoCustom,
  excluirFeriado,
} from "@/actions/feriados";
import type { FeriadoRow } from "@/lib/feriados-bloqueios";
import { BLOQUEIO_TIPOS, getBloqueioTipoMeta } from "@/lib/bloqueio-tipos";
import { cn } from "@/lib/utils";
import DateInputBR from "@/components/ui/DateInputBR";

const inputClass =
  "w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10";
const labelClass = "block text-[14px] font-medium text-slate-900";
const errorClass = "text-xs text-danger";

function formatarDataIsoExtenso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return format(dt, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
}

function formatarDataBR(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return format(dt, "dd/MM/yyyy", { locale: ptBR });
}

function formatarRangeBR(inicio: string, fim: string): string {
  if (inicio === fim) return formatarDataBR(inicio);
  return `${formatarDataBR(inicio)} a ${formatarDataBR(fim)}`;
}

function TabBloqueios() {
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [feriados, setFeriados] = useState<FeriadoRow[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const [openBloqueio, setOpenBloqueio] = useState(false);
  const [openFeriado, setOpenFeriado] = useState(false);

  const recarregar = useCallback(async () => {
    setErro(null);
    const result = await getBloqueiosEFeriados();
    if (!result.ok) {
      setErro(result.error);
      return;
    }
    setBloqueios(result.data.bloqueios);
    setFeriados(result.data.feriados);
  }, []);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      await recarregar();
      if (!cancelado) setCarregando(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [recarregar]);

  // Feriados nacionais sao informativos e nao aparecem na lista
  // (sao bloqueados automaticamente). Mostramos apenas customizados.
  const feriadosCustomFuturos = feriados.filter((f) => {
    const hoje = new Date().toISOString().slice(0, 10);
    if (f.data < hoje) return false;
    if (f.tipo === "nacional" || f.tenant_id === null) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        Bloqueie períodos de férias ou ausência e marque feriados próprios
        (municipais ou específicos da clínica). Pacientes não poderão agendar
        nessas datas no link público.
      </p>

      <div className="rounded-lg border border-primary/20 bg-primary-surface px-3 py-2 text-xs text-primary-dark">
        Feriados nacionais são bloqueados automaticamente na agenda e no
        agendamento online.
      </div>

      {erro ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {erro}
        </p>
      ) : null}

      {/* Bloqueios */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarOff
              size={16}
              strokeWidth={1.5}
              className="text-slate-500"
              aria-hidden="true"
            />
            <h2 className="text-sm font-semibold text-slate-900">
              Períodos bloqueados
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setOpenBloqueio(true)}
            className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors shrink-0"
          >
            <Plus size={14} strokeWidth={1.5} aria-hidden="true" />
            Novo bloqueio
          </button>
        </div>

        {carregando ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
            <p className="text-sm text-slate-500">Carregando...</p>
          </div>
        ) : bloqueios.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
            <p className="text-sm text-slate-500">
              Nenhum período bloqueado.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {bloqueios.map((b) => (
              <ItemBloqueio key={b.id} bloqueio={b} onChanged={recarregar} />
            ))}
          </ul>
        )}
      </section>

      {/* Feriados */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles
              size={16}
              strokeWidth={1.5}
              className="text-slate-500"
              aria-hidden="true"
            />
            <h2 className="text-sm font-semibold text-slate-900">
              Feriados customizados
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setOpenFeriado(true)}
            className="inline-flex items-center gap-1.5 rounded border border-primary px-3 py-2 text-sm font-medium text-primary-text hover:bg-primary-surface transition-colors shrink-0"
          >
            <Plus size={14} strokeWidth={1.5} aria-hidden="true" />
            Novo feriado
          </button>
        </div>

        {carregando ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
            <p className="text-sm text-slate-500">Carregando...</p>
          </div>
        ) : feriadosCustomFuturos.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
            <p className="text-sm text-slate-500">
              Nenhum feriado customizado cadastrado.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {feriadosCustomFuturos.map((f) => (
              <ItemFeriado key={f.id} feriado={f} onChanged={recarregar} />
            ))}
          </ul>
        )}
      </section>

      <DialogNovoBloqueio
        open={openBloqueio}
        onOpenChange={setOpenBloqueio}
        onSaved={recarregar}
      />

      <DialogNovoFeriado
        open={openFeriado}
        onOpenChange={setOpenFeriado}
        onSaved={recarregar}
      />
    </div>
  );
}

function ItemBloqueio({
  bloqueio,
  onChanged,
}: {
  bloqueio: Bloqueio;
  onChanged: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleExcluir = () => {
    setErro(null);
    if (!confirm("Excluir este bloqueio?")) return;
    startTransition(async () => {
      const result = await excluirBloqueio(bloqueio.id);
      if (!result.ok) {
        setErro(result.error);
        return;
      }
      onChanged();
    });
  };

  const meta = getBloqueioTipoMeta(bloqueio.tipo);
  const TipoIcon = meta.Icon;

  return (
    <li className="flex items-center gap-3 px-3 py-3 sm:px-4">
      <span
        aria-hidden="true"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-surface text-primary-dark"
      >
        <TipoIcon size={14} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-slate-900">
            {formatarRangeBR(bloqueio.data_inicio, bloqueio.data_fim)}
          </p>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
            {meta.label}
          </span>
        </div>
        {bloqueio.motivo ? (
          <p className="mt-0.5 text-xs text-slate-500 truncate">
            {bloqueio.motivo}
          </p>
        ) : null}
        {erro ? <p className={errorClass}>{erro}</p> : null}
      </div>

      <button
        type="button"
        onClick={handleExcluir}
        disabled={isPending}
        aria-label="Excluir bloqueio"
        className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
      >
        <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </li>
  );
}

function ItemFeriado({
  feriado,
  onChanged,
}: {
  feriado: FeriadoRow;
  onChanged: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isNacional = feriado.tipo === "nacional" || feriado.tenant_id === null;

  const handleExcluir = () => {
    if (isNacional) return;
    setErro(null);
    if (!confirm("Excluir este feriado?")) return;
    startTransition(async () => {
      try {
        await excluirFeriado(feriado.id);
        onChanged();
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const tipoLabel =
    feriado.tipo === "nacional"
      ? "Nacional"
      : feriado.tipo === "municipal"
        ? "Municipal"
        : "Personalizado";

  return (
    <li className="flex items-center gap-3 px-3 py-3 sm:px-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 truncate">
          {feriado.nome}
        </p>
        <p className="text-xs text-slate-500">
          {formatarDataIsoExtenso(feriado.data)}
          <span className="mx-1.5 text-slate-300">·</span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
              isNacional
                ? "bg-slate-100 text-slate-600"
                : "bg-primary-surface text-primary-dark",
            )}
          >
            {tipoLabel}
          </span>
        </p>
        {erro ? <p className={errorClass}>{erro}</p> : null}
      </div>

      {isNacional ? (
        <span className="text-[11px] text-slate-500">Não removível</span>
      ) : (
        <button
          type="button"
          onClick={handleExcluir}
          disabled={isPending}
          aria-label="Excluir feriado"
          className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
        >
          <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

const schemaBloqueio = z
  .object({
    tipo: z.enum(["ferias", "folga", "congresso", "licenca", "outro"]),
    data_inicio: z
      .string()
      .refine((s) => /^\d{4}-\d{2}-\d{2}$/.test(s), "Data inicial inválida"),
    data_fim: z
      .string()
      .refine((s) => /^\d{4}-\d{2}-\d{2}$/.test(s), "Data final inválida"),
    motivo: z.string().optional(),
  })
  .refine((d) => d.data_inicio <= d.data_fim, {
    message: "Data final deve ser maior ou igual à inicial",
    path: ["data_fim"],
  });

type FormBloqueioData = z.infer<typeof schemaBloqueio>;

function DialogNovoBloqueio({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormBloqueioData>({
    resolver: zodResolver(schemaBloqueio),
    mode: "onBlur",
    defaultValues: {
      tipo: "ferias",
      data_inicio: "",
      data_fim: "",
      motivo: "",
    },
  });

  const dataInicioWatch = watch("data_inicio");
  const dataFimWatch = watch("data_fim");

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      reset({ tipo: "ferias", data_inicio: "", data_fim: "", motivo: "" });
      setErro(null);
    }
    onOpenChange(next);
  };

  const onSubmit = (data: FormBloqueioData) => {
    setErro(null);
    startTransition(async () => {
      const result = await criarBloqueio({
        tipo: data.tipo as BloqueioTipo,
        data_inicio: data.data_inicio,
        data_fim: data.data_fim,
        motivo: data.motivo,
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
            "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[440px] md:max-w-[calc(100vw-32px)] md:rounded-2xl md:p-6",
          )}
        >
          <div className="md:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 shrink-0" />

          <div className="flex items-start justify-between gap-3 shrink-0">
            <Dialog.Title className="text-base font-semibold text-slate-900">
              Novo bloqueio
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
              <label className={labelClass}>Tipo *</label>
              <select {...register("tipo")} className={inputClass}>
                {BLOQUEIO_TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {errors.tipo ? (
                <p className={errorClass}>{errors.tipo.message}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <DateInputBR
                label="Início"
                required
                value={dataInicioWatch ?? ""}
                onChange={(iso) =>
                  setValue("data_inicio", iso, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
              />
              <DateInputBR
                label="Fim"
                required
                value={dataFimWatch ?? ""}
                onChange={(iso) =>
                  setValue("data_fim", iso, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
              />
            </div>
            {errors.data_inicio ? (
              <p className={errorClass}>{errors.data_inicio.message}</p>
            ) : null}
            {errors.data_fim ? (
              <p className={errorClass}>{errors.data_fim.message}</p>
            ) : null}

            <div className="space-y-1">
              <label className={labelClass}>Motivo (opcional)</label>
              <input
                {...register("motivo")}
                type="text"
                placeholder="Detalhe se necessário"
                maxLength={200}
                className={inputClass}
              />
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

const schemaFeriado = z.object({
  data: z
    .string()
    .refine((s) => /^\d{4}-\d{2}-\d{2}$/.test(s), "Data inválida"),
  nome: z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s.length >= 2, "Nome obrigatório"),
  tipo: z.enum(["municipal", "custom"]),
});

type FormFeriadoData = z.infer<typeof schemaFeriado>;

function DialogNovoFeriado({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormFeriadoData>({
    resolver: zodResolver(schemaFeriado),
    mode: "onBlur",
    defaultValues: { data: "", nome: "", tipo: "custom" },
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      reset({ data: "", nome: "", tipo: "custom" });
      setErro(null);
    }
    onOpenChange(next);
  };

  const onSubmit = (data: FormFeriadoData) => {
    setErro(null);
    startTransition(async () => {
      try {
        await criarFeriadoCustom({
          data: data.data,
          nome: data.nome,
          tipo: data.tipo,
        });
        handleOpenChange(false);
        onSaved();
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
      }
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
            "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[440px] md:max-w-[calc(100vw-32px)] md:rounded-2xl md:p-6",
          )}
        >
          <div className="md:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 shrink-0" />

          <div className="flex items-start justify-between gap-3 shrink-0">
            <Dialog.Title className="text-base font-semibold text-slate-900">
              Novo feriado
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
              <label className={labelClass}>Data *</label>
              <input
                {...register("data")}
                type="date"
                className={inputClass}
              />
              {errors.data ? (
                <p className={errorClass}>{errors.data.message}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Nome *</label>
              <input
                {...register("nome")}
                type="text"
                placeholder="Ex.: Aniversário da cidade"
                maxLength={100}
                className={inputClass}
              />
              {errors.nome ? (
                <p className={errorClass}>{errors.nome.message}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Tipo *</label>
              <select {...register("tipo")} className={inputClass}>
                <option value="custom">Personalizado</option>
                <option value="municipal">Municipal</option>
              </select>
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

export default TabBloqueios;
