"use client";

import { useState, useTransition } from "react";
import { atualizarPreferenciasFollowup } from "@/actions/followup";
import type { ProfissionalConfig } from "@/actions/configuracoes";
import { cn } from "@/lib/utils";

interface SecaoAcompanhamentoProps {
  profissional: ProfissionalConfig;
  onSaved: () => void;
}

const labelClass = "block text-[14px] font-medium text-slate-900";

function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-primary" : "bg-slate-300",
        disabled && "opacity-50",
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}

function SecaoAcompanhamento({
  profissional,
  onSaved,
}: SecaoAcompanhamentoProps) {
  const [enviarFollowup, setEnviarFollowup] = useState<boolean>(
    profissional.enviar_followup,
  );
  const [mostrarDashboard, setMostrarDashboard] = useState<boolean>(
    profissional.mostrar_acompanhamento,
  );
  const [mensagem, setMensagem] = useState<string>(
    profissional.followup_mensagem ?? "",
  );
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const persistir = (
    patch: Partial<{
      enviar_followup: boolean;
      mostrar_acompanhamento: boolean;
      followup_mensagem: string;
    }>,
    msgOk: string,
  ) => {
    setErro(null);
    setOkMsg(null);
    startTransition(async () => {
      const r = await atualizarPreferenciasFollowup(patch);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setOkMsg(msgOk);
      window.setTimeout(() => setOkMsg(null), 2000);
      onSaved();
    });
  };

  const toggleEnviarFollowup = () => {
    const novo = !enviarFollowup;
    setEnviarFollowup(novo);
    persistir(
      { enviar_followup: novo },
      novo ? "Email automático ativado" : "Email automático desativado",
    );
  };

  const toggleMostrarDashboard = () => {
    const novo = !mostrarDashboard;
    setMostrarDashboard(novo);
    persistir(
      { mostrar_acompanhamento: novo },
      novo ? "Lista ativada no dashboard" : "Lista desativada no dashboard",
    );
  };

  const salvarMensagem = () => {
    if (mensagem.length > 500) {
      setErro("Mensagem acima de 500 caracteres.");
      return;
    }
    persistir({ followup_mensagem: mensagem }, "Mensagem salva");
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
      <header className="space-y-1">
        <h2 className="text-base font-semibold text-slate-900">
          Acompanhamento pós-consulta
        </h2>
        <p className="text-xs text-slate-500">
          Cuide dos pacientes após o atendimento com email automático e
          acompanhamento por WhatsApp pelo Dashboard.
        </p>
      </header>

      {okMsg ? (
        <p className="rounded border border-[#CCFBF1] bg-[#F0FDFA] px-3 py-2 text-xs font-medium text-[#115E59]">
          {okMsg}
        </p>
      ) : null}

      <div className="space-y-3">
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-sm text-slate-700">
            Enviar email automático 24h após consulta
          </span>
          <Switch
            checked={enviarFollowup}
            onChange={toggleEnviarFollowup}
            disabled={isPending}
          />
        </label>

        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-sm text-slate-700">
            Mostrar lista de acompanhamento no Dashboard
          </span>
          <Switch
            checked={mostrarDashboard}
            onChange={toggleMostrarDashboard}
            disabled={isPending}
          />
        </label>
      </div>

      <div className="space-y-1">
        <label className={labelClass}>Mensagem personalizada</label>
        <textarea
          rows={3}
          maxLength={500}
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          placeholder="Adicione uma mensagem pessoal ao email de acompanhamento. Ex: Lembre-se de aplicar gelo na região..."
          className="w-full resize-y rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
        />
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-slate-500">{mensagem.length}/500</p>
          <button
            type="button"
            onClick={salvarMensagem}
            disabled={isPending}
            className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {isPending ? "Salvando..." : "Salvar mensagem"}
          </button>
        </div>
      </div>

      {erro ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {erro}
        </p>
      ) : null}
    </section>
  );
}

export default SecaoAcompanhamento;
