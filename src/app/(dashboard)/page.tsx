import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarOff,
  ChevronRight,
  PlayCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import StatusPill, { type StatusVariant } from "@/components/ui/StatusPill";
import Avatar from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";
import NovoAgendamentoFab from "@/components/dashboard/NovoAgendamentoFab";
import {
  getAgendaHoje,
  type AgendamentoDia,
} from "@/actions/agendamentos";
import { getProgressoOnboarding } from "@/actions/onboarding";
import ChecklistOnboardingWrapper from "@/components/onboarding/ChecklistOnboardingWrapper";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_VALIDOS: StatusVariant[] = [
  "agendado",
  "confirmado",
  "em_atendimento",
  "concluido",
  "faltou",
  "cancelado",
];

function statusValido(s: string): s is StatusVariant {
  return (STATUS_VALIDOS as string[]).includes(s);
}

function saudacao(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function horarioUtc(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function dataExtensoUtc(iso: string): string {
  const txt = format(new Date(iso), "EEEE, d 'de' MMMM", {
    locale: ptBR,
    timeZone: "UTC",
  } as Parameters<typeof format>[2]);
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

export default async function HomeAgendaHojePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [result, progresso] = await Promise.all([
    getAgendaHoje(),
    getProgressoOnboarding(),
  ]);

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-[22px] font-semibold text-slate-900">Agenda</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {result.error}
        </div>
      </div>
    );
  }

  const { agendamentos, proximo, proximoFuturo, profissionalNome } =
    result.data;
  const mostrarChecklist = progresso.totalConcluidos < progresso.total;

  return (
    <div className="space-y-6 relative pb-12">
      <header className="space-y-1">
        <p className="text-[14px] text-slate-500">{saudacao()},</p>
        <h1 className="text-[22px] font-semibold text-slate-900 leading-tight">
          {profissionalNome}!
        </h1>
      </header>

      {mostrarChecklist ? (
        <ChecklistOnboardingWrapper progresso={progresso} />
      ) : null}

      <ProximoCard proximo={proximo} proximoFuturo={proximoFuturo} />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold text-slate-900">
            Hoje
          </h2>
          <span className="text-[13px] text-slate-500">
            {agendamentos.length}{" "}
            {agendamentos.length === 1 ? "agendamento" : "agendamentos"}
          </span>
        </div>

        {agendamentos.length === 0 ? (
          <EmptyState
            Icon={CalendarOff}
            titulo="Dia livre!"
            descricao="Nenhum agendamento para hoje. Aproveite para organizar sua agenda."
            acao={{ label: "Novo agendamento", href: "/agenda" }}
          />
        ) : (
          <ul className="space-y-2">
            {agendamentos.map((ag) => {
              const ehProximo = proximo?.id === ag.id;
              const ehPassado = [
                "concluido",
                "faltou",
                "cancelado",
                "reagendado",
              ].includes(ag.status);
              return (
                <li key={ag.id}>
                  <ItemAgendamento
                    agendamento={ag}
                    destaque={ehProximo}
                    passado={ehPassado}
                  />
                </li>
              );
            })}
          </ul>
        )}

        <Link
          href="/agenda"
          className="inline-flex items-center gap-1 text-[14px] font-medium text-primary-text hover:underline"
        >
          Ver agenda completa
          <ArrowRight size={14} strokeWidth={1.5} aria-hidden="true" />
        </Link>
      </section>

      <NovoAgendamentoFab />
    </div>
  );
}

function ProximoCard({
  proximo,
  proximoFuturo,
}: {
  proximo: AgendamentoDia | null;
  proximoFuturo: AgendamentoDia | null;
}) {
  if (!proximo && !proximoFuturo) {
    return (
      <section
        data-tour="proximo-card"
        className="rounded-xl border border-slate-200 bg-white p-5 space-y-1 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
      >
        <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">
          Proximo paciente
        </p>
        <p className="text-[15px] text-slate-700">
          Nenhum agendamento restante hoje.
        </p>
      </section>
    );
  }

  const ag = proximo ?? (proximoFuturo as AgendamentoDia);
  const horario = horarioUtc(ag.data_hora);
  const dia = proximo ? "Hoje" : dataExtensoUtc(ag.data_hora);
  const status: StatusVariant = statusValido(ag.status) ? ag.status : "agendado";
  const nome = ag.paciente?.nome ?? "Paciente";
  const procedimento = ag.procedimento?.nome ?? null;

  return (
    <section
      data-tour="proximo-card"
      className={cn(
        "rounded-xl border bg-white p-5 space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.08)]",
        proximo ? "border-primary" : "border-slate-200",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">
          {proximo ? "Proximo paciente" : "Proximo agendamento futuro"}
        </p>
        <StatusPill status={status} />
      </div>

      <div className="flex items-start gap-3">
        <Avatar name={nome} className="h-12 w-12 text-base shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-slate-900 break-words">
            {nome}
          </p>
          <p className="text-[14px] text-slate-700 mt-0.5">
            {dia} as {horario}
            {ag.duracao_min ? (
              <span className="text-slate-500"> ({ag.duracao_min} min)</span>
            ) : null}
          </p>
          {procedimento ? (
            <p className="text-[13px] text-slate-500 mt-0.5">{procedimento}</p>
          ) : null}
        </div>
      </div>

      {proximo ? (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link
            href={`/agenda?ag=${ag.id}`}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[14px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Ver detalhes
          </Link>
          <Link
            href={`/atendimento/${ag.id}`}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[14px] font-medium text-white hover:bg-primary-dark transition-colors"
          >
            <PlayCircle size={16} strokeWidth={1.5} aria-hidden="true" />
            Iniciar atendimento
          </Link>
        </div>
      ) : (
        <Link
          href={`/agenda?ag=${ag.id}`}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-primary-text hover:underline"
        >
          Ver detalhes
          <ChevronRight size={14} strokeWidth={1.5} aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}

function ItemAgendamento({
  agendamento,
  destaque,
  passado,
}: {
  agendamento: AgendamentoDia;
  destaque: boolean;
  passado: boolean;
}) {
  const dt = new Date(agendamento.data_hora);
  const horario = dt.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  const status: StatusVariant = statusValido(agendamento.status)
    ? agendamento.status
    : "agendado";
  const nome = agendamento.paciente?.nome ?? "Paciente";
  const procedimento = agendamento.procedimento?.nome ?? null;

  return (
    <Link
      href={`/agenda?ag=${agendamento.id}`}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-white px-3 py-3 transition-colors hover:bg-slate-50",
        destaque
          ? "border-primary"
          : "border-slate-200",
        passado && "opacity-60",
      )}
    >
      <div className="flex w-12 shrink-0 flex-col items-center text-center">
        <span className="text-sm font-semibold text-slate-900 leading-tight">
          {horario}
        </span>
        <span className="text-[11px] text-slate-500 leading-tight">
          {agendamento.duracao_min} min
        </span>
      </div>
      <Avatar name={nome} className="h-9 w-9 text-[13px]" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 truncate">{nome}</p>
        {procedimento ? (
          <p className="text-xs text-slate-500 truncate">{procedimento}</p>
        ) : null}
      </div>
      <StatusPill status={status} className="shrink-0" />
    </Link>
  );
}
