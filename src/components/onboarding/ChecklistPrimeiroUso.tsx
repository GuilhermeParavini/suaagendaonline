"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Stethoscope,
  Image as ImageIcon,
  PenTool,
  UserPlus,
  CalendarPlus,
  Share2,
  CreditCard,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  getChecklistStatus,
  type ChecklistStatus,
} from "@/actions/onboarding-checklist";
import {
  checklistConcluidoExpirou,
  lerChecklistCompletoEm,
  lerLinkCompartilhado,
  marcarChecklistCompletoAgora,
} from "@/lib/onboarding-flags";
import { cn } from "@/lib/utils";

type PassoId =
  | "horarios"
  | "procedimentos"
  | "logo"
  | "assinatura"
  | "paciente"
  | "agendamento"
  | "link_compartilhado"
  | "plano";

type PassoDef = {
  id: PassoId;
  titulo: string;
  descricao: string;
  href: string;
  Icon: LucideIcon;
};

const PASSOS: PassoDef[] = [
  {
    id: "horarios",
    titulo: "Configure seus horários de atendimento",
    descricao:
      "Defina em quais dias e horários você atende. Sem isso, pacientes não conseguem agendar.",
    href: "/configuracoes?tab=horarios",
    Icon: Clock,
  },
  {
    id: "procedimentos",
    titulo: "Cadastre seus procedimentos",
    descricao:
      "Adicione os serviços que você oferece com duração e preço. Seus pacientes vão escolher na hora de agendar.",
    href: "/configuracoes?tab=procedimentos",
    Icon: Stethoscope,
  },
  {
    id: "logo",
    titulo: "Adicione a logo da sua clínica",
    descricao:
      "Sua logo aparece nos e-mails, recibos e na página de agendamento. Transmite profissionalismo.",
    href: "/configuracoes?tab=dados#logo",
    Icon: ImageIcon,
  },
  {
    id: "assinatura",
    titulo: "Configure sua assinatura para recibos",
    descricao:
      "Escolha uma fonte cursiva ou faça upload da sua assinatura. Aparece nos recibos dos pacientes.",
    href: "/configuracoes?tab=dados#assinatura",
    Icon: PenTool,
  },
  {
    id: "paciente",
    titulo: "Cadastre seu primeiro paciente",
    descricao:
      "Adicione um paciente para testar o sistema. Pode ser você mesmo como teste!",
    href: "/pacientes/novo",
    Icon: UserPlus,
  },
  {
    id: "agendamento",
    titulo: "Faça seu primeiro agendamento",
    descricao:
      "Agende uma consulta de teste para ver como funciona. Pode cancelar depois.",
    href: "/agenda",
    Icon: CalendarPlus,
  },
  {
    id: "link_compartilhado",
    titulo: "Compartilhe seu link de agendamento",
    descricao:
      "Copie seu link e envie para um paciente por WhatsApp. Ele agenda sozinho, sem te ligar!",
    href: "/configuracoes?tab=dados#links",
    Icon: Share2,
  },
  {
    id: "plano",
    titulo: "Escolha seu plano",
    descricao:
      "Seu período de teste dura 14 dias. Escolha um plano para continuar usando depois.",
    href: "/configuracoes?tab=dados#plano",
    Icon: CreditCard,
  },
];

type EstadoCheck = Record<PassoId, boolean>;

function montarEstado(
  serverStatus: ChecklistStatus | null,
  linkCompartilhado: boolean,
): EstadoCheck {
  return {
    horarios: serverStatus?.horarios ?? false,
    procedimentos: serverStatus?.procedimentos ?? false,
    logo: serverStatus?.logo ?? false,
    assinatura: serverStatus?.assinatura ?? false,
    paciente: serverStatus?.paciente ?? false,
    agendamento: serverStatus?.agendamento ?? false,
    link_compartilhado: linkCompartilhado,
    plano: serverStatus?.plano ?? false,
  };
}

export default function ChecklistPrimeiroUso() {
  const [serverStatus, setServerStatus] = useState<ChecklistStatus | null>(
    null,
  );
  const [linkFlag, setLinkFlag] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [minimizado, setMinimizado] = useState(false);
  const [esconderCompleto, setEsconderCompleto] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const r = await getChecklistStatus();
    if (r.ok) {
      setServerStatus(r.data);
      setErro(null);
    } else {
      setErro(r.error);
    }
    setLinkFlag(lerLinkCompartilhado());
    setLoading(false);
  }, []);

  useEffect(() => {
    void carregar();
    const handler = () => {
      setLinkFlag(lerLinkCompartilhado());
    };
    window.addEventListener("sao:checklist-mudou", handler);
    return () => window.removeEventListener("sao:checklist-mudou", handler);
  }, [carregar]);

  const estado = useMemo(
    () => montarEstado(serverStatus, linkFlag),
    [serverStatus, linkFlag],
  );

  const concluidos = useMemo(
    () => PASSOS.filter((p) => estado[p.id]).length,
    [estado],
  );
  const total = PASSOS.length;
  const tudoPronto = concluidos === total;

  // Quando tudo fica pronto, registra timestamp no localStorage. Se ja
  // passou 1 dia desde essa marca, o card some.
  useEffect(() => {
    if (!tudoPronto) return;
    marcarChecklistCompletoAgora();
    const completoEm = lerChecklistCompletoEm();
    if (checklistConcluidoExpirou(completoEm)) {
      setEsconderCompleto(true);
    }
  }, [tudoPronto]);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
        Carregando checklist…
      </section>
    );
  }

  if (erro) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {erro}
      </section>
    );
  }

  if (tudoPronto && esconderCompleto) return null;

  const percentual = Math.round((concluidos / total) * 100);

  return (
    <section
      aria-label="Checklist de primeiro uso"
      className="overflow-hidden rounded-xl border border-[#99F6E4] bg-white shadow-[0_1px_3px_rgba(13,148,136,0.08)]"
    >
      {/* Cabeçalho com progresso */}
      <header className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-br from-[#F0FDFA] to-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#115E59]">
            Primeiros passos
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            {tudoPronto
              ? "Tudo pronto! Sua agenda está configurada para receber pacientes."
              : "Configure sua agenda em 8 passos"}
          </h2>
          {!tudoPronto ? (
            <p className="mt-1 text-sm text-slate-600">
              {concluidos} de {total} concluídos
            </p>
          ) : null}
        </div>

        {!tudoPronto ? (
          <button
            type="button"
            onClick={() => setMinimizado((v) => !v)}
            aria-expanded={!minimizado}
            className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:self-auto"
          >
            {minimizado ? (
              <>
                Expandir
                <ChevronDown size={14} aria-hidden="true" />
              </>
            ) : (
              <>
                Minimizar
                <ChevronUp size={14} aria-hidden="true" />
              </>
            )}
          </button>
        ) : null}
      </header>

      {/* Barra de progresso */}
      <div className="bg-slate-100 px-5 pb-3 pt-3">
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-valuenow={percentual}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progresso: ${percentual}%`}
        >
          <div
            className="h-full rounded-full bg-[#0D9488] transition-all"
            style={{ width: `${percentual}%` }}
          />
        </div>
      </div>

      {/* Card de tudo pronto */}
      {tudoPronto ? (
        <div className="flex items-start gap-4 p-6">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0D9488] text-white">
            <Sparkles size={24} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="text-base font-semibold text-slate-900">
              Sua agenda está pronta!
            </p>
            <p className="text-sm leading-relaxed text-slate-600">
              Você completou todos os passos da configuração inicial. Esse
              card vai sumir em 24h. Bons atendimentos!
            </p>
          </div>
        </div>
      ) : null}

      {/* Lista de passos */}
      {!tudoPronto && !minimizado ? (
        <ul className="divide-y divide-slate-100 sm:grid sm:grid-cols-2 sm:divide-y-0">
          {PASSOS.map((passo, idx) => (
            <li
              key={passo.id}
              className={cn(
                "sm:border-slate-100",
                idx % 2 === 0 ? "sm:border-r" : "",
                idx < PASSOS.length - 2 ? "sm:border-b" : "",
              )}
            >
              <PassoItem
                passo={passo}
                concluido={estado[passo.id]}
                ordem={idx + 1}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function PassoItem({
  passo,
  concluido,
  ordem,
}: {
  passo: PassoDef;
  concluido: boolean;
  ordem: number;
}) {
  const { Icon } = passo;
  return (
    <article
      className={cn(
        "flex items-start gap-3 p-5",
        concluido ? "bg-[#F0FDFA]/50" : "bg-white",
      )}
    >
      <span
        className={cn(
          "mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          concluido
            ? "bg-[#0D9488] text-white"
            : "bg-[#F0FDFA] text-[#0D9488]",
        )}
        aria-hidden="true"
      >
        {concluido ? (
          <Check size={20} strokeWidth={2.25} />
        ) : (
          <Icon size={20} strokeWidth={1.75} />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-semibold",
            concluido
              ? "text-slate-500 line-through decoration-slate-300"
              : "text-slate-900",
          )}
        >
          <span className="mr-1 text-xs font-medium text-slate-400">
            {ordem}.
          </span>
          {passo.titulo}
        </p>
        <p
          className={cn(
            "mt-1 text-xs leading-relaxed",
            concluido ? "text-slate-400" : "text-slate-600",
          )}
        >
          {passo.descricao}
        </p>

        {!concluido ? (
          <Link
            href={passo.href}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#0D9488] hover:text-[#115E59] hover:underline"
          >
            Configurar
            <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#0D9488]">
            <Check size={12} strokeWidth={2.5} aria-hidden="true" />
            Concluído
          </span>
        )}
      </div>
    </article>
  );
}
