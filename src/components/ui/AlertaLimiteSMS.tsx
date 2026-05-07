"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";
import {
  alertaSMSDispensadoHoje,
  dispensarAlertaSMS,
  lerModuloSMSAtivo,
} from "@/lib/sms-prefs";
import { cn } from "@/lib/utils";

interface AlertaLimiteSMSProps {
  usado: number;
  limite: number;
}

function AlertaLimiteSMS({ usado, limite }: AlertaLimiteSMSProps) {
  const [pronto, setPronto] = useState(false);
  const [dispensado, setDispensado] = useState(false);
  const [moduloAtivo, setModuloAtivo] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDispensado(alertaSMSDispensadoHoje());
    setModuloAtivo(lerModuloSMSAtivo());
    setPronto(true);
  }, []);

  if (!pronto || !moduloAtivo || dispensado) return null;
  if (limite <= 0) return null;

  const percentual = (usado / limite) * 100;
  if (percentual < 80) return null;

  const limiteAtingido = usado >= limite;
  const corClasse = limiteAtingido
    ? "border-red-200 bg-red-50 text-red-900"
    : "border-amber-200 bg-amber-50 text-amber-900";
  const iconeClasse = limiteAtingido ? "text-red-600" : "text-amber-600";

  const handleDispensar = () => {
    dispensarAlertaSMS();
    setDispensado(true);
  };

  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border px-4 py-3 flex items-start gap-3",
        corClasse,
      )}
    >
      <AlertTriangle
        size={18}
        strokeWidth={1.5}
        aria-hidden="true"
        className={cn("mt-0.5 shrink-0", iconeClasse)}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium leading-snug">
          {limiteAtingido
            ? "Limite de SMS atingido! SMS automaticos estao pausados."
            : `Voce usou ${Math.round(percentual)}% do seu limite de SMS este mes. Considere fazer upgrade.`}
        </p>
        <Link
          href="/configuracoes"
          className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold underline-offset-2 hover:underline"
        >
          Ver pacotes
        </Link>
      </div>
      <button
        type="button"
        onClick={handleDispensar}
        aria-label="Dispensar alerta"
        className={cn(
          "shrink-0 rounded p-1 transition-colors",
          limiteAtingido ? "hover:bg-red-100" : "hover:bg-amber-100",
        )}
      >
        <X size={14} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  );
}

export default AlertaLimiteSMS;
