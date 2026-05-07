"use client";

import { useEffect, useState, useTransition } from "react";
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
  getConveniosExistentes,
  type Genero,
  type GrauParentesco,
} from "@/actions/pacientes";
import {
  ORIGEM_LABEL,
  ORIGENS_VALIDAS,
  type OrigemPaciente,
} from "@/lib/paciente-origem";
import { Ruler, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  PacienteDetalhe,
  ResponsavelDetalhe,
} from "./FichaPaciente";
import ContatoPreferencial, {
  CONTATO_VALORES,
  type ContatoCanal,
} from "./ContatoPreferencial";
import CollapsibleSection from "@/components/ui/CollapsibleSection";

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

const optionalEmailSchema = z
  .string()
  .refine(
    (s) => s.trim().length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim()),
    "E-mail inválido",
  );

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
    email: optionalEmailSchema,
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
    altura: z
      .string()
      .refine((s) => {
        if (!s || s.trim() === "") return true;
        const n = Number(s.replace(",", "."));
        return Number.isFinite(n) && n >= 30 && n <= 250;
      }, "Altura entre 30 e 250 cm"),
    peso: z
      .string()
      .refine((s) => {
        if (!s || s.trim() === "") return true;
        const n = Number(s.replace(",", "."));
        return Number.isFinite(n) && n >= 1 && n <= 500;
      }, "Peso entre 1 e 500 kg"),
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
const labelClass = "block text-[14px] font-medium text-slate-900";
const errorClass = "text-xs text-danger";

function EditarPacienteModal({
  paciente,
  responsavel,
  open,
  onOpenChange,
}: EditarPacienteModalProps) {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);
  const [convenios, setConvenios] = useState<string[]>([]);
  const [confirmRemoverResp, setConfirmRemoverResp] = useState<
    FormData | null
  >(null);
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
    altura:
      paciente.altura !== null && paciente.altura !== undefined
        ? String(paciente.altura).replace(".", ",")
        : "",
    peso:
      paciente.peso !== null && paciente.peso !== undefined
        ? String(paciente.peso).replace(".", ",")
        : "",
    origem: paciente.origem ?? "",
    origem_detalhe: paciente.origem_detalhe ?? "",
    contato_preferencial: paciente.contato_preferencial ?? "whatsapp",
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

    const alturaNum = data.altura?.trim()
      ? Number(data.altura.replace(",", "."))
      : null;
    const pesoNum = data.peso?.trim()
      ? Number(data.peso.replace(",", "."))
      : null;
    const origemFinal =
      data.origem && (ORIGENS_VALIDAS as readonly string[]).includes(data.origem)
        ? (data.origem as OrigemPaciente)
        : null;

    startTransition(async () => {
      const result = await atualizarPaciente(paciente.id, {
        nome: data.nome,
        data_nascimento: isoNascimento,
        genero: data.genero,
        telefone: data.telefone,
        email: data.email?.trim() || undefined,
        endereco: data.endereco?.trim() || undefined,
        cidade: data.cidade?.trim() || undefined,
        estado: data.estado?.trim() || undefined,
        cep: data.cep?.trim() || undefined,
        convenio: data.convenio?.trim() || undefined,
        observacoes: data.observacoes?.trim() || undefined,
        altura: alturaNum,
        peso: pesoNum,
        origem: origemFinal,
        origem_detalhe:
          origemFinal === "outros"
            ? data.origem_detalhe?.trim() || null
            : null,
        contato_preferencial: data.contato_preferencial,
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
            <div className="rounded-lg border border-slate-200 bg-white px-4">
              <CollapsibleSection titulo="Dados pessoais">
                <div className="space-y-3">
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
                      <label className={labelClass}>
                        Data de nascimento *
                      </label>
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
                  </div>
                </div>
              </CollapsibleSection>

              <CollapsibleSection titulo="Contato">
                <div className="space-y-3">
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

                  <div className="space-y-1">
                    <label className={labelClass}>E-mail</label>
                    <input
                      {...register("email")}
                      type="email"
                      placeholder="maria@email.com"
                      className={inputClass}
                    />
                    <p className="text-xs text-slate-500">
                      Opcional. Sem e-mail, o paciente nao recebera avisos por
                      e-mail.
                    </p>
                    {errors.email ? (
                      <p className={errorClass}>{errors.email.message}</p>
                    ) : null}
                  </div>

                  <ContatoPreferencial
                    value={watch("contato_preferencial") as ContatoCanal}
                    onChange={(v) =>
                      setValue("contato_preferencial", v, {
                        shouldDirty: true,
                        shouldValidate: false,
                      })
                    }
                    name="contato_preferencial_edit"
                  />
                </div>
              </CollapsibleSection>

              <CollapsibleSection
                titulo="Dados complementares"
                defaultOpen={false}
                hint="Opcional"
              >
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className={labelClass}>Convênio</label>
                    <input
                      {...register("convenio")}
                      type="text"
                      list="convenios-sugestoes-edit"
                      autoComplete="off"
                      placeholder="Ex: Unimed, Bradesco Saude, SulAmerica"
                      className={inputClass}
                    />
                    <datalist id="convenios-sugestoes-edit">
                      {convenios.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className={labelClass}>Altura (cm)</label>
                      <div className="relative">
                        <Ruler
                          size={16}
                          strokeWidth={1.5}
                          aria-hidden="true"
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                        />
                        <input
                          {...register("altura")}
                          type="text"
                          inputMode="decimal"
                          placeholder="Ex: 170"
                          className={`${inputClass} pl-9`}
                        />
                      </div>
                      {errors.altura ? (
                        <p className={errorClass}>{errors.altura.message}</p>
                      ) : null}
                    </div>

                    <div className="space-y-1">
                      <label className={labelClass}>Peso (kg)</label>
                      <div className="relative">
                        <Scale
                          size={16}
                          strokeWidth={1.5}
                          aria-hidden="true"
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                        />
                        <input
                          {...register("peso")}
                          type="text"
                          inputMode="decimal"
                          placeholder="Ex: 72.5"
                          className={`${inputClass} pl-9`}
                        />
                      </div>
                      {errors.peso ? (
                        <p className={errorClass}>{errors.peso.message}</p>
                      ) : null}
                    </div>
                  </div>

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
                </div>
              </CollapsibleSection>

              <CollapsibleSection titulo="Observações" defaultOpen={false}>
                <div className="space-y-1">
                  <textarea
                    {...register("observacoes")}
                    rows={3}
                    maxLength={1000}
                    className={`${inputClass} resize-none`}
                  />
                </div>
              </CollapsibleSection>
            </div>

            {showResponsavel ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-4">
                <CollapsibleSection
                  titulo="Responsável legal (paciente menor de idade)"
                  hint="Obrigatorio"
                >
                  <div className="space-y-3">
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
                  </div>
                </CollapsibleSection>
              </div>
            ) : null}

            <div className="rounded-lg border border-slate-200 bg-white px-4">
              <CollapsibleSection
                titulo="Endereço"
                defaultOpen={false}
                hint="Opcional"
              >
                <div className="space-y-3">
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
                </div>
              </CollapsibleSection>
            </div>

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
