"use client";

import { useState, useTransition } from "react";
import { Heart, Mail, MessageCircle, Phone, SkipForward } from "lucide-react";
import {
  marcarAftercare,
  type AftercarePendenteItem,
  type AftercareTipo,
} from "@/actions/aftercare";
import BotaoWhatsApp from "@/components/ui/BotaoWhatsApp";
import { cn } from "@/lib/utils";

interface CardAftercareProps {
  itens: AftercarePendenteItem[];
}

const LABEL_TIPO: Record<AftercareTipo, string> = {
  como_esta: "Como esta?",
  lembrete_cuidados: "Lembrete de cuidados",
  retorno: "Convite para retorno",
};

function diasLabel(d: number | null): string {
  if (d === null) return "—";
  if (d === 0) return "hoje";
  if (d === 1) return "ontem";
  return `ha ${d} dias`;
}

function CardAftercare({ itens: itensIniciais }: CardAftercareProps) {
  const [itens, setItens] = useState<AftercarePendenteItem[]>(itensIniciais);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (itens.length === 0) return null;

  const visiveis = itens.slice(0, 5);
  const resto = itens.length - visiveis.length;

  const remover = (id: string) => {
    setItens((prev) => prev.filter((t) => t.id !== id));
  };

  const marcar = (id: string, status: "enviado" | "pulado") => {
    setErro(null);
    setPendingId(id);
    startTransition(async () => {
      const r = await marcarAftercare(id, status);
      setPendingId(null);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      remover(id);
    });
  };

  return (
    <section
      aria-label="Acompanhamento pendente"
      className="rounded-xl border border-primary/30 bg-primary-surface p-5 space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <Heart
            size={18}
            strokeWidth={1.5}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-primary-text"
          />
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-slate-900">
              Acompanhamento pendente
            </h2>
            <p className="text-[13px] text-slate-700">
              {itens.length}{" "}
              {itens.length === 1 ? "mensagem" : "mensagens"} para enviar
            </p>
          </div>
        </div>
      </header>

      <ul className="space-y-2">
        {visiveis.map((item) => (
          <ItemAftercare
            key={item.id}
            item={item}
            disabled={pendingId === item.id}
            onEnviado={() => marcar(item.id, "enviado")}
            onPulado={() => marcar(item.id, "pulado")}
          />
        ))}
      </ul>

      {erro ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
          {erro}
        </p>
      ) : null}

      {resto > 0 ? (
        <button
          type="button"
          onClick={() =>
            window.alert(
              "A pagina dedicada de acompanhamento sera disponibilizada em breve.",
            )
          }
          className="text-[13px] font-medium text-primary-text hover:underline"
        >
          Ver todos ({itens.length})
        </button>
      ) : null}
    </section>
  );
}

function ItemAftercare({
  item,
  disabled,
  onEnviado,
  onPulado,
}: {
  item: AftercarePendenteItem;
  disabled: boolean;
  onEnviado: () => void;
  onPulado: () => void;
}) {
  const subtitulo = `${LABEL_TIPO[item.tipo]} · ${diasLabel(item.diasDesdeConsulta)}`;

  return (
    <li className="rounded-lg bg-white border border-slate-200 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-slate-900 truncate">
            {item.paciente.nome}
          </p>
          <p className="text-[12px] text-slate-500">{subtitulo}</p>
        </div>
        <span
          className={cn(
            "shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[11px] font-medium",
            item.canal === "whatsapp"
              ? "bg-[#D1FAE5] text-[#065F46]"
              : item.canal === "email"
                ? "bg-info-surface text-[#1E40AF]"
                : "bg-slate-100 text-slate-600",
          )}
        >
          {item.canal === "whatsapp" ? (
            <MessageCircle size={11} strokeWidth={2} aria-hidden="true" />
          ) : item.canal === "email" ? (
            <Mail size={11} strokeWidth={2} aria-hidden="true" />
          ) : (
            <Phone size={11} strokeWidth={2} aria-hidden="true" />
          )}
          {item.canal === "whatsapp"
            ? "WhatsApp"
            : item.canal === "email"
              ? "E-mail"
              : item.canal === "sms"
                ? "SMS"
                : "Telefone"}
        </span>
      </div>

      <p className="rounded bg-slate-50 px-2 py-1.5 text-[12px] text-slate-700 line-clamp-3">
        {item.mensagem}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {item.canal === "email" && item.paciente.email ? (
          <a
            href={`mailto:${encodeURIComponent(item.paciente.email)}?subject=${encodeURIComponent("Acompanhamento pos-consulta")}&body=${encodeURIComponent(item.mensagem)}`}
            onClick={() => onEnviado()}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-3 py-2 text-[13px] font-medium text-white hover:bg-primary-dark transition-colors"
          >
            <Mail size={14} strokeWidth={1.5} aria-hidden="true" />
            Enviar e-mail
          </a>
        ) : item.paciente.telefone ? (
          <span onClick={() => onEnviado()} className="inline-flex">
            <BotaoWhatsApp
              telefone={item.paciente.telefone}
              mensagem={item.mensagem}
              size="sm"
              label="Enviar"
            />
          </span>
        ) : (
          <span className="text-[12px] text-slate-500">
            Sem contato disponivel.
          </span>
        )}
        <button
          type="button"
          onClick={onPulado}
          disabled={disabled}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          <SkipForward size={13} strokeWidth={1.5} aria-hidden="true" />
          Pular
        </button>
      </div>
    </li>
  );
}

export default CardAftercare;
