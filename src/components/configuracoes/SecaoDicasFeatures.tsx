"use client";

import { useEffect, useState } from "react";
import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "suaagendaonline:dicas_features:optin:v1";

function lerOptin(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === null) return true;
    return v === "1";
  } catch {
    return true;
  }
}

function gravarOptin(valor: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, valor ? "1" : "0");
  } catch {
    // ignore — modo privado pode bloquear
  }
}

function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-primary" : "bg-slate-300",
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

/**
 * Toggle (apenas client-side via localStorage) para receber emails educativos
 * sobre funcionalidades do sistema. O CRON quinzenal `/api/cron/feature-discovery`
 * envia as dicas; o opt-out de fato persiste em coluna `enviar_dicas_features`
 * dos profissionais quando essa coluna existir no banco.
 */
function SecaoDicasFeatures() {
  const [pronto, setPronto] = useState(false);
  const [optin, setOptin] = useState(true);

  useEffect(() => {
    // Hidratacao do localStorage. Sem isso o SSR exibe diferente do client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOptin(lerOptin());
    setPronto(true);
  }, []);

  if (!pronto) return null;

  const toggle = () => {
    const novo = !optin;
    setOptin(novo);
    gravarOptin(novo);
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <Lightbulb
            size={18}
            strokeWidth={1.5}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-primary-text"
          />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">
              Receber dicas por email
            </h2>
            <p className="text-xs text-slate-500">
              Aprenda como usar funcionalidades que voce ainda nao explorou
              (estoque, planos de tratamento, transcricao, etc). Enviamos no
              maximo duas vezes por mes.
            </p>
          </div>
        </div>
        <Switch checked={optin} onChange={toggle} />
      </header>
    </section>
  );
}

export default SecaoDicasFeatures;
