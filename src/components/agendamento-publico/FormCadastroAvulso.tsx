"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check } from "lucide-react";
import { useState } from "react";
import {
  brDateToIso,
  cleanCPF,
  cleanPhone,
  formatCPF,
  formatDate,
  formatPhone,
  isValidDate,
} from "@/lib/masks";
import { calculateAge, isValidBirthDate, validateCPF } from "@/lib/validators";
import {
  cadastrarPacienteAvulso,
  type CadastroAvulsoInput,
} from "@/actions/pacientes";
import type { Genero, GrauParentesco } from "@/actions/agendamento-publico";

const generoOptions: { value: Genero; label: string }[] = [
  { value: "feminino", label: "Feminino" },
  { value: "masculino", label: "Masculino" },
  { value: "prefiro_nao_informar", label: "Prefiro não informar" },
];

const parentescoOptions: { value: GrauParentesco; label: string }[] = [
  { value: "mae", label: "Mãe" },
  { value: "pai", label: "Pai" },
  { value: "avo", label: "Avô(ó)" },
  { value: "tio", label: "Tio(a)" },
  { value: "outro", label: "Outro" },
];

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/10 transition";
const labelClass = "block text-[13px] font-medium text-slate-700";
const errorClass = "text-xs text-red-500";

const schema = z
  .object({
    nome: z
      .string()
      .transform((s) => s.trim())
      .refine((s) => s.length >= 3, "Informe seu nome completo"),
    cpf: z.string().refine((s) => validateCPF(cleanCPF(s)), "CPF inválido"),
    data_nascimento: z
      .string()
      .min(1, "Informe sua data de nascimento")
      .refine(
        (s) => /^\d{2}\/\d{2}\/\d{4}$/.test(s) && isValidDate(s),
        "Data inválida",
      )
      .refine((s) => {
        const iso = brDateToIso(s);
        return iso !== null && isValidBirthDate(iso);
      }, "Data inválida"),
    genero: z.enum(["masculino", "feminino", "prefiro_nao_informar"]),
    telefone: z.string().refine((s) => {
      const d = cleanPhone(s);
      return d.length === 10 || d.length === 11;
    }, "Telefone inválido"),
    email: z
      .string()
      .transform((s) => s.trim())
      .refine((s) => s.length > 0, "E-mail obrigatório")
      .refine(
        (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s),
        "E-mail inválido",
      ),
    aceite_lgpd: z.boolean().refine((v) => v === true, "É necessário aceitar o termo"),
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
        message: "Informe o nome do responsável",
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

type FormData = z.infer<typeof schema>;

interface FormCadastroAvulsoProps {
  slug: string;
  profissionalNome: string;
}

function FormCadastroAvulso({ slug, profissionalNome }: FormCadastroAvulsoProps) {
  const [erro, setErro] = useState<string | null>(null);
  const [jaCadastrado, setJaCadastrado] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      nome: "",
      cpf: "",
      data_nascimento: "",
      genero: "feminino",
      telefone: "",
      email: "",
      aceite_lgpd: false,
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
    const iso = brDateToIso(data.data_nascimento);
    if (!iso) return;

    const payload: CadastroAvulsoInput = {
      slug,
      nome: data.nome,
      cpf: cleanCPF(data.cpf),
      data_nascimento: iso,
      genero: data.genero,
      telefone: data.telefone,
      email: data.email,
      aceiteLgpd: data.aceite_lgpd,
      responsavel: showResponsavel
        ? {
            nome: data.resp_nome ?? "",
            cpf: data.resp_cpf ?? "",
            telefone: data.resp_telefone ?? "",
            email: data.resp_email?.trim() || undefined,
            grau_parentesco: (data.resp_grau ?? "outro") as GrauParentesco,
          }
        : undefined,
    };

    setErro(null);
    setJaCadastrado(null);
    startTransition(async () => {
      const result = await cadastrarPacienteAvulso(payload);
      if (!result.ok) {
        if (result.jaCadastrado) {
          setJaCadastrado(result.profissionalNome ?? profissionalNome);
        } else {
          setErro(result.error);
        }
        return;
      }
      setSucesso(true);
    });
  };

  if (sucesso) {
    return (
      <div className="space-y-6 text-center pt-6">
        <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#D1FAE5]">
          <Check
            size={32}
            strokeWidth={2.5}
            className="text-[#065F46]"
            aria-hidden="true"
          />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">
            Cadastro realizado
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Seus dados foram enviados para {profissionalNome}. Quando houver um
            agendamento, você receberá um e-mail.
          </p>
        </div>
      </div>
    );
  }

  if (jaCadastrado) {
    return (
      <div className="space-y-6 text-center pt-6">
        <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary-surface">
          <Check
            size={32}
            strokeWidth={2.5}
            className="text-primary"
            aria-hidden="true"
          />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">
            Você já está cadastrado
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Você já está cadastrado com {jaCadastrado}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" className="space-y-4">
      <div className="space-y-1">
        <label className={labelClass}>Nome completo *</label>
        <input
          {...register("nome")}
          type="text"
          autoComplete="name"
          placeholder="Seu nome completo"
          className={inputClass}
        />
        {errors.nome ? <p className={errorClass}>{errors.nome.message}</p> : null}
      </div>

      <div className="space-y-1">
        <label className={labelClass}>CPF *</label>
        <input
          {...register("cpf", {
            onChange: handleMaskedChange("cpf", formatCPF),
          })}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={14}
          placeholder="000.000.000-00"
          className={inputClass}
        />
        {errors.cpf ? <p className={errorClass}>{errors.cpf.message}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        <div className="space-y-1">
          <label className={labelClass}>E-mail *</label>
          <input
            {...register("email")}
            type="email"
            autoComplete="email"
            placeholder="seu@email.com"
            className={inputClass}
          />
          {errors.email ? (
            <p className={errorClass}>{errors.email.message}</p>
          ) : null}
        </div>
      </div>

      {showResponsavel ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-4">
          <p className="text-[13px] font-medium text-amber-800">
            Responsável legal (paciente menor de idade)
          </p>

          <div className="space-y-1">
            <label className={labelClass}>Nome do responsável *</label>
            <input
              {...register("resp_nome")}
              type="text"
              placeholder="Nome completo"
              className={inputClass}
            />
            {errors.resp_nome ? (
              <p className={errorClass}>{errors.resp_nome.message}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        </div>
      ) : null}

      <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 cursor-pointer">
        <input
          type="checkbox"
          {...register("aceite_lgpd")}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
        />
        <span className="text-xs text-slate-600 leading-relaxed">
          Autorizo o armazenamento dos meus dados conforme a LGPD para fins de
          atendimento em saúde.
        </span>
      </label>
      {errors.aceite_lgpd ? (
        <p className={errorClass}>{errors.aceite_lgpd.message}</p>
      ) : null}

      {erro ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {erro}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? "Cadastrando..." : "Cadastrar"}
      </button>
    </form>
  );
}

export default FormCadastroAvulso;
