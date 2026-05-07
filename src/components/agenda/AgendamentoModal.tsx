"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Calendar, Check, History, X } from "lucide-react";
import {
  atualizarStatusAgendamento,
  type AgendamentoDia,
  type StatusAgendamento,
} from "@/actions/agendamentos";
import {
  buscarSugestoesListaEspera,
  type SugestaoListaEspera,
} from "@/actions/lista-espera";
import {
  getTenantContato,
  type TenantContato,
} from "@/actions/configuracoes";
import { cleanPhone, formatPhone } from "@/lib/masks";
import {
  gerarLinkMaps,
  mensagemConfirmacao,
  mensagemLembrete,
} from "@/lib/whatsapp-templates";
import {
  carregarTemplates,
  getTemplate,
  renderTemplate,
} from "@/lib/templates-mensagem";
import StatusPill from "@/components/ui/StatusPill";
import Button from "@/components/ui/Button";
import BotaoWhatsApp from "@/components/ui/BotaoWhatsApp";
import ModalEnviarSMS from "@/components/sms/ModalEnviarSMS";
import { lerModuloSMSAtivo } from "@/lib/sms-prefs";
import { MessageSquare } from "lucide-react";
import {
  templateSMSConfirmacao,
  templateSMSLembrete,
} from "@/lib/sms-templates";
import { cn } from "@/lib/utils";
import ModalReagendamento from "./ModalReagendamento";

interface AgendamentoModalProps {
  agendamento: AgendamentoDia | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (id: string, novoStatus: StatusAgendamento) => void;
}

type AcaoStatus = {
  status: Exclude<StatusAgendamento, "agendado">;
  label: string;
  toast: string;
  className: string;
};

const ESTADOS_FINAIS: StatusAgendamento[] = ["concluido", "faltou", "cancelado"];
const TOAST_DURATION_MS = 2000;
const FECHAMENTO_FINAL_MS = 1000;

const ACOES_POR_STATUS: Record<StatusAgendamento, AcaoStatus[]> = {
  agendado: [
    {
      status: "confirmado",
      label: "Confirmar presença",
      toast: "Presença confirmada",
      className: "bg-primary text-white hover:bg-primary-dark border-transparent",
    },
  ],
  confirmado: [
    {
      status: "em_atendimento",
      label: "Iniciar atendimento",
      toast: "Atendimento iniciado",
      className:
        "bg-[#F59E0B] text-white hover:bg-[#D97706] border-transparent",
    },
  ],
  em_atendimento: [
    {
      status: "concluido",
      label: "Concluir atendimento",
      toast: "Atendimento concluido",
      className:
        "bg-[#22C55E] text-white hover:bg-[#16A34A] border-transparent",
    },
    {
      status: "faltou",
      label: "Registrar falta",
      toast: "Falta registrada",
      className: "bg-[#EF4444] text-white hover:bg-[#DC2626] border-transparent",
    },
  ],
  concluido: [],
  faltou: [],
  cancelado: [],
  reagendado: [],
};

const PODE_CANCELAR: StatusAgendamento[] = ["agendado", "confirmado"];

function AgendamentoModal({
  agendamento,
  open,
  onOpenChange,
  onUpdated,
}: AgendamentoModalProps) {
  const router = useRouter();
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [reagendamentoOpen, setReagendamentoOpen] = useState(false);
  const [sugestaoEspera, setSugestaoEspera] =
    useState<SugestaoListaEspera | null>(null);
  const [tenantContato, setTenantContato] = useState<TenantContato | null>(null);
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [smsMensagemInicial, setSmsMensagemInicial] = useState<string>("");
  const [smsModuloAtivo, setSmsModuloAtivo] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    (async () => {
      const r = await getTenantContato();
      if (cancelado) return;
      if (r.ok) setTenantContato(r.data);
    })();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSmsModuloAtivo(lerModuloSMSAtivo());
    return () => {
      cancelado = true;
    };
  }, [open]);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const limparTimers = () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      limparTimers();
    };
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      limparTimers();
      setConfirmandoCancelamento(false);
      setMotivo("");
      setErro(null);
      setToast(null);
    }
    onOpenChange(next);
  };

  if (!agendamento) return null;

  const dt = new Date(agendamento.data_hora);
  const horario = dt.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  const dataIsoAg = agendamento.data_hora.slice(0, 10);
  const dataBr = dt.toLocaleDateString("pt-BR", { timeZone: "UTC" });

  const telefonePaciente = agendamento.paciente?.telefone ?? null;
  const enderecoCompleto = tenantContato
    ? [
        tenantContato.endereco,
        [tenantContato.cidade, tenantContato.estado].filter(Boolean).join(" - ") ||
          null,
      ]
        .filter((s): s is string => Boolean(s && s.trim()))
        .join(", ") || null
    : null;
  const linkMaps = tenantContato
    ? gerarLinkMaps(
        tenantContato.endereco,
        tenantContato.cidade,
        tenantContato.estado,
      )
    : null;
  const nomePac = agendamento.paciente?.nome ?? "Paciente";
  const procNome = agendamento.procedimento?.nome ?? null;
  const profNome = agendamento.profissional?.nome ?? "Profissional";

  // Templates podem ser personalizados via Configuracoes; caem para defaults.
  const templates = carregarTemplates();
  const tplConf = getTemplate("confirmacao", templates);
  const tplLemb = getTemplate("lembrete", templates);
  const variaveis = {
    nome: nomePac.split(" ")[0],
    data: dataBr,
    hora: horario,
    profissional: profNome,
    procedimento: procNome ?? "",
    endereco: enderecoCompleto ?? "",
    linkMaps: linkMaps ?? "",
  };
  const msgConfirmacao = tplConf
    ? renderTemplate(tplConf.conteudo, variaveis)
    : mensagemConfirmacao({
        nome: nomePac,
        data: dataBr,
        hora: horario,
        profissional: profNome,
        procedimento: procNome,
        endereco: enderecoCompleto,
        linkMaps,
      });
  const msgLembrete = tplLemb
    ? renderTemplate(tplLemb.conteudo, variaveis)
    : mensagemLembrete({
        nome: nomePac,
        data: dataBr,
        hora: horario,
        endereco: enderecoCompleto,
        linkMaps,
      });

  // Lembrete fica visivel quando o agendamento e amanha ou depois.
  const hojeIso = new Date().toISOString().slice(0, 10);
  const ehFuturo = dataIsoAg > hojeIso;

  const checarSugestoesEspera = async () => {
    if (!agendamento.profissional?.id) return;
    const r = await buscarSugestoesListaEspera({
      profissionalId: agendamento.profissional.id,
      dataIso: dataIsoAg,
      hora: horario,
    });
    if (r.ok && r.data.length > 0) {
      setSugestaoEspera(r.data[0]);
    }
  };

  const profissionalNome = agendamento.profissional?.nome ?? "o profissional";

  const nomePaciente = agendamento.paciente?.nome ?? "Paciente";
  const nomeProcedimento = agendamento.procedimento?.nome ?? null;
  const acoes = ACOES_POR_STATUS[agendamento.status] ?? [];
  const podeCancelar = PODE_CANCELAR.includes(agendamento.status);
  const ehFinal = acoes.length === 0 && !podeCancelar;

  const aplicarStatus = (
    novoStatus: StatusAgendamento,
    mensagemToast: string,
    motivoTexto?: string,
  ) => {
    setErro(null);
    startTransition(async () => {
      const result = await atualizarStatusAgendamento(
        agendamento.id,
        novoStatus,
        motivoTexto,
      );
      if (!result.ok) {
        setErro(result.error);
        return;
      }

      onUpdated(agendamento.id, novoStatus);
      limparTimers();
      setConfirmandoCancelamento(false);
      setMotivo("");
      setToast(mensagemToast);

      if (novoStatus === "em_atendimento") {
        handleOpenChange(false);
        router.push(`/atendimento/${agendamento.id}`);
        return;
      }

      // Quando o horário é liberado por cancelamento, oferecer sugestão da
      // lista de espera antes de fechar o modal.
      if (novoStatus === "cancelado") {
        await checarSugestoesEspera();
        toastTimerRef.current = setTimeout(() => {
          setToast(null);
        }, TOAST_DURATION_MS);
        return;
      }

      const ehFinalAgora = ESTADOS_FINAIS.includes(novoStatus);
      if (ehFinalAgora) {
        closeTimerRef.current = setTimeout(() => {
          handleOpenChange(false);
        }, FECHAMENTO_FINAL_MS);
      } else {
        toastTimerRef.current = setTimeout(() => {
          setToast(null);
        }, TOAST_DURATION_MS);
      }
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed z-50 bg-white shadow-lg focus:outline-none",
            // Mobile: bottom sheet
            "inset-x-0 bottom-0 rounded-t-2xl px-4 pt-5 pb-[max(env(safe-area-inset-bottom),16px)]",
            // Desktop: centered modal
            "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[400px] md:max-w-[calc(100vw-32px)] md:rounded-2xl md:p-6 md:pb-6",
          )}
        >
          {/* Drag handle (mobile only) */}
          <div className="md:hidden mx-auto mb-4 h-1 w-10 rounded-full bg-slate-300" />

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-semibold text-slate-900 truncate">
                {nomePaciente}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-slate-500">
                {horario} - {agendamento.duracao_min} min
                {nomeProcedimento ? ` - ${nomeProcedimento}` : ""}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Fechar"
              className="rounded p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <X size={18} strokeWidth={1.5} />
            </Dialog.Close>
          </div>

          {toast ? (
            <div
              role="status"
              aria-live="polite"
              className="mt-4 flex items-center gap-2 rounded border border-[#CCFBF1] bg-[#F0FDFA] px-3 py-2 text-xs font-medium text-[#115E59]"
            >
              <Check size={14} strokeWidth={2} aria-hidden="true" />
              <span>{toast}</span>
            </div>
          ) : null}

          {sugestaoEspera ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
              <p className="text-sm font-medium text-amber-900">
                {sugestaoEspera.pacienteNome} está na lista de espera
              </p>
              <p className="text-xs text-amber-800">
                {sugestaoEspera.procedimentoNome
                  ? `Quer ${sugestaoEspera.procedimentoNome}.`
                  : "Quer agendar uma consulta."}
                {sugestaoEspera.observacoes
                  ? ` "${sugestaoEspera.observacoes}"`
                  : ""}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const tel = cleanPhone(sugestaoEspera.pacienteTelefone);
                    if (!tel) return;
                    const primeiroNome =
                      sugestaoEspera.pacienteNome.split(" ")[0];
                    const msg = `Olá ${primeiroNome}! Surgiu um horário disponível na agenda de ${profissionalNome}. Gostaria de agendar?`;
                    window.open(
                      `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }}
                  disabled={!sugestaoEspera.pacienteTelefone}
                  className="inline-flex items-center gap-1.5 rounded bg-[#25D366] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1ebe5a] disabled:opacity-50 transition-colors"
                  title={
                    sugestaoEspera.pacienteTelefone
                      ? formatPhone(sugestaoEspera.pacienteTelefone)
                      : "Sem telefone cadastrado"
                  }
                >
                  Notificar por WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setSugestaoEspera(null)}
                  className="rounded px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                >
                  Ignorar
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Status atual:</span>
            <StatusPill status={agendamento.status} />
            {agendamento.reagendado_de ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#E0E7FF] px-2 py-0.5 text-[10px] font-medium text-[#3730A3]">
                <History size={10} strokeWidth={1.5} aria-hidden="true" />
                Reagendado de outro horário
              </span>
            ) : null}
          </div>

          {erro ? (
            <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {erro}
            </p>
          ) : null}

          {!confirmandoCancelamento && telefonePaciente ? (
            <div className="mt-4 flex flex-col gap-2">
              <BotaoWhatsApp
                telefone={telefonePaciente}
                mensagem={msgConfirmacao}
                variant="confirmacao"
                size="sm"
                className="w-full"
              />
              {ehFuturo ? (
                <BotaoWhatsApp
                  telefone={telefonePaciente}
                  mensagem={msgLembrete}
                  variant="lembrete"
                  size="sm"
                  className="w-full"
                />
              ) : null}
              {smsModuloAtivo && agendamento.paciente?.id ? (
                <button
                  type="button"
                  onClick={() => {
                    const tplSms = ehFuturo
                      ? templateSMSLembrete({
                          nome: nomePaciente,
                          data: dataBr.slice(0, 5),
                          hora: horario,
                        })
                      : templateSMSConfirmacao({
                          nome: nomePaciente,
                          data: dataBr.slice(0, 5),
                          hora: horario,
                          profissional:
                            agendamento.profissional?.nome ?? "Profissional",
                        });
                    setSmsMensagemInicial(tplSms);
                    setSmsModalOpen(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-info px-4 py-2.5 text-[14px] font-medium text-white hover:bg-info/90 transition-colors min-h-[44px]"
                >
                  <MessageSquare
                    size={14}
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  Enviar SMS
                </button>
              ) : null}
            </div>
          ) : null}

          {ehFinal ? (
            <p className="mt-5 text-sm text-slate-500">
              Este agendamento está em estado final.
            </p>
          ) : confirmandoCancelamento ? (
            <div className="mt-5 space-y-3">
              <p className="text-sm text-slate-700">
                Deseja cancelar este agendamento?
              </p>
              <div className="space-y-1">
                <label
                  htmlFor="motivo-cancelamento"
                  className="block text-[14px] font-medium text-slate-900"
                >
                  Motivo (opcional)
                </label>
                <textarea
                  id="motivo-cancelamento"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Ex.: paciente solicitou remarcar"
                  className="w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  variant="destructive"
                  disabled={isPending}
                  onClick={() =>
                    aplicarStatus("cancelado", "Agendamento cancelado", motivo)
                  }
                  className="w-full"
                >
                  {isPending ? "Cancelando..." : "Cancelar agendamento"}
                </Button>
                <Button
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => {
                    setConfirmandoCancelamento(false);
                    setMotivo("");
                  }}
                  className="w-full"
                >
                  Voltar
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-2">
              {acoes.map((acao) => (
                <button
                  key={acao.status}
                  type="button"
                  disabled={isPending}
                  onClick={() => aplicarStatus(acao.status, acao.toast)}
                  className={cn(
                    "inline-flex w-full items-center justify-center rounded border px-5 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
                    acao.className,
                  )}
                >
                  {isPending ? "Salvando..." : acao.label}
                </button>
              ))}
              {podeCancelar ? (
                <button
                  type="button"
                  onClick={() => setReagendamentoOpen(true)}
                  disabled={isPending}
                  className="inline-flex w-full items-center justify-center gap-2 rounded border border-primary bg-transparent px-5 py-2.5 text-sm font-medium text-primary-text hover:bg-primary-surface transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Calendar size={14} strokeWidth={1.5} aria-hidden="true" />
                  Reagendar
                </button>
              ) : null}
              {podeCancelar ? (
                <Button
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => setConfirmandoCancelamento(true)}
                  className="w-full"
                >
                  Cancelar agendamento
                </Button>
              ) : null}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>

      <ModalReagendamento
        agendamento={agendamento}
        open={reagendamentoOpen}
        onOpenChange={setReagendamentoOpen}
        onReagendado={(novoId) => {
          onUpdated(agendamento.id, "reagendado");
          handleOpenChange(false);
          router.push(`/agenda?ag=${novoId}`);
          router.refresh();
        }}
      />

      {agendamento.paciente?.id ? (
        <ModalEnviarSMS
          open={smsModalOpen}
          onOpenChange={setSmsModalOpen}
          paciente={{
            id: agendamento.paciente.id,
            nome: nomePaciente,
            telefone: telefonePaciente,
          }}
          mensagemInicial={smsMensagemInicial}
        />
      ) : null}
    </Dialog.Root>
  );
}

export default AgendamentoModal;
