"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  atualizarProfissional,
  atualizarTenant,
} from "@/actions/configuracoes";
import type {
  ProfissionalConfig,
  TenantConfig,
} from "@/lib/configuracoes-types";
import { cleanPhone, formatPhone } from "@/lib/masks";
import { getRegistroSugestao } from "@/lib/registro-profissional";
import RegistroInput from "@/components/ui/RegistroInput";
import LinkAgendamento from "./LinkAgendamento";
import LinkCadastroPaciente from "./LinkCadastroPaciente";
import LinkPreConsulta from "./LinkPreConsulta";
import SecaoAcompanhamento from "./SecaoAcompanhamento";
import SecaoAssinatura from "./SecaoAssinatura";
import SecaoAvaliacoes from "./SecaoAvaliacoes";
import SecaoDicasFeatures from "./SecaoDicasFeatures";
import SecaoLogAcessoLGPD from "./SecaoLogAcessoLGPD";
import SecaoSMS from "./SecaoSMS";
import SecaoLogo from "./SecaoLogo";
import SecaoPlano from "./SecaoPlano";
import SecaoModulos from "./SecaoModulos";
import SecaoPushNotifications from "./SecaoPushNotifications";
import SecaoTemplatesMensagem from "./SecaoTemplatesMensagem";

const ESPECIALIDADES = [
  "Podologia",
  "Fisioterapia",
  "Terapia Ocupacional",
  "Nutrição",
  "Psicologia",
  "Odontologia",
  "Fonoaudiologia",
  "Medicina",
  "Cardiologia",
  "Enfermagem",
  "Outra",
];

const UF = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const inputClass =
  "w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10 disabled:bg-slate-50 disabled:text-slate-500";
const labelClass = "block text-[14px] font-medium text-slate-900";
const errorClass = "text-xs text-danger";

const profSchema = z
  .object({
    nome: z
      .string()
      .transform((s) => s.trim())
      .refine((s) => s.length >= 3, "Nome deve ter no mínimo 3 caracteres"),
    especialidade: z
      .string()
      .transform((s) => s.trim())
      .refine((s) => s.length >= 2, "Selecione uma especialidade"),
    registro_profissional: z.string(),
    telefone: z.string().refine((s) => {
      const d = cleanPhone(s);
      return d.length === 10 || d.length === 11;
    }, "Telefone inválido"),
    bio: z.string().max(300, "Máximo de 300 caracteres").optional(),
    intervalo_entre_consultas_min: z
      .number()
      .int()
      .refine(
        (n) => [0, 5, 10, 15, 20, 30].includes(n),
        "Intervalo inválido",
      ),
  })
  .superRefine((data, ctx) => {
    const sug = getRegistroSugestao(data.especialidade);
    const valor = (data.registro_profissional ?? "").trim();
    const sufixo = valor.startsWith(sug.prefixo)
      ? valor.slice(sug.prefixo.length).trim()
      : valor;
    if (sufixo.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["registro_profissional"],
        message: "Registro profissional obrigatório",
      });
    }
  });

const tenantSchema = z.object({
  nome_empresa: z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s.length >= 3, "Nome deve ter no mínimo 3 caracteres"),
  telefone: z
    .string()
    .optional()
    .refine((s) => {
      if (!s) return true;
      const d = cleanPhone(s);
      return d.length === 0 || d.length === 10 || d.length === 11;
    }, "Telefone inválido"),
  cidade: z.string().optional(),
  estado: z.string().optional(),
});

type ProfFormData = z.infer<typeof profSchema>;
type TenantFormData = z.infer<typeof tenantSchema>;

interface TabMeusDadosProps {
  profissional: ProfissionalConfig;
  tenant: TenantConfig;
  onSaved: () => void;
}

function TabMeusDados({ profissional, tenant, onSaved }: TabMeusDadosProps) {
  const [editandoProf, setEditandoProf] = useState(false);
  const [editandoTenant, setEditandoTenant] = useState(false);
  const [erroProf, setErroProf] = useState<string | null>(null);
  const [erroTenant, setErroTenant] = useState<string | null>(null);
  const [okProf, setOkProf] = useState(false);
  const [okTenant, setOkTenant] = useState(false);
  const [isPendingProf, startTransitionProf] = useTransition();
  const [isPendingTenant, startTransitionTenant] = useTransition();

  const podeEditarTenant = profissional.role === "admin";

  const profForm = useForm<ProfFormData>({
    resolver: zodResolver(profSchema),
    mode: "onBlur",
    defaultValues: {
      nome: profissional.nome,
      especialidade: profissional.especialidade,
      registro_profissional: profissional.registro_profissional ?? "",
      telefone: profissional.telefone ? formatPhone(profissional.telefone) : "",
      bio: profissional.bio ?? "",
      intervalo_entre_consultas_min:
        profissional.intervalo_entre_consultas_min ?? 0,
    },
  });

  const especialidadeAtual = profForm.watch("especialidade");
  const registroAtual = profForm.watch("registro_profissional") ?? "";
  // getRegistroSugestao usado para limpar campo ao trocar de especialidade
  void getRegistroSugestao;

  const handleEspecialidadeChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const nova = e.target.value;
    profForm.setValue("especialidade", nova, {
      shouldValidate: true,
      shouldDirty: true,
    });
    // Limpa o registro ao trocar de especialidade (o prefixo muda).
    profForm.setValue("registro_profissional", "", {
      shouldValidate: false,
      shouldDirty: true,
    });
  };

  const tenantForm = useForm<TenantFormData>({
    resolver: zodResolver(tenantSchema),
    mode: "onBlur",
    defaultValues: {
      nome_empresa: tenant.nome_empresa,
      telefone: tenant.telefone ? formatPhone(tenant.telefone) : "",
      cidade: tenant.cidade ?? "",
      estado: tenant.estado ?? "",
    },
  });

  const cancelarProf = () => {
    profForm.reset({
      nome: profissional.nome,
      especialidade: profissional.especialidade,
      registro_profissional: profissional.registro_profissional ?? "",
      telefone: profissional.telefone ? formatPhone(profissional.telefone) : "",
      bio: profissional.bio ?? "",
      intervalo_entre_consultas_min:
        profissional.intervalo_entre_consultas_min ?? 0,
    });
    setEditandoProf(false);
    setErroProf(null);
  };

  const cancelarTenant = () => {
    tenantForm.reset({
      nome_empresa: tenant.nome_empresa,
      telefone: tenant.telefone ? formatPhone(tenant.telefone) : "",
      cidade: tenant.cidade ?? "",
      estado: tenant.estado ?? "",
    });
    setEditandoTenant(false);
    setErroTenant(null);
  };

  const onSubmitProf = (data: ProfFormData) => {
    setErroProf(null);
    startTransitionProf(async () => {
      const result = await atualizarProfissional({
        nome: data.nome,
        especialidade: data.especialidade,
        registro_profissional: data.registro_profissional?.trim() || undefined,
        telefone: data.telefone,
        bio: data.bio?.trim() || undefined,
        intervalo_entre_consultas_min: data.intervalo_entre_consultas_min,
      });
      if (!result.ok) {
        setErroProf(result.error);
        return;
      }
      setEditandoProf(false);
      setOkProf(true);
      window.setTimeout(() => setOkProf(false), 2000);
      onSaved();
    });
  };

  const onSubmitTenant = (data: TenantFormData) => {
    setErroTenant(null);
    startTransitionTenant(async () => {
      const result = await atualizarTenant({
        nome_empresa: data.nome_empresa,
        telefone: data.telefone || undefined,
        cidade: data.cidade?.trim() || undefined,
        estado: data.estado?.trim() || undefined,
      });
      if (!result.ok) {
        setErroTenant(result.error);
        return;
      }
      setEditandoTenant(false);
      setOkTenant(true);
      window.setTimeout(() => setOkTenant(false), 2000);
      onSaved();
    });
  };

  return (
    <div className="space-y-6">
      <SecaoPlano />
      <SecaoModulos plano={tenant.plano} />
      <SecaoPushNotifications />
      <SecaoTemplatesMensagem />
      <LinkAgendamento slug={tenant.slug} />
      <LinkCadastroPaciente slug={tenant.slug} />
      <LinkPreConsulta slug={tenant.slug} />

      <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
        <header className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">Meus dados</h2>
          {!editandoProf ? (
            <button
              type="button"
              onClick={() => setEditandoProf(true)}
              className="rounded border border-primary px-3 py-1.5 text-xs font-medium text-primary-text hover:bg-primary-surface transition-colors"
            >
              Editar
            </button>
          ) : null}
        </header>

        {okProf ? (
          <p className="rounded border border-[#CCFBF1] bg-[#F0FDFA] px-3 py-2 text-xs font-medium text-[#115E59]">
            Dados atualizados
          </p>
        ) : null}

        <form
          onSubmit={profForm.handleSubmit(onSubmitProf)}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={labelClass}>Nome completo</label>
              <input
                {...profForm.register("nome")}
                type="text"
                disabled={!editandoProf}
                className={inputClass}
              />
              {profForm.formState.errors.nome ? (
                <p className={errorClass}>
                  {profForm.formState.errors.nome.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Especialidade</label>
              <select
                value={especialidadeAtual ?? ""}
                onChange={handleEspecialidadeChange}
                disabled={!editandoProf}
                className={inputClass}
              >
                <option value="">Selecione</option>
                {ESPECIALIDADES.map((esp) => (
                  <option key={esp} value={esp}>
                    {esp}
                  </option>
                ))}
              </select>
              {profForm.formState.errors.especialidade ? (
                <p className={errorClass}>
                  {profForm.formState.errors.especialidade.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <RegistroInput
                especialidade={especialidadeAtual}
                value={registroAtual}
                onChange={(v) =>
                  profForm.setValue("registro_profissional", v, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                disabled={!editandoProf}
                showHelper={editandoProf}
                required
              />
              {profForm.formState.errors.registro_profissional ? (
                <p className={`${errorClass} mt-1`}>
                  {profForm.formState.errors.registro_profissional.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Telefone</label>
              <input
                {...profForm.register("telefone", {
                  onChange: (e) => {
                    profForm.setValue("telefone", formatPhone(e.target.value), {
                      shouldDirty: true,
                    });
                  },
                })}
                type="tel"
                inputMode="tel"
                maxLength={15}
                disabled={!editandoProf}
                placeholder="(11) 99999-9999"
                className={inputClass}
              />
              {profForm.formState.errors.telefone ? (
                <p className={errorClass}>
                  {profForm.formState.errors.telefone.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1">
            <label className={labelClass}>Intervalo entre consultas</label>
            <select
              {...profForm.register("intervalo_entre_consultas_min", {
                valueAsNumber: true,
              })}
              disabled={!editandoProf}
              className={inputClass}
            >
              <option value={0}>0 min</option>
              <option value={5}>5 min</option>
              <option value={10}>10 min</option>
              <option value={15}>15 min</option>
              <option value={20}>20 min</option>
              <option value={30}>30 min</option>
            </select>
            <p className="text-xs text-slate-500">
              Tempo de descanso entre um paciente e outro
            </p>
            {profForm.formState.errors.intervalo_entre_consultas_min ? (
              <p className={errorClass}>
                {profForm.formState.errors.intervalo_entre_consultas_min.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label className={labelClass}>E-mail</label>
            <input
              type="email"
              value={profissional.email}
              disabled
              className={inputClass}
            />
            <p className="text-xs text-slate-500">
              Para alterar o e-mail, contate o suporte.
            </p>
          </div>

          <div className="space-y-1">
            <label className={labelClass}>Bio</label>
            <textarea
              {...profForm.register("bio")}
              rows={3}
              maxLength={300}
              disabled={!editandoProf}
              placeholder="Apresentação breve para o agendamento online"
              className={`${inputClass} resize-none`}
            />
            {profForm.formState.errors.bio ? (
              <p className={errorClass}>
                {profForm.formState.errors.bio.message}
              </p>
            ) : null}
          </div>

          {erroProf ? (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {erroProf}
            </p>
          ) : null}

          {editandoProf ? (
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                onClick={cancelarProf}
                disabled={isPendingProf}
                className="rounded px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPendingProf}
                className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {isPendingProf ? "Salvando..." : "Salvar"}
              </button>
            </div>
          ) : null}
        </form>
      </section>

      <SecaoLogo profissional={profissional} onSaved={onSaved} />

      <SecaoAssinatura profissional={profissional} onSaved={onSaved} />

      <SecaoAvaliacoes profissional={profissional} onSaved={onSaved} />

      <SecaoAcompanhamento profissional={profissional} onSaved={onSaved} />

      <SecaoSMS />

      <SecaoDicasFeatures />

      <SecaoLogAcessoLGPD role={profissional.role} />

      <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
        <header className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Dados da clínica
            </h2>
            {!podeEditarTenant ? (
              <p className="text-xs text-slate-500">
                Apenas administradores podem editar.
              </p>
            ) : null}
          </div>
          {podeEditarTenant && !editandoTenant ? (
            <button
              type="button"
              onClick={() => setEditandoTenant(true)}
              className="rounded border border-primary px-3 py-1.5 text-xs font-medium text-primary-text hover:bg-primary-surface transition-colors"
            >
              Editar
            </button>
          ) : null}
        </header>

        {okTenant ? (
          <p className="rounded border border-[#CCFBF1] bg-[#F0FDFA] px-3 py-2 text-xs font-medium text-[#115E59]">
            Dados atualizados
          </p>
        ) : null}

        <form
          onSubmit={tenantForm.handleSubmit(onSubmitTenant)}
          className="space-y-4"
        >
          <div className="space-y-1">
            <label className={labelClass}>Nome da empresa</label>
            <input
              {...tenantForm.register("nome_empresa")}
              type="text"
              disabled={!editandoTenant}
              className={inputClass}
            />
            {tenantForm.formState.errors.nome_empresa ? (
              <p className={errorClass}>
                {tenantForm.formState.errors.nome_empresa.message}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-1">
              <label className={labelClass}>Telefone</label>
              <input
                {...tenantForm.register("telefone", {
                  onChange: (e) => {
                    tenantForm.setValue(
                      "telefone",
                      formatPhone(e.target.value),
                      { shouldDirty: true },
                    );
                  },
                })}
                type="tel"
                inputMode="tel"
                maxLength={15}
                disabled={!editandoTenant}
                placeholder="(11) 3333-3333"
                className={inputClass}
              />
              {tenantForm.formState.errors.telefone ? (
                <p className={errorClass}>
                  {tenantForm.formState.errors.telefone.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1 sm:col-span-1">
              <label className={labelClass}>Cidade</label>
              <input
                {...tenantForm.register("cidade")}
                type="text"
                disabled={!editandoTenant}
                className={inputClass}
              />
            </div>

            <div className="space-y-1 sm:col-span-1">
              <label className={labelClass}>Estado</label>
              <select
                {...tenantForm.register("estado")}
                disabled={!editandoTenant}
                className={inputClass}
              >
                <option value="">UF</option>
                {UF.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {erroTenant ? (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {erroTenant}
            </p>
          ) : null}

          {editandoTenant ? (
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                onClick={cancelarTenant}
                disabled={isPendingTenant}
                className="rounded px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPendingTenant}
                className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {isPendingTenant ? "Salvando..." : "Salvar"}
              </button>
            </div>
          ) : null}
        </form>
      </section>
    </div>
  );
}

export default TabMeusDados;
