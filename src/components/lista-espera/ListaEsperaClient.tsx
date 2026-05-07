"use client";

import { useCallback, useState, useTransition } from "react";
import {
  Calendar,
  Clock,
  MessageCircle,
  X,
} from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  getListaEspera,
  marcarComoAgendado,
  removerDaListaEspera,
  type ItemListaEspera,
  type StatusListaEspera,
} from "@/actions/lista-espera";
import type { ProfissionalOpcaoTenant } from "@/actions/equipe";
import { formatPhone, cleanPhone } from "@/lib/masks";
import { cn } from "@/lib/utils";
import { LazyNovoAgendamentoModal } from "@/lib/dynamic-imports";

interface ListaEsperaClientProps {
  initialItens: ItemListaEspera[];
  profissionais: ProfissionalOpcaoTenant[];
}

const STATUS_BORDER: Record<StatusListaEspera, string> = {
  aguardando: "border-l-amber-500",
  agendado: "border-l-green-500",
  cancelado: "border-l-slate-400",
};

const STATUS_BG: Record<StatusListaEspera, string> = {
  aguardando: "bg-white",
  agendado: "bg-[#F0FDF4]",
  cancelado: "bg-slate-50",
};

const TURNO_LABEL: Record<string, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  qualquer: "Qualquer turno",
};

function ListaEsperaClient({
  initialItens,
  profissionais,
}: ListaEsperaClientProps) {
  const [itens, setItens] = useState<ItemListaEspera[]>(initialItens);
  const [statusFiltro, setStatusFiltro] = useState<
    StatusListaEspera | "todos"
  >("aguardando");
  const [profissionalFiltro, setProfissionalFiltro] = useState<string>("todos");
  const [agendarPara, setAgendarPara] = useState<ItemListaEspera | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();

  const recarregar = useCallback(
    (
      status: StatusListaEspera | "todos" = statusFiltro,
      prof: string = profissionalFiltro,
    ) => {
      setErro(null);
      startLoading(async () => {
        const r = await getListaEspera({
          status,
          profissionalId: prof,
        });
        if (!r.ok) {
          setErro(r.error);
          return;
        }
        setItens(r.data);
      });
    },
    [statusFiltro, profissionalFiltro],
  );

  const handleStatusChange = (s: StatusListaEspera | "todos") => {
    setStatusFiltro(s);
    recarregar(s, profissionalFiltro);
  };
  const handleProfChange = (p: string) => {
    setProfissionalFiltro(p);
    recarregar(statusFiltro, p);
  };

  const aguardandoCount = itens.filter((i) => i.status === "aguardando").length;

  return (
    <div className="space-y-4 pb-20">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-slate-900 leading-tight">
            Lista de espera
          </h1>
          {aguardandoCount > 0 ? (
            <span className="mt-1 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {aguardandoCount}{" "}
              {aguardandoCount === 1 ? "aguardando" : "aguardando"}
            </span>
          ) : null}
        </div>
      </header>

      <section className="flex flex-wrap items-center gap-2">
        <select
          value={statusFiltro}
          onChange={(e) =>
            handleStatusChange(
              e.target.value as StatusListaEspera | "todos",
            )
          }
          className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:outline-none"
        >
          <option value="aguardando">Aguardando</option>
          <option value="agendado">Agendado</option>
          <option value="cancelado">Cancelado</option>
          <option value="todos">Todos</option>
        </select>
        {profissionais.length > 1 ? (
          <select
            value={profissionalFiltro}
            onChange={(e) => handleProfChange(e.target.value)}
            className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:outline-none"
          >
            <option value="todos">Todos os profissionais</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        ) : null}
      </section>

      {erro ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {erro}
        </p>
      ) : null}

      {itens.length === 0 ? (
        <EmptyState
          Icon={Clock}
          titulo="Lista de espera vazia"
          descricao="Pacientes entrarao na lista quando nao houver horarios disponiveis no link publico."
        />
      ) : (
        <ul
          className={cn(
            "space-y-2",
            isLoading && "opacity-60 transition-opacity",
          )}
        >
          {itens.map((item) => (
            <Card
              key={item.id}
              item={item}
              onAgendar={(it) => setAgendarPara(it)}
              onChanged={recarregar}
              mostrarProfissional={profissionais.length > 1}
            />
          ))}
        </ul>
      )}

      <LazyNovoAgendamentoModal
        key={`novo-le-${agendarPara?.id ?? "fechado"}`}
        open={agendarPara !== null}
        onOpenChange={(o) => {
          if (!o) setAgendarPara(null);
        }}
        initialDateIso={agendarPara?.data_preferencia ?? undefined}
        initialPaciente={
          agendarPara
            ? {
                id: agendarPara.paciente.id,
                nome: agendarPara.paciente.nome,
                telefone: agendarPara.paciente.telefone,
                email: agendarPara.paciente.email,
              }
            : undefined
        }
        initialProcedimentoId={agendarPara?.procedimento?.id}
        onCriado={async () => {
          if (agendarPara) {
            await marcarComoAgendado(agendarPara.id);
          }
          setAgendarPara(null);
          recarregar();
        }}
      />
    </div>
  );
}

function Card({
  item,
  onAgendar,
  onChanged,
  mostrarProfissional,
}: {
  item: ItemListaEspera;
  onAgendar: (i: ItemListaEspera) => void;
  onChanged: () => void;
  mostrarProfissional: boolean;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const tempo = formatDistanceToNow(new Date(item.created_at), {
    addSuffix: true,
    locale: ptBR,
  });
  const dataPref = item.data_preferencia
    ? format(new Date(`${item.data_preferencia}T00:00:00`), "dd/MM/yyyy", {
        locale: ptBR,
      })
    : null;

  const handleRemover = () => {
    if (
      !confirm(
        `Remover ${item.paciente.nome} da lista de espera?`,
      )
    ) {
      return;
    }
    setErro(null);
    startTransition(async () => {
      const r = await removerDaListaEspera(item.id);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      onChanged();
    });
  };

  const handleWhats = () => {
    const tel = cleanPhone(item.paciente.telefone);
    if (!tel) return;
    const profNome = item.profissional_nome ?? "o profissional";
    const mensagem =
      `Olá ${item.paciente.nome.split(" ")[0]}! Surgiu um horário disponível na agenda de ${profNome}. ` +
      `Gostaria de agendar?`;
    const url = `https://wa.me/55${tel}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const ehFinal = item.status !== "aguardando";

  return (
    <li
      className={cn(
        "rounded-lg border border-slate-200 border-l-4 p-3 sm:p-4",
        STATUS_BORDER[item.status],
        STATUS_BG[item.status],
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">
              {item.paciente.nome}
            </p>
            {item.status === "agendado" ? (
              <span className="inline-flex items-center rounded-full bg-[#D1FAE5] px-2 py-0.5 text-[10px] font-medium text-[#065F46]">
                Agendado
              </span>
            ) : null}
            {item.status === "cancelado" ? (
              <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                Cancelado
              </span>
            ) : null}
          </div>
          {item.paciente.telefone ? (
            <p className="text-xs text-slate-500">
              {formatPhone(item.paciente.telefone)}
            </p>
          ) : null}
          {item.procedimento?.nome ? (
            <p className="mt-1 text-xs text-slate-600">
              <strong className="font-medium">Procedimento:</strong>{" "}
              {item.procedimento.nome}
            </p>
          ) : null}
          {dataPref || item.turno_preferencia ? (
            <p className="text-xs text-slate-600">
              <strong className="font-medium">Preferência:</strong>{" "}
              {dataPref ?? "qualquer data"}
              {item.turno_preferencia
                ? ` · ${TURNO_LABEL[item.turno_preferencia] ?? item.turno_preferencia}`
                : ""}
            </p>
          ) : null}
          {item.observacoes ? (
            <p className="mt-1 text-xs text-slate-500 italic">
              “{item.observacoes}”
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Clock size={11} strokeWidth={1.5} aria-hidden="true" />
              {tempo}
            </span>
            {mostrarProfissional && item.profissional_nome ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{item.profissional_nome}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {erro ? (
        <p className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">
          {erro}
        </p>
      ) : null}

      {!ehFinal ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onAgendar(item)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            <Calendar size={12} strokeWidth={1.5} aria-hidden="true" />
            Agendar
          </button>
          <button
            type="button"
            onClick={handleWhats}
            disabled={!item.paciente.telefone || isPending}
            className="inline-flex items-center gap-1.5 rounded bg-[#25D366] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1ebe5a] disabled:opacity-50 transition-colors"
          >
            <MessageCircle size={12} strokeWidth={1.5} aria-hidden="true" />
            WhatsApp
          </button>
          <button
            type="button"
            onClick={handleRemover}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded border border-slate-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            <X size={12} strokeWidth={1.5} aria-hidden="true" />
            Remover
          </button>
        </div>
      ) : null}
    </li>
  );
}

export default ListaEsperaClient;
