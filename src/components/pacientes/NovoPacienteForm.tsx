"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import {
  brDateToIso,
  cleanCEP,
  cleanCPF,
  cleanPhone,
  formatCEP,
  formatCPF,
  formatDate,
  formatPhone,
  isValidDate,
} from "@/lib/masks";
import { calculateAge, isValidBirthDate, validateCPF } from "@/lib/validators";
import {
  createPaciente,
  type Genero,
  type GrauParentesco,
} from "@/actions/pacientes";

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

const phoneSchema = z
  .string()
  .refine((s) => {
    const d = cleanPhone(s);
    return d.length === 10 || d.length === 11;
  }, "Telefone inválido");

const cpfSchema = z
  .string()
  .refine((s) => validateCPF(s), "CPF inválido");

const optionalEmailSchema = z
  .string()
  .optional()
  .refine(
    (s) => !s || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim()),
    "E-mail inválido",
  );

const formSchema = z
  .object({
    nome: z.string().transform((s) => s.trim()).refine((s) => s.length >= 3, "Nome deve ter no mínimo 3 caracteres"),
    cpf: cpfSchema,
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
    email: optionalEmailSchema,
    endereco: z.string().optional(),
    cidade: z.string().optional(),
    estado: z.string().optional(),
    cep: z
      .string()
      .optional()
      .refine((s) => !s || cleanCEP(s).length === 0 || cleanCEP(s).length === 8, "CEP inválido"),
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

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/10 transition";
const labelClass = "block text-[13px] font-medium text-slate-700";
const errorClass = "text-xs text-red-500";

function NovoPacienteForm() {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: {
      nome: "",
      cpf: "",
      data_nascimento: "",
      genero: "prefiro_nao_informar",
      telefone: "",
      email: "",
      endereco: "",
      cidade: "",
      estado: "",
      cep: "",
      resp_nome: "",
      resp_cpf: "",
      resp_telefone: "",
      resp_email: "",
      resp_grau: "",
    },
  });

  const dataNasc = watch("data_nascimento");
  const dataNascIso = dataNasc ? brDateToIso(dataNasc) : null;
  const idade =
    dataNascIso && isValidBirthDate(dataNascIso) ? calculateAge(dataNascIso) : null;
  const showResponsavel = idade !== null && idade < 18;

  const handleMaskedChange =
    (field: keyof FormData, formatter: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(field, formatter(e.target.value), {
        shouldValidate: false,
        shouldDirty: true,
      });
    };

  const onSubmit = (data: FormData) => {
    setApiError(null);
    const isoNascimento = brDateToIso(data.data_nascimento);
    if (!isoNascimento) {
      setApiError("Data de nascimento inválida.");
      return;
    }
    startTransition(async () => {
      const result = await createPaciente({
        nome: data.nome,
        cpf: data.cpf,
        data_nascimento: isoNascimento,
        genero: data.genero,
        telefone: data.telefone,
        email: data.email?.trim() || undefined,
        endereco: data.endereco?.trim() || undefined,
        cidade: data.cidade?.trim() || undefined,
        estado: data.estado?.trim() || undefined,
        cep: data.cep?.trim() || undefined,
        responsavel: showResponsavel
          ? {
              nome: data.resp_nome ?? "",
              cpf: data.resp_cpf ?? "",
              telefone: data.resp_telefone ?? "",
              email: data.resp_email?.trim() || undefined,
              grau_parentesco: (data.resp_grau ?? "outro") as GrauParentesco,
            }
          : undefined,
      });

      if (!result.ok) {
        setApiError(result.error);
        return;
      }
      router.push(`/pacientes/${result.id}`);
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      autoComplete="off"
      className="space-y-6 pb-24"
    >
      <header className="space-y-1">
        <h1 className="text-[22px] font-semibold text-slate-900 leading-tight">
          Novo paciente
        </h1>
        <p className="text-sm text-slate-500">
          Preencha os dados do paciente. Campos com * são obrigatórios.
        </p>
      </header>

      <fieldset className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <legend className="px-2 text-[13px] font-medium text-slate-500">
          Dados pessoais
        </legend>

        <div className="space-y-1">
          <label className={labelClass}>Nome completo *</label>
          <input
            {...register("nome")}
            type="text"
            autoComplete="name"
            placeholder="Maria Silva"
            className={inputClass}
          />
          {errors.nome ? <p className={errorClass}>{errors.nome.message}</p> : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className={labelClass}>CPF *</label>
            <input
              {...register("cpf", { onChange: handleMaskedChange("cpf", formatCPF) })}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={14}
              placeholder="000.000.000-00"
              className={inputClass}
            />
            {errors.cpf ? <p className={errorClass}>{errors.cpf.message}</p> : null}
          </div>

          <div className="space-y-1">
            <label className={labelClass}>Data de nascimento *</label>
            <div className="flex items-center gap-2">
              <input
                {...register("data_nascimento", {
                  onChange: handleMaskedChange("data_nascimento", formatDate),
                })}
                type="text"
                inputMode="numeric"
                autoComplete="bday"
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
              <p className={errorClass}>{errors.data_nascimento.message}</p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className={labelClass}>Gênero *</label>
            <select
              {...register("genero")}
              className={inputClass}
            >
              {generoOptions.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
            {errors.genero ? <p className={errorClass}>{errors.genero.message}</p> : null}
          </div>

          <div className="space-y-1">
            <label className={labelClass}>Telefone *</label>
            <input
              {...register("telefone", {
                onChange: handleMaskedChange("telefone", formatPhone),
              })}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
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
          <label className={labelClass}>E-mail</label>
          <input
            {...register("email")}
            type="email"
            autoComplete="email"
            placeholder="maria@email.com"
            className={inputClass}
          />
          {errors.email ? <p className={errorClass}>{errors.email.message}</p> : null}
        </div>
      </fieldset>

      {showResponsavel ? (
        <fieldset className="space-y-4 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <label className={labelClass}>Telefone do responsável *</label>
              <input
                {...register("resp_telefone", {
                  onChange: handleMaskedChange("resp_telefone", formatPhone),
                })}
                type="tel"
                inputMode="tel"
                maxLength={15}
                placeholder="(11) 99999-9999"
                className={inputClass}
              />
              {errors.resp_telefone ? (
                <p className={errorClass}>{errors.resp_telefone.message}</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="space-y-1">
          <label className={labelClass}>Endereço</label>
          <input
            {...register("endereco")}
            type="text"
            autoComplete="street-address"
            placeholder="Rua, número, complemento"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            {errors.cep ? <p className={errorClass}>{errors.cep.message}</p> : null}
          </div>

          <div className="space-y-1">
            <label className={labelClass}>Cidade</label>
            <input
              {...register("cidade")}
              type="text"
              autoComplete="address-level2"
              placeholder="São Paulo"
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <label className={labelClass}>Estado</label>
            <select
              {...register("estado")}
              autoComplete="address-level1"
              className={inputClass}
            >
              <option value="">UF</option>
              {brazilianStates.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {apiError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {apiError}
        </p>
      ) : null}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push("/pacientes")}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {isPending ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}

export default NovoPacienteForm;
