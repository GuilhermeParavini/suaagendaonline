"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  verificarPacientePorCPF,
  type Genero,
  type GrauParentesco,
  type NovoPacientePublico,
} from "@/actions/agendamento-publico";
import {
  ORIGEM_LABEL,
  ORIGENS_VALIDAS,
  type OrigemPaciente,
} from "@/lib/paciente-origem";
import ContatoPreferencial, {
  CONTATO_VALORES,
  type ContatoCanal,
} from "@/components/pacientes/ContatoPreferencial";

const brazilianStates = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

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
const labelClass = "block text-[14px] font-medium text-slate-900";
const errorClass = "text-xs text-red-500";

const schema = z
  .object({
    nome: z
      .string()
      .transform((s) => s.trim())
      .refine((s) => s.length >= 3, "Informe seu nome completo"),
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
      .refine(
        (s) =>
          s.trim().length === 0 ||
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim()),
        "E-mail inválido",
      ),
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
    origem: z.string(),
    origem_detalhe: z.string(),
    contato_preferencial: z.enum(CONTATO_VALORES),
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
      ctx.addIssue({ code: "custom", path: ["resp_cpf"], message: "CPF do responsável inválido" });
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

export type FormResult =
  | { existingId: string; nome: string }
  | { novoPaciente: NovoPacientePublico };

interface FormPacientePublicoProps {
  tenantId: string;
  cpfInicial?: string;
  onIdentified: (result: FormResult) => void;
  onBack: () => void;
}

type Phase = "cpf" | "confirmar" | "novo";

function FormPacientePublico({
  tenantId,
  cpfInicial,
  onIdentified,
  onBack,
}: FormPacientePublicoProps) {
  const [phase, setPhase] = useState<Phase>("cpf");
  const [cpfInput, setCpfInput] = useState<string>(
    cpfInicial ? formatCPF(cpfInicial) : "",
  );
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [existing, setExisting] = useState<{ id: string; nome: string } | null>(null);
  const [isLooking, startLookup] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      nome: "",
      data_nascimento: "",
      genero: "feminino",
      telefone: "",
      email: "",
      endereco: "",
      cidade: "",
      estado: "",
      cep: "",
      origem: "",
      origem_detalhe: "",
      contato_preferencial: "whatsapp",
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

  const handleLookup = () => {
    setCpfError(null);
    const cpfDigits = cleanCPF(cpfInput);
    if (!validateCPF(cpfDigits)) {
      setCpfError("CPF inválido");
      return;
    }
    startLookup(async () => {
      const result = await verificarPacientePorCPF(cpfDigits, tenantId);
      if (!result.ok) {
        setCpfError(result.error);
        return;
      }
      if (result.existe) {
        setExisting({ id: result.paciente.id, nome: result.paciente.nome });
        setPhase("confirmar");
      } else {
        reset();
        setPhase("novo");
      }
    });
  };

  if (phase === "cpf") {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <label className={labelClass}>Seu CPF</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={14}
            placeholder="000.000.000-00"
            value={cpfInput}
            onChange={(e) => setCpfInput(formatCPF(e.target.value))}
            className={inputClass}
          />
          {cpfError ? <p className={errorClass}>{cpfError}</p> : null}
          <p className="text-xs text-slate-500">
            Usamos o CPF para identificar você ou criar um cadastro.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={handleLookup}
            disabled={isLooking || cleanCPF(cpfInput).length !== 11}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLooking ? "Verificando..." : "Continuar"}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "confirmar" && existing) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-primary/30 bg-primary-surface p-4 space-y-1">
          <p className="text-[13px] font-medium text-primary-dark">
            Encontramos seu cadastro
          </p>
          <p className="text-base font-semibold text-slate-900">
            {existing.nome}
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => {
              setExisting(null);
              setPhase("cpf");
            }}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Não sou eu
          </button>
          <button
            type="button"
            onClick={() => onIdentified({ existingId: existing.id, nome: existing.nome })}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-dark transition-colors"
          >
            Sou eu, continuar
          </button>
        </div>
      </div>
    );
  }

  // phase === 'novo'
  const onSubmit = (data: FormData) => {
    const iso = brDateToIso(data.data_nascimento);
    if (!iso) return;
    const origemFinal =
      data.origem && (ORIGENS_VALIDAS as readonly string[]).includes(data.origem)
        ? (data.origem as OrigemPaciente)
        : null;

    const novoPaciente: NovoPacientePublico = {
      nome: data.nome,
      cpf: cleanCPF(cpfInput),
      data_nascimento: iso,
      genero: data.genero,
      telefone: data.telefone,
      email: data.email?.trim() || undefined,
      endereco: data.endereco?.trim() || undefined,
      cidade: data.cidade?.trim() || undefined,
      estado: data.estado?.trim() || undefined,
      cep: data.cep?.trim() || undefined,
      origem: origemFinal,
      origem_detalhe:
        origemFinal === "outros" ? data.origem_detalhe?.trim() || null : null,
      contato_preferencial: data.contato_preferencial,
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
    onIdentified({ novoPaciente });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" className="space-y-4">
      <p className="text-sm text-slate-500">
        Não encontramos cadastro para este CPF. Preencha seus dados para continuar.
      </p>

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
          <label className={labelClass}>E-mail</label>
          <input
            {...register("email")}
            type="email"
            autoComplete="email"
            placeholder="seu@email.com"
            className={inputClass}
          />
          <p className="text-xs text-slate-500">
            Sem e-mail, voce nao recebera confirmacao por e-mail.
          </p>
          {errors.email ? <p className={errorClass}>{errors.email.message}</p> : null}
        </div>
      </div>

      <ContatoPreferencial
        value={watch("contato_preferencial") as ContatoCanal}
        onChange={(v) =>
          setValue("contato_preferencial", v, {
            shouldDirty: true,
            shouldValidate: false,
          })
        }
        name="contato_preferencial_pub"
      />

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

      <div className="space-y-1">
        <label className={labelClass}>Como nos conheceu?</label>
        <select {...register("origem")} className={inputClass}>
          <option value="">Selecione</option>
          {ORIGENS_VALIDAS.map((o) => (
            <option key={o} value={o}>
              {ORIGEM_LABEL[o]}
            </option>
          ))}
        </select>
      </div>

      {watch("origem") === "outros" ? (
        <div className="space-y-1">
          <label className={labelClass}>Especifique</label>
          <input
            {...register("origem_detalhe")}
            type="text"
            maxLength={100}
            placeholder="Ex: Convênio, panfleto, evento"
            className={inputClass}
          />
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
        <p className="text-[13px] font-medium text-slate-500">
          Endereço (opcional)
        </p>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
              placeholder="Cidade"
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

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => setPhase("cpf")}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Voltar
        </button>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-dark transition-colors"
        >
          Continuar
        </button>
      </div>
    </form>
  );
}

export default FormPacientePublico;
