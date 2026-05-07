"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { lerModuloSMSAtivo } from "@/lib/sms-prefs";
import { cn } from "@/lib/utils";

interface CardUsoSMSProps {
  usado: number;
  limite: number;
  /** Limite vindo de pacotes (addons). Quando 0, so ha degustacao gratis. */
  limiteAddon: number;
}

function corBarra(percentual: number): string {
  if (percentual > 85) return "bg-[#DC2626]";
  if (percentual >= 60) return "bg-[#F59E0B]";
  return "bg-primary";
}

function CardUsoSMS({ usado, limite, limiteAddon }: CardUsoSMSProps) {
  // Hidratacao do localStorage. Em SSR a UI ja renderiza assumindo modulo
  // ativo (default), depois ajusta no client se o usuario desligou.
  const [moduloAtivo, setModuloAtivo] = useState(true);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModuloAtivo(lerModuloSMSAtivo());
    setPronto(true);
  }, []);

  if (!pronto || !moduloAtivo) return null;

  const percentual = limite > 0 ? Math.min(100, (usado / limite) * 100) : 0;
  const disponivel = Math.max(0, limite - usado);
  const limiteAtingido = usado >= limite;
  const semAddon = limiteAddon === 0;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare
            size={18}
            strokeWidth={1.5}
            aria-hidden="true"
            className="text-primary-text"
          />
          <h2 className="text-[16px] font-semibold text-slate-900">
            SMS este mes
          </h2>
        </div>
      </header>

      <div className="space-y-1">
        <p className="text-[24px] font-semibold leading-tight text-slate-900">
          {usado}
          <span className="text-slate-500 font-normal">
            {" "}
            de {limite} enviados
          </span>
        </p>
      </div>

      <div
        className="h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={limite}
        aria-valuenow={usado}
        aria-label="Uso de SMS no mes"
      >
        <div
          className={cn(
            "h-full transition-all duration-300",
            corBarra(percentual),
          )}
          style={{ width: `${percentual}%` }}
        />
      </div>

      {limiteAtingido ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] font-medium text-[#DC2626]">
            Limite atingido!
          </p>
          <Link
            href="/configuracoes"
            className="inline-flex items-center gap-1 rounded-lg border border-primary bg-white px-3 py-1.5 text-[13px] font-medium text-primary-text hover:bg-primary-surface transition-colors"
          >
            Contratar mais
          </Link>
        </div>
      ) : (
        <p className="text-[13px] text-slate-500">
          {disponivel} {disponivel === 1 ? "SMS disponivel" : "SMS disponiveis"}
          {semAddon ? " · 10 SMS gratis/mes" : ""}
        </p>
      )}

      {semAddon ? (
        <Link
          href="/configuracoes"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-primary-text hover:underline"
        >
          Contratar pacote para mais
        </Link>
      ) : null}
    </section>
  );
}

export default CardUsoSMS;
