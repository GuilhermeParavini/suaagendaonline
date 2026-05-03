"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  brDateToIso,
  cleanCEP,
  cleanPhone,
  formatCEP,
  formatCPF,
  formatDate,
  formatPhone,
  isoToBrDate,
  isValidDate,
} from "@/lib/masks";
import { calculateAge, isValidBirthDate, validateCPF } from "@/lib/validators";
import {
  atualizarPaciente,
  type Genero,
  type GrauParentesco,
} from "@/actions/pacientes";
import { cn } from "@/lib/utils";
import type {
  PacienteDetalhe,
  ResponsavelDetalhe,
} from "./FichaPaciente";

const brazilianStates = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const generoOptions: { value: Genero; label: string }[] = [
  { value: "masculino", label: "Masculino" },
  { value: "feminino", label: "Feminino" },
  { value: "prefiro_nao_informar", label: "Prefiro não informar" },
];

const parentescoOptions: { value: GrauParentesco; label: string }[] = [
  { value: "mae", label: "Mãe" },
  { value: "pai", label: "Pai" },
  { value: "avo", label: "Avô(ó)" },
  { value: "tio", label: "Tio(a)" },
  { value: "outro", label: "Outro" },
];

const phoneSchema = z.string().refine((s) => {
  const d = cleanPhone(s);
  return d.length === 10 || d.length === 11;
}, "Telefone inválido");

const requiredEmailSchema = z
  .string()
  .transform((s) => s.trim())
  .refine((s) => s.length > 0, "E-mail obrigatório")
  .refine((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s), "E-mail inválido");

const formSchema = z
  .object({
    nome: z
      .string()
      .transform((s) => s.trim())
      .refine((s) => s.length >= 3, "Nome deve ter no mínimo 3 caracteres"),
    data_nascimento: z
      .string()
      .min(1, "Data de nascimento obrigatória")
      .refine(
        (s) => /^\d{2}\/\d{2}\/\d{4}$/.test(s) && isValidDate(s),
        "Data inválida",
      )
      .refine((s) => {
        const iso = brDateToIso(s);
        return iso !== null && isValidBirthDate(iso);
      }, "Data de nascimento inválida"),
    genero: z.enum(["masculino", "feminino", "prefiro_nao_informar"]),
    telefone: phoneSchema,
    email: requiredEmailSchema,
    endereco: z.string().optional(),
    cidade: z.string().optional(),
    estado: z.string().optional(),
    cep: z
      .string()
      .optional()
      .refine(
        (s) => !s || cleanCEP(s).length === 0 || cleanCEP(s).length === 8,
        "CEP inválido",
      ),
    convenio: z.string().optional(),
    observacoes: z.string().optional(),
    resp_nome: z.string().optional(),
    resp_cpf: z.string().optional(),
    resp_telefone: z.string().optional(),
    resp_email: z.string().optional(),
    resp_grau: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const iso = brDateToIso(data.data_nascimento ?? "");
    if (!iso || !isValidBirthDate(iso)) return;
    const age = calculateAge(iso);
    if (age === null || age >= 18) return;

    if (!data.resp_nome || data.resp_nome.trim().length < 3) {
      ctx.addIssue({
        code: "custom",
        path: ["resp_nome"],
        message: "Nome do responsável deve ter no mínimo 3 caracteres",
      });
    }
    if (!data.resp_cpf || !validateCPF(data.resp_cpf)) {
      ctx.addIssue({
        code: "custom",
        path: ["resp_cpf"],
        message: "CPF do responsável inválido",
      });
    }
    const respTel = cleanPhone(data.resp_telefone ?? "");
    if (respTel.length !== 10 && respTel.length !== 11) {
      ctx.addIssue({
        code: "custom",
        path: ["resp_telefone"],
        message: "Telefone do responsável inválido",
      });
    }
    if (
      data.resp_email &&
      data.resp_email.trim() !== "" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.resp_email.trim())
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["resp_email"],
        message: "E-mail do responsável inválido",
      });
    }
    if (
      !data.resp_grau ||
      !["mae", "pai", "avo", "tio", "outro"].includes(data.resp_grau)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["resp_grau"],
        message: "Selecione o grau de parentesco",
      });
    }
  });

type FormData = z.infer<typeof formSchema>;

interface EditarPacienteModalProps {
  paciente: PacienteDetalhe;
  responsavel: ResponsavelDetalhe | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const inputClass =
  "w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed";
const labelClass = "block text-[13px] font-medium text-slate-700";
const errorClass = "text-xs text-danger";

function EditarPacienteModal({
  paciente,
  responsavel,
  open,
  onOpenChange,
}: EditarPacienteModalProps) {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);
  const [confirmRemoverResp, setConfirmRemoverResp] = useState<
    FormData | null
  >(null);
  const [isPending, startTransition] = useTransition();

  const defaults: FormData = {
    nome: paciente.nome,
    data_nascimento: isoToBrDate(paciente.data_nascimento),
    genero: paciente.genero,
    telefone: paciente.telefone ? formatPhone(paciente.telefone) : "",
    email: paciente.email ?? "",
    endereco: paciente.endereco ?? "",
    cidade: paciente.cidade ?? "",
    estado: paciente.estado ?? "",
    cep: paciente.cep ? formatCEP(paciente.cep) : "",
    convenio: paciente.convenio ?? "",
    observacoes: paciente.observacoes ?? "",
    resp_nome: responsavel?.nome ?? "",
    resp_cpf: responsavel ? formatCPF(responsavel.cpf) : "",
    resp_telefone: responsavel ? formatPhone(responsavel.telefone) : "",
    resp_email: responsavel?.email ?? "",
    resp_grau: responsavel?.grau_parentesco ?? "",
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: defaults,
  });

  const dataNasc = watch("data_nascimento");
  const dataNascIso = dataNasc ? brDateToIso(dataNasc) : null;
  const idade =
    dataNascIso && isValidBirthDate(dataNascIso) ? calculateAge(dataNascIso) : null;
  const showResponsavel = idade !== null && idade < 18;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      reset(defaults);
      setApiError(null);
      setConfirmRemoverResp(null);
    }
    onOpenChange(next);
  };

  const handleMaskedChange =
    (field: keyof FormData, formatter: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(field, formatter(e.target.value), {
        shouldValidate: false,
        shouldDirty: true,
      });
    };

  const submitToServer = (data: FormData) => {
    setApiError(null);
    const isoNascimento = brDateToIso(data.data_nascimento);
    if (!isoNascimento) {
      setApiError("Data de nascimento inválida.");
      return;
    }

    startTransition(async () => {
      const result = await atualizarPaciente(paciente.id, {
        nome: data.nome,
        data_nascimento: isoNascimento,
        genero: data.genero,
        telefone: data.telefone,
        email: data.email.trim(),
        endereco: data.endereco?.trim() || undefined,
        cidade: data.cidade?.trim() || undefined,
        estado: data.estado?.trim() || undefined,
        cep: data.cep?.trim() || undefined,
        convenio: data.convenio?.trim() || undefined,
        observacoes: data.observacoes?.trim() || undefined,
        responsavel: showResponsavel
          ? {
              nome: data.resp_nome ?? "",
              cpf: data.resp_cpf ?? "",
              telefone: data.resp_telefone ?? "",
              email: data.resp_email?.trim() || undefined,
              grau_parentesco: (data.resp_grau ?? "outro") as GrauParentesco,
            }
          : null,
      });

      if (!result.ok) {
        setApiError(result.error);
        return;
      }
      handleOpenChange(false);
      router.refresh();
    });
  };

  const onSubmit = (data: FormData) => {
    if (paciente.menor_idade && !showResponsavel) {
      setConfirmRemoverResp(data);
      return;
    }
    submitToServer(data);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className={cn(
            "fixed z-50 bg-white shadow-lg focus:outline-none flex flex-col",
            "inset-x-0 bottom-0 max-h-[92vh] rounded-t-2xl px-4 pt-5 pb-[max(env(safe-area-inset-bottom),16px)]",
            "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[640px] md:max-w-[calc(100vw-32px)] md:max-h-[90vh] md:rounded-2xl md:p-6",
          )}
        >
          <div className="md:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 shrink-0" />

          <div className="flex items-start justify-between gap-3 shrink-0">
            <Dialog.Title className="text-base font-semibold text-slate-900">
              Editar paciente
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
            autoComplete="off"
            className="mt-4 flex-1 overflow-y-auto space-y-5"
          >
            <fieldset className="space-y-3">
              <legend className="text-[13px] font-medium text-slate-500">
                Dados pessoais
              </legend>

              <div className="space-y-1">
                <label className={labelClass}>Nome completo *</label>
                <input
                  {...register("nome")}
                  type="text"
                  placeholder="Maria Silva"
                  className={inputClass}
                />
                {errors.nome ? (
                  <p className={errorClass}>{errors.nome.message}</p>
                ) : null}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={labelClass}>CPF</label>
                  <input
                    type="text"
                    value={formatCPF(paciente.cpf)}
                    disabled
                    className={inputClass}
                  />
                  <p className="text-[11px] text-slate-500">
                    CPF não pode ser alterado
                  </p>
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Data de nascimento *</label>
                  <div className="flex items-center gap-2">
                    <input
                      {...register("data_nascimento", {
                        onChange: handleMaskedChange(
                          "data_nascimento",
                          formatDate,
                        ),
                      })}
                      type="text"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="DD/MM/AAAA"
                      className={inputClass}
                    />
                    {idade !== null && idade >= 0 ? (
                      <span className="shrink-0 text-xs text-slate-500">
                        {idade} {idade === 1 ? "ano" : "anos"}
                      </span>
                    ) : null}
                  </div>
                  {errors.data_nascimento ? (
                    <p className={errorClass}>
                      {errors.data_nascimento.message}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={labelClass}>Gênero *</label>
                  <select {...register("genero")} className={inputClass}>
                    {generoOptions.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Telefone *</label>
                  <input
                    {...register("telefone", {
                      onChange: handleMaskedChange("telefone", formatPhone),
                    })}
                    type="tel"
                    inputMode="tel"
                    maxLength={15}
                    placeholder="(11) 99999-9999"
                    className={inputClass}
                  />
                  {errors.telefone ? (
                    <p className={errorClass}>{errors.telefone.message}</p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-1">
                <label className={labelClass}>E-mail *</label>
                <input
                  {...register("email")}
                  type="email"
                  placeholder="maria@email.com"
                  className={inputClass}
                />
                {errors.email ? (
                  <p className={errorClass}>{errors.email.message}</p>
                ) : null}
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Convênio</label>
                <input
                  {...register("convenio")}
                  type="text"
                  placeholder="Ex.: Unimed, particular"
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Observações</label>
                <textarea
                  {...register("observacoes")}
                  rows={3}
                  maxLength={1000}
                  className={`${inputClass} resize-none`}
                />
              </div>
            </fieldset>

            {showResponsavel ? (
              <fieldset className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                <legend className="px-2 text-[13px] font-medium text-amber-800">
                  Responsável legal (paciente menor de idade)
                </legend>

                <div className="space-y-1">
                  <label className={labelClass}>Nome do responsável *</label>
                  <input
                    {...register("resp_nome")}
                    type="text"
                    placeholder="Carla Costa"
                    className={inputClass}
                  />
                  {errors.resp_nome ? (
                    <p className={errorClass}>{errors.resp_nome.message}</p>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className={labelClass}>CPF do responsável *</label>
                    <input
                      {...register("resp_cpf", {
                        onChange: handleMaskedChange("resp_cpf", formatCPF),
                      })}
                      type="text"
                      inputMode="numeric"
                      maxLength={14}
                      placeholder="000.000.000-00"
                      className={inputClass}
                    />
                    {errors.resp_cpf ? (
                      <p className={errorClass}>{errors.resp_cpf.message}</p>
                    ) : null}
                  </div>

                  <div className="space-y-1">
                    <label className={labelClass}>
                      Telefone do responsável *
                    </label>
                    <input
                      {...register("resp_telefone", {
                        onChange: handleMaskedChange(
                          "resp_telefone",
                          formatPhone,
                        ),
                      })}
                      type="tel"
                      inputMode="tel"
                      maxLength={15}
                      placeholder="(11) 99999-9999"
                      className={inputClass}
                    />
                    {errors.resp_telefone ? (
                      <p className={errorClass}>
                        {errors.resp_telefone.message}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className={labelClass}>E-mail do responsável</label>
                    <input
                      {...register("resp_email")}
                      type="email"
                      placeholder="responsavel@email.com"
                      className={inputClass}
                    />
                    {errors.resp_email ? (
                      <p className={errorClass}>{errors.resp_email.message}</p>
                    ) : null}
                  </div>

                  <div className="space-y-1">
                    <label className={labelClass}>Grau de parentesco *</label>
                    <select {...register("resp_grau")} className={inputClass}>
                      <option value="">Selecione</option>
                      {parentescoOptions.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    {errors.resp_grau ? (
                      <p className={errorClass}>{errors.resp_grau.message}</p>
                    ) : null}
                  </div>
                </div>
              </fieldset>
            ) : null}

            <fieldset className="space-y-3">
              <legend className="text-[13px] font-medium text-slate-500">
                Endereço
              </legend>

              <div className="space-y-1">
                <label className={labelClass}>Endereço</label>
                <input
                  {...register("endereco")}
                  type="text"
                  placeholder="Rua, número, complemento"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className={labelClass}>CEP</label>
                  <input
                    {...register("cep", {
                      onChange: handleMaskedChange("cep", formatCEP),
                    })}
                    type="text"
                    inputMode="numeric"
                    maxLength={9}
                    placeholder="00000-000"
                    className={inputClass}
                  />
                  {errors.cep ? (
                    <p className={errorClass}>{errors.cep.message}</p>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Cidade</label>
                  <input
                    {...register("cidade")}
                    type="text"
                    placeholder="São Paulo"
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Estado</label>
                  <select {...register("estado")} className={inputClass}>
                    <option value="">UF</option>
                    {brazilianStates.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </fieldset>

            {confirmRemoverResp ? (
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-2">
                <p>
                  Este paciente passou a ser maior de idade. Os dados do
                  responsável serão removidos. Deseja continuar?
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setConfirmRemoverResp(null)}
                    className="rounded px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const data = confirmRemoverResp;
                      setConfirmRemoverResp(null);
                      submitToServer(data);
                    }}
                    className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            ) : null}

            {apiError ? (
              <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {apiError}
              </p>
            ) : null}

            <div className="sticky bottom-0 -mx-4 md:mx-0 bg-white pt-3 px-4 md:px-0 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
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
                className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
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

export default EditarPacienteModal;
