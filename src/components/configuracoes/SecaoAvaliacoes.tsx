"use client";

import { useState, useTransition } from "react";
import { atualizarEnviarAvaliacao } from "@/actions/avaliacoes";
import type { ProfissionalConfig } from "@/lib/configuracoes-types";
import { cn } from "@/lib/utils";

interface SecaoAvaliacoesProps {
  profissional: ProfissionalConfig;
  onSaved: () => void;
}

function SecaoAvaliacoes({ profissional, onSaved }: SecaoAvaliacoesProps) {
  const [enviar, setEnviar] = useState<boolean>(profissional.enviar_avaliacao);
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    const novo = !enviar;
    setEnviar(novo);
    setErro(null);
    setOkMsg(null);
    startTransition(async () => {
      const r = await atualizarEnviarAvaliacao(novo);
      if (!r.ok) {
        setEnviar(!novo);
        setErro(r.error);
        return;
      }
      setOkMsg(novo ? "Envio ativado" : "Envio desativado");
      window.setTimeout(() => setOkMsg(null), 2000);
      onSaved();
    });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
      <header className="space-y-1">
        <h2 className="text-base font-semibold text-slate-900">Avaliações</h2>
        <p className="text-xs text-slate-500">
          Após cada consulta concluída, o paciente pode receber um email para
          avaliar o atendimento.
        </p>
      </header>

      {okMsg ? (
        <p className="rounded border border-[#CCFBF1] bg-[#F0FDFA] px-3 py-2 text-xs font-medium text-[#115E59]">
          {okMsg}
        </p>
      ) : null}

      <label className="flex items-center justify-between gap-3 cursor-pointer">
        <span className="text-sm text-slate-700">
          Enviar email de avaliação após consulta
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={enviar}
          onClick={handleToggle}
          disabled={isPending}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
            enviar ? "bg-primary" : "bg-slate-300",
            isPending && "opacity-50",
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
              enviar ? "translate-x-6" : "translate-x-1",
            )}
          />
        </button>
      </label>

      {erro ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {erro}
        </p>
      ) : null}
    </section>
  );
}

export default SecaoAvaliacoes;
