"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  agendarSessaoManual,
  atualizarPlano,
  getPlanosPaciente,
  getSessoesPlano,
  type PlanoTratamento,
  type SessaoPlano,
  type StatusPlano,
  type StatusSessao,
  type TipoPlano,
} from "@/actions/planos-tratamento";
import { formatCurrency } from "@/lib/masks";
import { cn } from "@/lib/utils";
import FormPlanoTratamento from "./FormPlanoTratamento";

interface TabPlanosProps {
  pacienteId: string;
}

const TIPO_LABEL: Record<TipoPlano, string> = {
  avulso: "Avulso",
  mensal: "Mensal",
  anual: "Anual",
};

const TIPO_PILL: Record<TipoPlano, string> = {
  avulso: "bg-slate-100 text-slate-700",
  mensal: "bg-info-surface text-[#1E40AF]",
  anual: "bg-primary-surface text-primary-dark",
};

const STATUS_PLANO_LABEL: Record<StatusPlano, string> = {
  ativo: "Ativo",
  concluido: "Concluido",
  cancelado: "Cancelado",
  pausado: "Pausado",
};

const STATUS_PLANO_PILL: Record<StatusPlano, string> = {
  ativo: "bg-[#D1FAE5] text-[#065F46]",
  concluido: "bg-primary-surface text-primary-dark",
  cancelado: "bg-[#FEE2E2] text-[#991B1B]",
  pausado: "bg-[#FEF3C7] text-[#92400E]",
};

const STATUS_PLANO_BORDER: Record<StatusPlano, string> = {
  ativo: "border-l-[#16A34A]",
  concluido: "border-l-primary",
  cancelado: "border-l-danger",
  pausado: "border-l-[#F59E0B]",
};

const STATUS_SESSAO_LABEL: Record<StatusSessao, string> = {
  pendente: "Pendente",
  agendada: "Agendada",
  realizada: "Realizada",
  faltou: "Faltou",
  cancelada: "Cancelada",
};

const STATUS_SESSAO_PILL: Record<StatusSessao, string> = {
  pendente: "bg-[#FEF3C7] text-[#92400E]",
  agendada: "bg-info-surface text-[#1E40AF]",
  realizada: "bg-[#D1FAE5] text-[#065F46]",
  faltou: "bg-[#FEE2E2] text-[#991B1B]",
  cancelada: "bg-slate-200 text-slate-600",
};

function ddmm(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function TabPlanos({ pacienteId }: TabPlanosProps) {
  const [planos, setPlanos] = useState<PlanoTratamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [planoExpandido, setPlanoExpandido] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const r = await getPlanosPaciente(pacienteId);
    if (!r.ok) {
      setErro(r.error);
      setCarregando(false);
      return;
    }
    setPlanos(r.data);
    setCarregando(false);
  }, [pacienteId]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const handleCriado = (info: {
    sessoesAgendadas: number;
    totalSessoes: number;
  }) => {
    if (info.totalSessoes > 0 && info.sessoesAgendadas < info.totalSessoes) {
      setOkMsg(
        `${info.sessoesAgendadas} de ${info.totalSessoes} sessoes foram agendadas automaticamente. As demais precisam ser agendadas manualmente.`,
      );
    } else if (info.sessoesAgendadas > 0) {
      setOkMsg(
        `Plano criado e ${info.sessoesAgendadas} ${
          info.sessoesAgendadas === 1 ? "sessao agendada" : "sessoes agendadas"
        } automaticamente.`,
      );
    } else {
      setOkMsg("Plano criado.");
    }
    window.setTimeout(() => setOkMsg(null), 5000);
    void recarregar();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-slate-500">
          {planos.length === 0
            ? "Nenhum plano cadastrado"
            : `${planos.length} ${planos.length === 1 ? "plano" : "planos"}`}
        </p>
        <button
          type="button"
          onClick={() => setFormAberto(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-primary-dark transition-colors"
        >
          <Plus size={14} strokeWidth={1.5} aria-hidden="true" />
          Novo plano
        </button>
      </div>

      {okMsg ? (
        <p className="rounded border border-[#CCFBF1] bg-[#F0FDFA] px-3 py-2 text-xs font-medium text-[#115E59]">
          {okMsg}
        </p>
      ) : null}
      {erro ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {erro}
        </p>
      ) : null}

      {carregando ? (
        <ul className="space-y-2">
          {[0, 1].map((i) => (
            <li
              key={i}
              className="h-32 rounded-lg border border-slate-200 bg-slate-100 animate-pulse"
            />
          ))}
        </ul>
      ) : planos.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-500">
            Nenhum plano de tratamento. Crie um novo para acompanhar a evolucao.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {planos.map((p) => (
            <PlanoCard
              key={p.id}
              plano={p}
              expandido={planoExpandido === p.id}
              onToggleExpand={() =>
                setPlanoExpandido((cur) => (cur === p.id ? null : p.id))
              }
              onChanged={recarregar}
            />
          ))}
        </ul>
      )}

      <FormPlanoTratamento
        key={`form-${formAberto ? "open" : "closed"}`}
        open={formAberto}
        onOpenChange={setFormAberto}
        pacienteId={pacienteId}
        onCriado={handleCriado}
      />
    </div>
  );
}

function PlanoCard({
  plano,
  expandido,
  onToggleExpand,
  onChanged,
}: {
  plano: PlanoTratamento;
  expandido: boolean;
  onToggleExpand: () => void;
  onChanged: () => void;
}) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelando, startCancelar] = useTransition();

  const progresso =
    plano.qtd_sessoes > 0
      ? Math.min(100, Math.round((plano.sessoes_realizadas / plano.qtd_sessoes) * 100))
      : 0;

  const handleCancelar = () => {
    startCancelar(async () => {
      const r = await atualizarPlano(plano.id, { status: "cancelado" });
      if (r.ok) {
        setConfirmCancel(false);
        onChanged();
      }
    });
  };

  return (
    <li
      className={cn(
        "rounded-lg border border-l-4 border-slate-200 bg-white p-4 space-y-3",
        STATUS_PLANO_BORDER[plano.status],
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900 break-words">
              {plano.nome}
            </p>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-[2px] text-[11px] font-medium leading-none",
                TIPO_PILL[plano.tipo],
              )}
            >
              {TIPO_LABEL[plano.tipo]}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-[2px] text-[11px] font-medium leading-none",
                STATUS_PLANO_PILL[plano.status],
              )}
            >
              {STATUS_PLANO_LABEL[plano.status]}
            </span>
          </div>
          {plano.nome_procedimento ? (
            <p className="mt-1 text-xs text-slate-500">
              {plano.nome_procedimento}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600">
            {plano.sessoes_realizadas} de {plano.qtd_sessoes}{" "}
            {plano.qtd_sessoes === 1 ? "sessao" : "sessoes"} ({progresso}%)
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progresso}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            Valor
          </p>
          <p>
            {formatCurrency(plano.valor_por_sessao)}/sessao —{" "}
            <span className="font-semibold text-slate-900">
              Total: {formatCurrency(plano.valor_total)}
            </span>
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            Periodo
          </p>
          <p>
            {ddmm(plano.data_inicio)}
            {plano.data_fim ? ` a ${ddmm(plano.data_fim)}` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onToggleExpand}
          className="inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-surface transition-colors"
        >
          {expandido ? (
            <ChevronUp size={13} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <ChevronDown size={13} strokeWidth={1.5} aria-hidden="true" />
          )}
          {expandido ? "Ocultar sessoes" : "Ver sessoes"}
        </button>
        {plano.status === "ativo" ? (
          <button
            type="button"
            onClick={() => setConfirmCancel(true)}
            disabled={cancelando}
            className="inline-flex items-center gap-1 rounded-lg border border-danger px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger-surface transition-colors disabled:opacity-50"
          >
            Cancelar plano
          </button>
        ) : null}
      </div>

      {expandido ? <SessoesLista planoId={plano.id} onChanged={onChanged} /> : null}

      <Dialog.Root
        open={confirmCancel}
        onOpenChange={(next) => (!next ? setConfirmCancel(false) : undefined)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content
            className={cn(
              "fixed z-50 bg-white shadow-lg focus:outline-none",
              "inset-x-0 bottom-0 rounded-t-2xl px-4 pt-5 pb-[max(env(safe-area-inset-bottom),16px)]",
              "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[420px] md:max-w-[calc(100vw-32px)] md:rounded-2xl md:p-6",
            )}
          >
            <div className="md:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" />
            <Dialog.Title className="text-base font-semibold text-slate-900">
              Cancelar plano
            </Dialog.Title>
            <Dialog.Description className="mt-3 text-sm text-slate-600">
              Cancelar este plano tambem cancelara todas as sessoes pendentes e
              agendadas. Tem certeza?
            </Dialog.Description>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                disabled={cancelando}
                className="rounded px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleCancelar}
                disabled={cancelando}
                className="rounded border border-danger bg-transparent px-4 py-2 text-sm font-medium text-danger hover:bg-danger-surface disabled:opacity-50"
              >
                {cancelando ? "Cancelando..." : "Cancelar plano"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </li>
  );
}

function SessoesLista({
  planoId,
  onChanged,
}: {
  planoId: string;
  onChanged: () => void;
}) {
  const [sessoes, setSessoes] = useState<SessaoPlano[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [agendarTarget, setAgendarTarget] = useState<SessaoPlano | null>(null);

  const recarregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    const r = await getSessoesPlano(planoId);
    if (!r.ok) {
      setErro(r.error);
      setLoading(false);
      return;
    }
    setSessoes(r.data);
    setLoading(false);
  }, [planoId]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      {loading ? (
        <p className="text-xs text-slate-500">Carregando sessoes...</p>
      ) : erro ? (
        <p className="text-xs text-red-700">{erro}</p>
      ) : sessoes.length === 0 ? (
        <p className="text-xs text-slate-500">Sem sessoes.</p>
      ) : (
        <ul className="space-y-1.5">
          {sessoes.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
                  {s.numero_sessao}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-900 truncate">
                    Prev: {ddmm(s.data_prevista)}
                  </p>
                  {s.agendamento ? (
                    <p className="text-[11px] text-slate-500">
                      Agendado:{" "}
                      {format(
                        new Date(s.agendamento.data_hora),
                        "dd/MM/yyyy HH:mm",
                        { locale: ptBR, timeZone: "UTC" } as Parameters<
                          typeof format
                        >[2],
                      )}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-medium leading-none",
                    STATUS_SESSAO_PILL[s.status],
                  )}
                >
                  {STATUS_SESSAO_LABEL[s.status]}
                </span>
                {s.status === "pendente" && !s.agendamento_id ? (
                  <button
                    type="button"
                    onClick={() => setAgendarTarget(s)}
                    className="inline-flex items-center gap-1 rounded border border-primary px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary-surface transition-colors"
                  >
                    <Calendar
                      size={11}
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                    Agendar
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {agendarTarget ? (
        <ModalAgendarSessao
          key={agendarTarget.id}
          sessao={agendarTarget}
          onClose={() => setAgendarTarget(null)}
          onAgendado={() => {
            setAgendarTarget(null);
            void recarregar();
            onChanged();
          }}
        />
      ) : null}
    </div>
  );
}

function ModalAgendarSessao({
  sessao,
  onClose,
  onAgendado,
}: {
  sessao: SessaoPlano;
  onClose: () => void;
  onAgendado: () => void;
}) {
  const [dataIso, setDataIso] = useState<string>(sessao.data_prevista);
  const [hora, setHora] = useState<string>("09:00");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startSalvar] = useTransition();

  const handleSalvar = () => {
    setErro(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) {
      setErro("Data invalida.");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(hora)) {
      setErro("Horario invalido.");
      return;
    }
    startSalvar(async () => {
      const r = await agendarSessaoManual({
        sessaoId: sessao.id,
        dataIso,
        hora,
      });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      onAgendado();
    });
  };

  return (
    <Dialog.Root open={true} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className={cn(
            "fixed z-50 bg-white shadow-lg focus:outline-none",
            "inset-x-0 bottom-0 rounded-t-2xl px-4 pt-5 pb-[max(env(safe-area-inset-bottom),16px)]",
            "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[420px] md:max-w-[calc(100vw-32px)] md:rounded-2xl md:p-6",
          )}
        >
          <div className="md:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-900">
                Agendar sessao {sessao.numero_sessao}
              </Dialog.Title>
              <p className="text-xs text-slate-500">
                Data prevista: {ddmm(sessao.data_prevista)}
              </p>
            </div>
            <Dialog.Close
              aria-label="Fechar"
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
            >
              <X size={18} strokeWidth={1.5} />
            </Dialog.Close>
          </div>

          <div className="mt-4 space-y-3">
            <div className="space-y-1">
              <label className="block text-[13px] font-medium text-slate-700">
                Data *
              </label>
              <input
                type="date"
                value={dataIso}
                onChange={(e) => setDataIso(e.target.value)}
                className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[13px] font-medium text-slate-700">
                Horario *
              </label>
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                step={60}
                className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
              />
              <p className="text-[11px] text-slate-500">
                Sera criado um agendamento usando o procedimento do plano.
              </p>
            </div>

            {erro ? (
              <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {erro}
              </p>
            ) : null}
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="rounded px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSalvar}
              disabled={salvando}
              className="inline-flex items-center justify-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
            >
              {salvando ? (
                <>
                  <Loader2
                    size={14}
                    strokeWidth={1.5}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                  Agendando...
                </>
              ) : (
                <>
                  <Clock size={14} strokeWidth={1.5} aria-hidden="true" />
                  Agendar
                </>
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default TabPlanos;
