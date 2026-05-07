"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, ChevronLeft, Upload } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  cadastrarPacientePreConsulta,
  getTemplatesPreConsulta,
  salvarAnamnesePreConsulta,
  uploadFotoAnamnesePublica,
  verificarPacientePreConsulta,
  type TemplatePublico,
} from "@/actions/pre-consulta";
import type { CampoTemplate } from "@/actions/anamnese";
import {
  ORIGEM_LABEL,
  ORIGENS_VALIDAS,
  type OrigemPaciente,
} from "@/lib/paciente-origem";
import { cn } from "@/lib/utils";
import ContatoPreferencial, {
  CONTATO_VALORES,
  type ContatoCanal,
} from "@/components/pacientes/ContatoPreferencial";

type Step = "identificacao" | "template" | "anamnese" | "sucesso";

type StepperStep = "identificacao" | "template" | "anamnese";

interface PreConsultaFlowProps {
  slug: string;
  profissionalNome: string;
  profissionalEspecialidade: string;
  logoUrl: string | null;
}

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/10 transition";
const labelClass = "block text-[14px] font-medium text-slate-900";
const errorClass = "text-xs text-red-500";

const cadastroSchema = z
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
    convenio: z.string().optional(),
    origem: z.string(),
    origem_detalhe: z.string(),
    contato_preferencial: z.enum(CONTATO_VALORES),
    aceite_lgpd: z
      .boolean()
      .refine((v) => v === true, "É necessário aceitar o termo"),
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

type CadastroFormData = z.infer<typeof cadastroSchema>;

type Valores = Record<string, string | string[] | boolean | number | null>;

function valorInicial(c: CampoTemplate): Valores[string] {
  switch (c.tipo) {
    case "selecao_multipla":
      return [];
    case "sim_nao":
      return null;
    case "escala_numerica": {
      const min = typeof c.min === "number" ? c.min : 0;
      const max = typeof c.max === "number" ? c.max : 10;
      return Math.round((min + max) / 2);
    }
    case "data":
      return "";
    case "upload_foto":
      return "";
    default:
      return "";
  }
}

function PreConsultaFlow({
  slug,
  profissionalNome,
  profissionalEspecialidade,
  logoUrl,
}: PreConsultaFlowProps) {
  const [step, setStep] = useState<Step>("identificacao");

  // Step 1
  const [cpfInput, setCpfInput] = useState("");
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [pacienteNome, setPacienteNome] = useState<string | null>(null);
  const [precisaCadastro, setPrecisaCadastro] = useState(false);
  const [cpfErro, setCpfErro] = useState<string | null>(null);
  const [verificando, startVerificar] = useTransition();
  const [submetendoCadastro, startCadastrar] = useTransition();

  // Step 2
  const [templates, setTemplates] = useState<TemplatePublico[]>([]);
  const [templatePadrao, setTemplatePadrao] =
    useState<TemplatePublico | null>(null);
  const [carregandoTpls, setCarregandoTpls] = useState(false);
  const [templateSelecionado, setTemplateSelecionado] =
    useState<TemplatePublico | null>(null);

  // Step 3
  const [valores, setValores] = useState<Valores>({});
  const [erroAnamnese, setErroAnamnese] = useState<string | null>(null);
  const [errosCampo, setErrosCampo] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [enviandoAnamnese, startEnviar] = useTransition();

  const cadastroForm = useForm<CadastroFormData>({
    resolver: zodResolver(cadastroSchema),
    mode: "onBlur",
    defaultValues: {
      nome: "",
      data_nascimento: "",
      genero: "feminino",
      telefone: "",
      email: "",
      convenio: "",
      origem: "",
      origem_detalhe: "",
      contato_preferencial: "whatsapp",
      aceite_lgpd: false,
      resp_nome: "",
      resp_cpf: "",
      resp_telefone: "",
      resp_email: "",
      resp_grau: "",
    },
  });

  const dataNasc = cadastroForm.watch("data_nascimento");
  const dataNascIso = dataNasc ? brDateToIso(dataNasc) : null;
  const idade =
    dataNascIso && isValidBirthDate(dataNascIso) ? calculateAge(dataNascIso) : null;
  const showResponsavel = idade !== null && idade < 18;

  const handleMaskedChange =
    (field: keyof CadastroFormData, formatter: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      cadastroForm.setValue(field, formatter(e.target.value), {
        shouldValidate: false,
        shouldDirty: true,
      });
    };

  // Carrega templates uma vez para decidir se pula a selecao
  useEffect(() => {
    let cancelado = false;
    setCarregandoTpls(true);
    (async () => {
      const r = await getTemplatesPreConsulta(slug);
      if (cancelado) return;
      setCarregandoTpls(false);
      if (!r.ok) {
        setErroAnamnese(r.error);
        return;
      }
      setTemplates(r.data.templates);
      setTemplatePadrao(r.data.padrao);
    })();
    return () => {
      cancelado = true;
    };
  }, [slug]);

  const iniciarAnamneseCom = (tpl: TemplatePublico) => {
    setTemplateSelecionado(tpl);
    const init: Valores = {};
    for (const c of tpl.campos) init[c.id] = valorInicial(c);
    setValores(init);
    setStep("anamnese");
  };

  const prosseguirAposIdentificacao = () => {
    if (templatePadrao) {
      iniciarAnamneseCom(templatePadrao);
      return;
    }
    if (templates.length === 1) {
      iniciarAnamneseCom(templates[0]);
      return;
    }
    setStep("template");
  };

  const verificarCpf = () => {
    setCpfErro(null);
    const cpfDigits = cleanCPF(cpfInput);
    if (cpfDigits.length !== 11) {
      setCpfErro("CPF deve ter 11 dígitos");
      return;
    }
    if (!validateCPF(cpfDigits)) {
      setCpfErro("CPF inválido");
      return;
    }
    startVerificar(async () => {
      const r = await verificarPacientePreConsulta(slug, cpfDigits);
      if (!r.ok) {
        setCpfErro(r.error);
        return;
      }
      if (r.existe) {
        setPacienteId(r.paciente.id);
        setPacienteNome(r.paciente.nome);
        setPrecisaCadastro(false);
      } else {
        setPrecisaCadastro(true);
      }
    });
  };

  const onSubmitCadastro = (data: CadastroFormData) => {
    setCpfErro(null);
    const iso = brDateToIso(data.data_nascimento);
    if (!iso) return;
    startCadastrar(async () => {
      const origemFinal =
        data.origem &&
        (ORIGENS_VALIDAS as readonly string[]).includes(data.origem)
          ? (data.origem as OrigemPaciente)
          : null;

      const r = await cadastrarPacientePreConsulta({
        slug,
        nome: data.nome,
        cpf: cleanCPF(cpfInput),
        data_nascimento: iso,
        genero: data.genero,
        telefone: data.telefone,
        email: data.email?.trim() || undefined,
        convenio: data.convenio?.trim() || undefined,
        origem: origemFinal,
        origem_detalhe:
          origemFinal === "outros"
            ? data.origem_detalhe?.trim() || null
            : null,
        contato_preferencial: data.contato_preferencial,
        aceiteLgpd: data.aceite_lgpd,
        responsavel: showResponsavel
          ? {
              nome: data.resp_nome ?? "",
              cpf: data.resp_cpf ?? "",
              telefone: data.resp_telefone ?? "",
              email: data.resp_email?.trim() || undefined,
              grau_parentesco: (data.resp_grau ?? "outro") as
                | "mae"
                | "pai"
                | "avo"
                | "tio"
                | "outro",
            }
          : undefined,
      });
      if (!r.ok) {
        setCpfErro(r.error);
        return;
      }
      setPacienteId(r.pacienteId);
      setPacienteNome(data.nome);
      prosseguirAposIdentificacao();
    });
  };

  const escolherTemplate = (tpl: TemplatePublico) => {
    iniciarAnamneseCom(tpl);
  };

  const setValor = (id: string, valor: Valores[string]) => {
    setValores((prev) => ({ ...prev, [id]: valor }));
    setErrosCampo((prev) => {
      if (!prev[id]) return prev;
      const novo = { ...prev };
      delete novo[id];
      return novo;
    });
  };

  const toggleOpcao = (id: string, opcao: string) => {
    setValores((prev) => {
      const atual = Array.isArray(prev[id]) ? (prev[id] as string[]) : [];
      const ja = atual.includes(opcao);
      return {
        ...prev,
        [id]: ja ? atual.filter((o) => o !== opcao) : [...atual, opcao],
      };
    });
  };

  const handleUpload = async (
    id: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUploading((p) => ({ ...p, [id]: true }));
    try {
      const fd = new FormData();
      fd.set("arquivo", f);
      const r = await uploadFotoAnamnesePublica(slug, fd);
      if (!r.ok) {
        setErrosCampo((p) => ({ ...p, [id]: r.error }));
        return;
      }
      setValor(id, r.url);
    } finally {
      setUploading((p) => {
        const novo = { ...p };
        delete novo[id];
        return novo;
      });
    }
  };

  const enviarAnamnese = () => {
    if (!templateSelecionado || !pacienteId) return;
    setErroAnamnese(null);
    const errosLocais: Record<string, string> = {};
    const dadosFinal: Record<string, unknown> = {};

    for (const c of templateSelecionado.campos) {
      const v = valores[c.id];
      switch (c.tipo) {
        case "texto_livre": {
          const s = typeof v === "string" ? v.trim() : "";
          if (c.obrigatorio && s.length === 0) {
            errosLocais[c.id] = "Campo obrigatório.";
          }
          if (s) dadosFinal[c.id] = s;
          break;
        }
        case "selecao_multipla": {
          const arr = Array.isArray(v) ? v : [];
          if (c.obrigatorio && arr.length === 0) {
            errosLocais[c.id] = "Selecione ao menos uma opção.";
          }
          if (arr.length > 0) dadosFinal[c.id] = arr;
          break;
        }
        case "sim_nao": {
          if (c.obrigatorio && typeof v !== "boolean") {
            errosLocais[c.id] = "Campo obrigatório.";
          }
          if (typeof v === "boolean") dadosFinal[c.id] = v;
          break;
        }
        case "escala_numerica": {
          if (typeof v === "number") dadosFinal[c.id] = v;
          else if (c.obrigatorio) errosLocais[c.id] = "Campo obrigatório.";
          break;
        }
        case "data": {
          const s = typeof v === "string" ? v : "";
          if (c.obrigatorio && !s) errosLocais[c.id] = "Campo obrigatório.";
          if (s) dadosFinal[c.id] = s;
          break;
        }
        case "upload_foto": {
          const s = typeof v === "string" ? v : "";
          if (c.obrigatorio && !s) errosLocais[c.id] = "Foto obrigatória.";
          if (s) dadosFinal[c.id] = s;
          break;
        }
      }
    }

    if (Object.keys(errosLocais).length > 0) {
      setErrosCampo(errosLocais);
      setErroAnamnese("Preencha os campos obrigatórios.");
      return;
    }

    startEnviar(async () => {
      const r = await salvarAnamnesePreConsulta({
        slug,
        pacienteId,
        templateId: templateSelecionado.id,
        dados: dadosFinal,
      });
      if (!r.ok) {
        setErroAnamnese(r.error);
        return;
      }
      setStep("sucesso");
    });
  };

  const stepOrder: StepperStep[] = templatePadrao
    ? ["identificacao", "anamnese"]
    : ["identificacao", "template", "anamnese"];
  const stepperPos: Record<Step, number> = {
    identificacao: 0,
    template: templatePadrao ? 0 : 1,
    anamnese: templatePadrao ? 1 : 2,
    sucesso: stepOrder.length - 1,
  };
  const stepIdx = stepperPos[step];

  return (
    <div className="space-y-6">
      <header className="space-y-1 text-center">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt="Logo"
            className="mx-auto mb-2 max-h-[60px] w-auto object-contain"
          />
        ) : null}
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Pré-consulta
        </p>
        <h1 className="text-xl font-semibold text-slate-900 leading-tight">
          {profissionalNome}
        </h1>
        <p className="text-xs text-slate-500">{profissionalEspecialidade}</p>
        <p className="text-sm text-slate-600 leading-relaxed pt-2">
          Preencha seus dados e a anamnese antes da consulta com{" "}
          {profissionalNome}.
        </p>
      </header>

      {step !== "sucesso" ? (
        <ol aria-label="Etapas" className="flex items-center gap-1.5">
          {stepOrder.map((s, i) => {
            const ativo = i === stepIdx;
            const feito = i < stepIdx;
            return (
              <li
                key={s}
                aria-current={ativo ? "step" : undefined}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  feito || ativo ? "bg-primary" : "bg-slate-200",
                )}
              />
            );
          })}
        </ol>
      ) : null}

      {step === "identificacao" ? (
        <section className="space-y-4">
          {!precisaCadastro && !pacienteId ? (
            <>
              <div className="space-y-1">
                <label className={labelClass}>Seu CPF</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={14}
                  value={cpfInput}
                  onChange={(e) => setCpfInput(formatCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  className={inputClass}
                />
                {cpfErro ? <p className={errorClass}>{cpfErro}</p> : null}
                <p className="text-xs text-slate-500">
                  Usamos o CPF para identificar você ou criar um cadastro.
                </p>
              </div>
              <button
                type="button"
                onClick={verificarCpf}
                disabled={verificando || cleanCPF(cpfInput).length !== 11}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {verificando ? "Verificando..." : "Continuar"}
              </button>
            </>
          ) : null}

          {pacienteId && !precisaCadastro ? (
            <>
              <div className="rounded-lg border border-primary/30 bg-primary-surface p-4 space-y-1">
                <p className="text-[13px] font-medium text-primary-dark">
                  Olá, {pacienteNome}!
                </p>
                <p className="text-xs text-slate-600">
                  Identificamos seu cadastro. Vamos prosseguir com a anamnese.
                </p>
              </div>
              <button
                type="button"
                onClick={prosseguirAposIdentificacao}
                disabled={carregandoTpls}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {carregandoTpls ? "Carregando..." : "Continuar"}
              </button>
            </>
          ) : null}

          {precisaCadastro && !pacienteId ? (
            <form
              onSubmit={cadastroForm.handleSubmit(onSubmitCadastro)}
              autoComplete="off"
              className="space-y-4"
            >
              <p className="text-sm text-slate-500">
                Não encontramos seu cadastro. Preencha seus dados para
                continuar.
              </p>

              <div className="space-y-1">
                <label className={labelClass}>Nome completo *</label>
                <input
                  {...cadastroForm.register("nome")}
                  type="text"
                  placeholder="Seu nome completo"
                  className={inputClass}
                />
                {cadastroForm.formState.errors.nome ? (
                  <p className={errorClass}>
                    {cadastroForm.formState.errors.nome.message}
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className={labelClass}>Data de nascimento *</label>
                  <div className="flex items-center gap-2">
                    <input
                      {...cadastroForm.register("data_nascimento", {
                        onChange: handleMaskedChange("data_nascimento", formatDate),
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
                  {cadastroForm.formState.errors.data_nascimento ? (
                    <p className={errorClass}>
                      {cadastroForm.formState.errors.data_nascimento.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Gênero *</label>
                  <select
                    {...cadastroForm.register("genero")}
                    className={inputClass}
                  >
                    <option value="feminino">Feminino</option>
                    <option value="masculino">Masculino</option>
                    <option value="prefiro_nao_informar">
                      Prefiro não informar
                    </option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className={labelClass}>Telefone *</label>
                  <input
                    {...cadastroForm.register("telefone", {
                      onChange: handleMaskedChange("telefone", formatPhone),
                    })}
                    type="tel"
                    inputMode="tel"
                    maxLength={15}
                    placeholder="(11) 99999-9999"
                    className={inputClass}
                  />
                  {cadastroForm.formState.errors.telefone ? (
                    <p className={errorClass}>
                      {cadastroForm.formState.errors.telefone.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>E-mail</label>
                  <input
                    {...cadastroForm.register("email")}
                    type="email"
                    placeholder="seu@email.com"
                    className={inputClass}
                  />
                  <p className="text-xs text-slate-500">
                    Sem e-mail, voce nao recebera confirmacao por e-mail.
                  </p>
                  {cadastroForm.formState.errors.email ? (
                    <p className={errorClass}>
                      {cadastroForm.formState.errors.email.message}
                    </p>
                  ) : null}
                </div>
              </div>

              <ContatoPreferencial
                value={
                  cadastroForm.watch("contato_preferencial") as ContatoCanal
                }
                onChange={(v) =>
                  cadastroForm.setValue("contato_preferencial", v, {
                    shouldDirty: true,
                    shouldValidate: false,
                  })
                }
                name="contato_preferencial_pre"
              />

              <div className="space-y-1">
                <label className={labelClass}>Convênio</label>
                <input
                  {...cadastroForm.register("convenio")}
                  type="text"
                  autoComplete="off"
                  placeholder="Ex: Unimed, Bradesco Saude, SulAmerica"
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Como nos conheceu?</label>
                <select
                  {...cadastroForm.register("origem")}
                  className={inputClass}
                >
                  <option value="">Selecione</option>
                  {ORIGENS_VALIDAS.map((o) => (
                    <option key={o} value={o}>
                      {ORIGEM_LABEL[o]}
                    </option>
                  ))}
                </select>
              </div>

              {cadastroForm.watch("origem") === "outros" ? (
                <div className="space-y-1">
                  <label className={labelClass}>Especifique</label>
                  <input
                    {...cadastroForm.register("origem_detalhe")}
                    type="text"
                    maxLength={100}
                    placeholder="Ex: Convênio, panfleto, evento"
                    className={inputClass}
                  />
                </div>
              ) : null}

              {showResponsavel ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                  <p className="text-[13px] font-medium text-amber-800">
                    Responsável legal (paciente menor de idade)
                  </p>
                  <div className="space-y-1">
                    <label className={labelClass}>Nome *</label>
                    <input
                      {...cadastroForm.register("resp_nome")}
                      type="text"
                      className={inputClass}
                    />
                    {cadastroForm.formState.errors.resp_nome ? (
                      <p className={errorClass}>
                        {cadastroForm.formState.errors.resp_nome.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className={labelClass}>CPF *</label>
                      <input
                        {...cadastroForm.register("resp_cpf", {
                          onChange: handleMaskedChange("resp_cpf", formatCPF),
                        })}
                        type="text"
                        inputMode="numeric"
                        maxLength={14}
                        placeholder="000.000.000-00"
                        className={inputClass}
                      />
                      {cadastroForm.formState.errors.resp_cpf ? (
                        <p className={errorClass}>
                          {cadastroForm.formState.errors.resp_cpf.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      <label className={labelClass}>Telefone *</label>
                      <input
                        {...cadastroForm.register("resp_telefone", {
                          onChange: handleMaskedChange("resp_telefone", formatPhone),
                        })}
                        type="tel"
                        maxLength={15}
                        placeholder="(11) 99999-9999"
                        className={inputClass}
                      />
                      {cadastroForm.formState.errors.resp_telefone ? (
                        <p className={errorClass}>
                          {cadastroForm.formState.errors.resp_telefone.message}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className={labelClass}>Grau de parentesco *</label>
                    <select
                      {...cadastroForm.register("resp_grau")}
                      className={inputClass}
                    >
                      <option value="">Selecione</option>
                      <option value="mae">Mãe</option>
                      <option value="pai">Pai</option>
                      <option value="avo">Avô(ó)</option>
                      <option value="tio">Tio(a)</option>
                      <option value="outro">Outro</option>
                    </select>
                    {cadastroForm.formState.errors.resp_grau ? (
                      <p className={errorClass}>
                        {cadastroForm.formState.errors.resp_grau.message}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 cursor-pointer">
                <input
                  type="checkbox"
                  {...cadastroForm.register("aceite_lgpd")}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-text focus:ring-primary/40"
                />
                <span className="text-xs text-slate-600 leading-relaxed">
                  Autorizo o armazenamento dos meus dados conforme a LGPD para
                  fins de atendimento em saúde.
                </span>
              </label>
              {cadastroForm.formState.errors.aceite_lgpd ? (
                <p className={errorClass}>
                  {cadastroForm.formState.errors.aceite_lgpd.message}
                </p>
              ) : null}

              {cpfErro ? (
                <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {cpfErro}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submetendoCadastro}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submetendoCadastro ? "Cadastrando..." : "Continuar"}
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      {step === "template" ? (
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => setStep("identificacao")}
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />
            Voltar
          </button>
          {!carregandoTpls && templates.length > 1 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Dica: defina um modelo padrão em Configurações para simplificar a
              pré-consulta.
            </p>
          ) : null}
          <h2 className="text-sm font-medium text-slate-700">
            Escolha o modelo de anamnese
          </h2>
          {carregandoTpls ? (
            <p className="text-xs text-slate-500">Carregando...</p>
          ) : templates.length === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              O profissional ainda não cadastrou modelos de anamnese.
            </p>
          ) : (
            <ul className="space-y-2">
              {templates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => escolherTemplate(t)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-primary"
                  >
                    <p className="text-sm font-medium text-slate-900">
                      {t.nome}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t.campos.length}{" "}
                      {t.campos.length === 1 ? "campo" : "campos"}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {step === "anamnese" && templateSelecionado ? (
        <section className="space-y-4">
          <button
            type="button"
            onClick={() =>
              !templatePadrao && templates.length > 1
                ? setStep("template")
                : setStep("identificacao")
            }
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />
            Voltar
          </button>

          <div>
            <h2 className="text-sm font-medium text-slate-700">
              {templateSelecionado.nome}
            </h2>
            <p className="text-xs text-slate-500">
              Preencha os campos abaixo. Os marcados com * são obrigatórios.
            </p>
          </div>

          <div className="space-y-4">
            {templateSelecionado.campos
              .slice()
              .sort((a, b) => a.ordem - b.ordem)
              .map((c) => (
                <CampoRender
                  key={c.id}
                  campo={c}
                  valor={valores[c.id]}
                  erro={errosCampo[c.id]}
                  uploading={Boolean(uploading[c.id])}
                  onChange={(v) => setValor(c.id, v)}
                  onToggleOpcao={(o) => toggleOpcao(c.id, o)}
                  onUpload={(e) => handleUpload(c.id, e)}
                />
              ))}
          </div>

          {erroAnamnese ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {erroAnamnese}
            </p>
          ) : null}

          <button
            type="button"
            onClick={enviarAnamnese}
            disabled={enviandoAnamnese}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            {enviandoAnamnese ? "Enviando..." : "Enviar anamnese"}
          </button>
        </section>
      ) : null}

      {step === "sucesso" ? (
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
              Anamnese enviada
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Seus dados foram enviados para {profissionalNome}. Eles estarão
              disponíveis na sua próxima consulta.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface CampoRenderProps {
  campo: CampoTemplate;
  valor: Valores[string];
  erro: string | undefined;
  uploading: boolean;
  onChange: (valor: Valores[string]) => void;
  onToggleOpcao: (opcao: string) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function CampoRender({
  campo,
  valor,
  erro,
  uploading,
  onChange,
  onToggleOpcao,
  onUpload,
}: CampoRenderProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[14px] font-medium text-slate-900">
        {campo.label}
        {campo.obrigatorio ? (
          <span className="ml-0.5 text-red-500">*</span>
        ) : null}
      </label>

      {campo.tipo === "texto_livre" ? (
        <textarea
          rows={3}
          value={typeof valor === "string" ? valor : ""}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} resize-y`}
        />
      ) : null}

      {campo.tipo === "selecao_multipla" ? (
        <div className="space-y-1.5">
          {(campo.opcoes ?? []).map((opt) => {
            const checked = Array.isArray(valor) && valor.includes(opt);
            return (
              <label
                key={opt}
                className="flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm cursor-pointer hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleOpcao(opt)}
                  className="h-4 w-4 rounded border-slate-300 text-primary-text focus:ring-primary/40"
                />
                <span className="text-slate-700">{opt}</span>
              </label>
            );
          })}
        </div>
      ) : null}

      {campo.tipo === "sim_nao" ? (
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => onChange(true)}
            className={cn(
              "rounded px-4 py-1.5 text-sm font-medium transition-colors",
              valor === true
                ? "bg-primary text-white"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            Sim
          </button>
          <button
            type="button"
            onClick={() => onChange(false)}
            className={cn(
              "rounded px-4 py-1.5 text-sm font-medium transition-colors",
              valor === false
                ? "bg-slate-700 text-white"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            Não
          </button>
        </div>
      ) : null}

      {campo.tipo === "escala_numerica"
        ? (() => {
            const min = typeof campo.min === "number" ? campo.min : 0;
            const max = typeof campo.max === "number" ? campo.max : 10;
            const v =
              typeof valor === "number" ? valor : Math.round((min + max) / 2);
            return (
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={min}
                  max={max}
                  value={v}
                  onChange={(e) => onChange(Number(e.target.value))}
                  className="flex-1 accent-[#0D9488]"
                />
                <span className="inline-flex h-9 min-w-[44px] items-center justify-center rounded-lg bg-primary-surface px-2 text-sm font-semibold text-primary-dark">
                  {v}
                </span>
              </div>
            );
          })()
        : null}

      {campo.tipo === "data" ? (
        <input
          type="date"
          value={typeof valor === "string" ? valor : ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      ) : null}

      {campo.tipo === "upload_foto" ? (
        <div className="space-y-2">
          <input
            type="file"
            id={`pre-anamnese-${campo.id}`}
            accept="image/*"
            onChange={onUpload}
            className="hidden"
          />
          <label
            htmlFor={`pre-anamnese-${campo.id}`}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded border border-primary px-3 py-1.5 text-xs font-medium text-primary-text hover:bg-primary-surface transition-colors",
              uploading && "opacity-50 cursor-not-allowed",
            )}
          >
            <Upload size={13} strokeWidth={1.5} aria-hidden="true" />
            {uploading ? "Enviando..." : "Escolher imagem"}
          </label>
          {typeof valor === "string" && valor.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={valor}
              alt={`Foto - ${campo.label}`}
              className="block max-h-[140px] rounded border border-slate-200 object-contain"
            />
          ) : null}
        </div>
      ) : null}

      {erro ? <p className="text-xs text-red-600">{erro}</p> : null}
    </div>
  );
}

export default PreConsultaFlow;
