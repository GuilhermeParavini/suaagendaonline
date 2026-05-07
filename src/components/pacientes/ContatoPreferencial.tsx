"use client";

import { Mail, MessageCircle, MessageSquare, Phone } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/utils";

export const CONTATO_VALORES = [
  "whatsapp",
  "telefone",
  "email",
  "sms",
] as const;

export type ContatoCanal = (typeof CONTATO_VALORES)[number];

export const CONTATO_DEFAULT: ContatoCanal = "whatsapp";

type IconCmp = ComponentType<SVGProps<SVGSVGElement>>;

export const CONTATO_INFO: Record<
  ContatoCanal,
  {
    label: string;
    labelCurto: string;
    rotuloFicha: string;
    Icon: IconCmp;
  }
> = {
  whatsapp: {
    label: "WhatsApp",
    labelCurto: "WhatsApp",
    rotuloFicha: "Prefere WhatsApp",
    Icon: MessageCircle,
  },
  telefone: {
    label: "Telefone",
    labelCurto: "Telefone",
    rotuloFicha: "Prefere telefone",
    Icon: Phone,
  },
  email: {
    label: "E-mail",
    labelCurto: "E-mail",
    rotuloFicha: "Prefere e-mail",
    Icon: Mail,
  },
  sms: {
    label: "SMS",
    labelCurto: "SMS",
    rotuloFicha: "Prefere SMS",
    Icon: MessageSquare,
  },
};

export function normalizarContato(
  raw: string | null | undefined,
): ContatoCanal {
  if (raw && (CONTATO_VALORES as readonly string[]).includes(raw)) {
    return raw as ContatoCanal;
  }
  return CONTATO_DEFAULT;
}

// ---------------- Form input ----------------

interface ContatoPreferencialProps {
  value: ContatoCanal;
  onChange: (next: ContatoCanal) => void;
  /** Nome do grupo (necessario quando ha mais de um campo na pagina). */
  name?: string;
  /** Permite ocultar o titulo quando o form ja tem cabecalho proprio. */
  hideLabel?: boolean;
  /** Restricoes opcionais — esconde opcoes que nao se aplicam. */
  disponiveis?: ContatoCanal[];
}

function ContatoPreferencial({
  value,
  onChange,
  name = "contato_preferencial",
  hideLabel,
  disponiveis,
}: ContatoPreferencialProps) {
  const opcoes = (disponiveis ?? CONTATO_VALORES) as readonly ContatoCanal[];

  return (
    <fieldset className="space-y-2">
      {!hideLabel ? (
        <legend className="text-[14px] font-medium text-slate-900">
          Como prefere ser contatado?
        </legend>
      ) : null}
      <div
        role="radiogroup"
        aria-label="Canal de contato preferencial"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {opcoes.map((canal) => {
          const info = CONTATO_INFO[canal];
          const ativo = value === canal;
          const id = `${name}-${canal}`;
          return (
            <label
              key={canal}
              htmlFor={id}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-[14px] font-medium transition-colors min-h-[44px]",
                ativo
                  ? "border-primary bg-primary-surface text-[#0F766E]"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
              )}
            >
              <input
                id={id}
                type="radio"
                name={name}
                value={canal}
                checked={ativo}
                onChange={() => onChange(canal)}
                className="sr-only"
              />
              <info.Icon
                width={18}
                height={18}
                strokeWidth={1.5}
                aria-hidden="true"
                className={ativo ? "text-[#0F766E]" : "text-slate-500"}
              />
              <span>{info.labelCurto}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ---------------- Helpers de exibicao ----------------

interface PillProps {
  canal: ContatoCanal;
  className?: string;
}

export function PillContatoPreferencial({ canal, className }: PillProps) {
  const info = CONTATO_INFO[canal];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2 py-1 text-[12px] font-medium leading-none text-teal-700",
        className,
      )}
      aria-label={info.rotuloFicha}
    >
      <info.Icon width={12} height={12} strokeWidth={1.5} aria-hidden="true" />
      {info.rotuloFicha}
    </span>
  );
}

interface IconeProps {
  canal: ContatoCanal;
  className?: string;
  size?: number;
}

export function IconeContatoPreferencial({
  canal,
  className,
  size = 14,
}: IconeProps) {
  const info = CONTATO_INFO[canal];
  return (
    <span
      title={info.rotuloFicha}
      aria-label={info.rotuloFicha}
      className={cn("inline-flex items-center text-teal-700", className)}
    >
      <info.Icon
        width={size}
        height={size}
        strokeWidth={1.5}
        aria-hidden="true"
      />
    </span>
  );
}

export default ContatoPreferencial;
