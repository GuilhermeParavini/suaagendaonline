"use client";

import { MessageCircle } from "lucide-react";
import {
  COR_WHATSAPP,
  COR_WHATSAPP_HOVER,
  gerarLinkWhatsApp,
} from "@/lib/whatsapp-templates";
import { cn } from "@/lib/utils";

export type VariantBotaoWhatsApp =
  | "confirmacao"
  | "lembrete"
  | "pre_consulta"
  | "documento"
  | "retorno"
  | "generico";

interface BotaoWhatsAppProps {
  /** Telefone do destinatario (com ou sem mascara). Se ausente, abre WhatsApp pedindo o numero. */
  telefone?: string | null;
  /** Mensagem ja renderizada que sera colocada no parametro `text` do link. */
  mensagem: string;
  variant?: VariantBotaoWhatsApp;
  size?: "sm" | "md";
  className?: string;
  disabled?: boolean;
  /** Sobrescreve o rotulo padrao da variant. */
  label?: string;
}

const LABELS: Record<VariantBotaoWhatsApp, string> = {
  confirmacao: "Enviar confirmacao",
  lembrete: "Enviar lembrete",
  pre_consulta: "Enviar pre-consulta",
  documento: "Enviar via WhatsApp",
  retorno: "Convidar para retorno",
  generico: "Abrir WhatsApp",
};

function BotaoWhatsApp({
  telefone,
  mensagem,
  variant = "generico",
  size = "md",
  className,
  disabled,
  label,
}: BotaoWhatsAppProps) {
  const link = gerarLinkWhatsApp(telefone, mensagem);
  const preview = mensagem
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  const tooltip = preview ? `Pre-visualizacao: ${preview}` : undefined;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    // Deixa o navegador seguir o link por padrao (target="_blank"), mas usa
    // window.open para garantir popup-blockers respeitarem o user gesture.
    e.preventDefault();
    window.open(link, "_blank", "noopener,noreferrer");
  };

  const tamanho =
    size === "sm"
      ? "px-3 py-2 text-[13px]"
      : "px-4 py-2.5 text-[14px]";

  return (
    <a
      href={link}
      onClick={handleClick}
      target="_blank"
      rel="noopener noreferrer"
      title={tooltip}
      aria-disabled={disabled || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium text-white transition-colors",
        "min-h-[44px]",
        tamanho,
        disabled && "opacity-50 pointer-events-none",
        className,
      )}
      style={{ backgroundColor: COR_WHATSAPP }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = COR_WHATSAPP_HOVER;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = COR_WHATSAPP;
      }}
    >
      <MessageCircle
        size={size === "sm" ? 14 : 16}
        strokeWidth={1.5}
        aria-hidden="true"
      />
      {label ?? LABELS[variant]}
    </a>
  );
}

export default BotaoWhatsApp;
