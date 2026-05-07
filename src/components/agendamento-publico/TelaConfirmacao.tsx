"use client";

import {
  CalendarPlus,
  Calendar,
  Clock,
  Download,
  ExternalLink,
  MapPin,
  Phone,
  Scissors,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { gerarLinkMaps } from "@/lib/whatsapp-templates";
import BotaoWhatsApp from "@/components/ui/BotaoWhatsApp";
import { cleanPhone, formatPhone } from "@/lib/masks";
import { cn } from "@/lib/utils";

interface TelaConfirmacaoProps {
  /** Titulo principal (ex: "Agendamento confirmado!") */
  titulo?: string;
  /** Subtitulo (ex: "Voce recebera um email...") */
  subtitulo?: string;
  /** Data + hora da consulta. Sempre em UTC para evitar troca de dia. */
  dataIso: string; // YYYY-MM-DD
  hora: string; // HH:MM
  duracaoMin: number;
  profissionalNome: string;
  profissionalEspecialidade: string | null;
  procedimentoNome: string | null;
  /** Endereco/cidade/estado/telefone do consultorio (opcionais — se ausentes, o bloco esconde a linha). */
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  telefoneClinica?: string | null;
  /** Link discreto exibido ao final (ex: voltar ao inicio, ou perfil publico). */
  linkVoltar?: { href: string; label: string } | null;
}

const PALETA_TITULO = "text-[22px] font-semibold text-slate-900";

function ymd(dataIso: string): { y: number; m: number; d: number } {
  const [y, m, d] = dataIso.split("-").map(Number);
  return { y, m, d };
}

function dataExtensoUtc(dataIso: string): string {
  const { y, m, d } = ymd(dataIso);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const txt = format(dt, "EEEE, d 'de' MMMM 'de' yyyy", {
    locale: ptBR,
    timeZone: "UTC",
  } as Parameters<typeof format>[2]);
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

/**
 * Constroi DTSTART/DTEND no fuso UTC no formato YYYYMMDDTHHmmssZ exigido pelo
 * Google Calendar e arquivos .ics. As datas/horarios do agendamento ja sao
 * tratados como UTC pelo banco (mesma convencao usada na agenda).
 */
function montarDatas(
  dataIso: string,
  hora: string,
  duracaoMin: number,
): { inicioUtc: string; fimUtc: string; inicioDate: Date; fimDate: Date } {
  const { y, m, d } = ymd(dataIso);
  const [hh, mm] = hora.split(":").map(Number);
  const inicio = new Date(Date.UTC(y, m - 1, d, hh, mm, 0, 0));
  const fim = new Date(inicio.getTime() + duracaoMin * 60 * 1000);
  const fmt = (date: Date) =>
    `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(
      date.getUTCDate(),
    ).padStart(2, "0")}T${String(date.getUTCHours()).padStart(2, "0")}${String(
      date.getUTCMinutes(),
    ).padStart(2, "0")}${String(date.getUTCSeconds()).padStart(2, "0")}Z`;
  return {
    inicioUtc: fmt(inicio),
    fimUtc: fmt(fim),
    inicioDate: inicio,
    fimDate: fim,
  };
}

function montarLinkGoogleCalendar(opts: {
  titulo: string;
  inicioUtc: string;
  fimUtc: string;
  endereco: string | null;
  detalhes: string;
}): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.titulo,
    dates: `${opts.inicioUtc}/${opts.fimUtc}`,
    details: opts.detalhes,
  });
  if (opts.endereco) params.set("location", opts.endereco);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Escapa virgulas, ponto-e-virgulas e quebras conforme RFC 5545. Linhas no
 * .ics nao devem exceder 75 octets — para mensagens curtas (titulo, endereco,
 * descricao) nao chegamos perto, entao mantemos uma linha so.
 */
function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function montarConteudoIcs(opts: {
  titulo: string;
  inicioUtc: string;
  fimUtc: string;
  endereco: string | null;
  descricao: string;
  uid: string;
}): string {
  const agoraUtc = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//suaagendaonline//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${agoraUtc}`,
    `DTSTART:${opts.inicioUtc}`,
    `DTEND:${opts.fimUtc}`,
    `SUMMARY:${escapeIcs(opts.titulo)}`,
    `DESCRIPTION:${escapeIcs(opts.descricao)}`,
  ];
  if (opts.endereco) linhas.push(`LOCATION:${escapeIcs(opts.endereco)}`);
  linhas.push("END:VEVENT", "END:VCALENDAR");
  return linhas.join("\r\n");
}

function TelaConfirmacao({
  titulo = "Agendamento confirmado!",
  subtitulo = "Voce recebera um email de confirmacao.",
  dataIso,
  hora,
  duracaoMin,
  profissionalNome,
  profissionalEspecialidade,
  procedimentoNome,
  endereco,
  cidade,
  estado,
  telefoneClinica,
  linkVoltar = null,
}: TelaConfirmacaoProps) {
  const dataLabel = dataExtensoUtc(dataIso);
  const enderecoCompleto =
    [endereco, [cidade, estado].filter(Boolean).join(" - ") || null]
      .filter((s): s is string => Boolean(s && s.trim()))
      .join(", ") || null;
  const linkMaps = gerarLinkMaps(endereco, cidade, estado);

  const { inicioUtc, fimUtc } = montarDatas(dataIso, hora, duracaoMin);
  const tituloEvento = `Consulta - ${profissionalNome}`;
  const detalhesEvento = [
    procedimentoNome ? `Procedimento: ${procedimentoNome}` : null,
    enderecoCompleto ? `Endereco: ${enderecoCompleto}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const linkGoogleCalendar = montarLinkGoogleCalendar({
    titulo: tituloEvento,
    inicioUtc,
    fimUtc,
    endereco: enderecoCompleto,
    detalhes: detalhesEvento,
  });

  const handleBaixarIcs = () => {
    const conteudo = montarConteudoIcs({
      titulo: tituloEvento,
      inicioUtc,
      fimUtc,
      endereco: enderecoCompleto,
      descricao: detalhesEvento,
      uid: `${dataIso}-${hora.replace(":", "")}-${profissionalNome
        .replace(/\s+/g, "-")
        .toLowerCase()}@suaagendaonline`,
    });
    const blob = new Blob([conteudo], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `consulta-${dataIso}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const mensagemAutoWhatsApp = [
    `Minha consulta: ${dataLabel} as ${hora}`,
    `Profissional: ${profissionalNome}`,
    procedimentoNome ? `Procedimento: ${procedimentoNome}` : null,
    enderecoCompleto ? `Endereco: ${enderecoCompleto}` : null,
    linkMaps ? `Como chegar: ${linkMaps}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const mensagemReagendarWhatsApp =
    `Ola! Preciso falar sobre meu agendamento de ${dataLabel} as ${hora} ` +
    `com ${profissionalNome}.`;

  const telDigits = cleanPhone(telefoneClinica ?? "");
  const profissionalLabel = profissionalEspecialidade
    ? `${profissionalNome} - ${profissionalEspecialidade}`
    : profissionalNome;

  return (
    <div className="space-y-6 pt-2">
      <CheckmarkAnimado />

      <div className="space-y-1 text-center">
        <h2 className={PALETA_TITULO}>{titulo}</h2>
        <p className="text-[14px] text-slate-500">{subtitulo}</p>
      </div>

      <section className="rounded-xl border border-teal-100 bg-white p-4 space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <ItemConfirmacao
          Icon={Calendar}
          label="Data"
          valor={dataLabel}
        />
        <ItemConfirmacao
          Icon={Clock}
          label="Horario"
          valor={`${hora} (${duracaoMin} min)`}
        />
        <ItemConfirmacao
          Icon={User}
          label="Profissional"
          valor={profissionalLabel}
        />
        {procedimentoNome ? (
          <ItemConfirmacao
            Icon={Scissors}
            label="Procedimento"
            valor={procedimentoNome}
          />
        ) : null}
        {enderecoCompleto ? (
          <div className="flex items-start gap-2.5">
            <MapPin
              size={18}
              strokeWidth={1.5}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-primary-text"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-[14px] text-slate-900 leading-snug">
                {enderecoCompleto}
              </p>
              {linkMaps ? (
                <a
                  href={linkMaps}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[13px] font-medium text-primary-text hover:underline"
                >
                  Como chegar
                  <ExternalLink
                    size={12}
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
        {telDigits ? (
          <div className="flex items-start gap-2.5">
            <Phone
              size={18}
              strokeWidth={1.5}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-primary-text"
            />
            <a
              href={`tel:+55${telDigits}`}
              className="text-[14px] font-medium text-primary-text hover:underline"
            >
              {formatPhone(telDigits)}
            </a>
          </div>
        ) : null}
      </section>

      <div className="space-y-2">
        <a
          href={linkGoogleCalendar}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary bg-white px-4 py-3 text-[14px] font-medium text-primary-text hover:bg-primary-surface transition-colors min-h-[44px]"
        >
          <CalendarPlus size={16} strokeWidth={1.5} aria-hidden="true" />
          Adicionar ao Google Calendar
        </a>
        <button
          type="button"
          onClick={handleBaixarIcs}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-[14px] font-medium text-slate-700 hover:bg-slate-50 transition-colors min-h-[44px]"
        >
          <Download size={16} strokeWidth={1.5} aria-hidden="true" />
          Baixar lembrete (.ics)
        </button>
        <BotaoWhatsApp
          telefone={null}
          mensagem={mensagemAutoWhatsApp}
          variant="generico"
          label="Salvar no WhatsApp"
          className="w-full"
        />
      </div>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
        <p className="text-[14px] font-medium text-slate-900">
          Precisa reagendar?
        </p>
        <p className="text-[13px] text-slate-600 leading-relaxed">
          Caso precise alterar, use o link no email de confirmacao ou entre em
          contato:
        </p>
        <div className="flex flex-col gap-2">
          {telDigits ? (
            <a
              href={`tel:+55${telDigits}`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[14px] font-medium text-slate-700 hover:bg-slate-100 transition-colors min-h-[44px]"
            >
              <Phone size={14} strokeWidth={1.5} aria-hidden="true" />
              {formatPhone(telDigits)}
            </a>
          ) : null}
          {telDigits ? (
            <BotaoWhatsApp
              telefone={telDigits}
              mensagem={mensagemReagendarWhatsApp}
              variant="generico"
              size="sm"
              label="Falar com a clinica no WhatsApp"
              className="w-full"
            />
          ) : null}
        </div>
      </section>

      {linkVoltar ? (
        <div className="text-center">
          <a
            href={linkVoltar.href}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            {linkVoltar.label}
          </a>
        </div>
      ) : null}
    </div>
  );
}

function ItemConfirmacao({
  Icon,
  label,
  valor,
}: {
  Icon: typeof Calendar;
  label: string;
  valor: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon
        size={18}
        strokeWidth={1.5}
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-primary-text"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p className="text-[14px] font-medium text-slate-900 break-words">
          {valor}
        </p>
      </div>
    </div>
  );
}

/**
 * Animacao puramente CSS (sem framer-motion ou similar): circulo verde com
 * scale-bounce e check com stroke-dasharray "desenhando" sequencialmente.
 *
 * Usa `prefers-reduced-motion` para anular a animacao em quem desabilitou.
 */
function CheckmarkAnimado() {
  return (
    <div
      role="img"
      aria-label="Sucesso"
      className="mx-auto flex h-20 w-20 items-center justify-center"
    >
      <style>{`
        @keyframes sao-circle-pop {
          0% { transform: scale(0); }
          60% { transform: scale(1.1); }
          80% { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
        @keyframes sao-check-draw {
          to { stroke-dashoffset: 0; }
        }
        .sao-confirm-circle {
          width: 80px;
          height: 80px;
          border-radius: 9999px;
          background-color: #22C55E;
          display: flex;
          align-items: center;
          justify-content: center;
          transform-origin: center;
          animation: sao-circle-pop 480ms cubic-bezier(0.25, 1.5, 0.5, 1) forwards;
        }
        .sao-confirm-check {
          fill: none;
          stroke: #FFFFFF;
          stroke-width: 4;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 36;
          stroke-dashoffset: 36;
          animation: sao-check-draw 320ms ease-out 320ms forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .sao-confirm-circle { animation: none; transform: none; }
          .sao-confirm-check { animation: none; stroke-dashoffset: 0; }
        }
      `}</style>
      <div className={cn("sao-confirm-circle")}>
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path className="sao-confirm-check" d="M5 12.5 L10 17.5 L19 7.5" />
        </svg>
      </div>
    </div>
  );
}

export default TelaConfirmacao;
