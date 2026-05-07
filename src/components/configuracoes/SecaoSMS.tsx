"use client";

import { useEffect, useState, useTransition } from "react";
import {
  AlertTriangle,
  Check,
  MessageSquare,
  Package,
} from "lucide-react";
import {
  cancelarAddon,
  contratarAddon,
  getPlanoAtual,
  type AddonAtivo,
} from "@/actions/planos";
import { getHistoricoSMS, getUsoSMSAtual } from "@/actions/sms";
import { ADDONS_SMS, type AddonPacote } from "@/lib/planos";
import {
  gravarModuloSMSAtivo,
  gravarTiposSMSAtivos,
  lerModuloSMSAtivo,
  lerTiposSMSAtivos,
  SMS_TIPOS_DEFAULT,
  type SMSTipoChave,
  type SMSTiposPrefs,
} from "@/lib/sms-prefs";
import { useToast } from "@/contexts/ToastContext";
import { formatPhone } from "@/lib/masks";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const TIPO_INFO: Record<
  SMSTipoChave,
  { label: string; descricao: string }
> = {
  confirmacao: {
    label: "Confirmacao de agendamento",
    descricao: "Envia SMS quando paciente agenda online",
  },
  lembrete: {
    label: "Lembrete 24h",
    descricao: "SMS um dia antes da consulta",
  },
  retorno: {
    label: "Lembrete de retorno",
    descricao: "SMS para pacientes inativos ha 90+ dias",
  },
  aniversario: {
    label: "Aniversario",
    descricao: "SMS de feliz aniversario",
  },
};

const HISTORICO_BADGE: Record<string, string> = {
  confirmacao: "bg-primary-surface text-primary-dark",
  lembrete: "bg-info-surface text-[#1E40AF]",
  retorno: "bg-amber-100 text-amber-800",
  aniversario: "bg-pink-100 text-pink-800",
  personalizado: "bg-slate-200 text-slate-700",
  aftercare: "bg-primary-surface text-primary-dark",
  inativo: "bg-slate-200 text-slate-700",
};

interface HistoricoItem {
  id: string;
  paciente_nome: string | null;
  telefone: string;
  tipo: string;
  status: string;
  created_at: string;
}

interface UsoState {
  usado: number;
  limite: number;
  disponivel: number;
  percentual: number;
}

function corBarra(percentual: number): string {
  if (percentual > 85) return "bg-[#DC2626]";
  if (percentual >= 60) return "bg-[#F59E0B]";
  return "bg-primary";
}

function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-primary" : "bg-slate-300",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}

function SecaoSMS() {
  const [pronto, setPronto] = useState(false);
  const [moduloAtivo, setModuloAtivo] = useState(true);
  const [tipos, setTipos] = useState<SMSTiposPrefs>(SMS_TIPOS_DEFAULT);

  const [uso, setUso] = useState<UsoState | null>(null);
  const [addonSMS, setAddonSMS] = useState<AddonAtivo | null>(null);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [historicoPag, setHistoricoPag] = useState(20);

  const [erro, setErro] = useState<string | null>(null);
  const [pacoteEmAcao, setPacoteEmAcao] = useState<AddonPacote | "cancelar" | null>(
    null,
  );
  const [, startTransition] = useTransition();
  const toast = useToast();

  // Hidrata localStorage e carrega dados iniciais.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModuloAtivo(lerModuloSMSAtivo());
    setTipos(lerTiposSMSAtivos());
    setPronto(true);
  }, []);

  const recarregarUso = () => {
    startTransition(async () => {
      const u = await getUsoSMSAtual();
      if (u.ok) {
        setUso({
          usado: u.data.usado,
          limite: u.data.limite,
          disponivel: u.data.disponivel,
          percentual: u.data.percentual,
        });
      }
    });
  };

  const recarregarPlano = () => {
    startTransition(async () => {
      const r = await getPlanoAtual();
      if (r.ok) {
        const sms =
          r.data.addons.find((a) => a.tipo === "sms" && a.ativo) ?? null;
        setAddonSMS(sms);
      }
    });
  };

  const recarregarHistorico = () => {
    startTransition(async () => {
      const r = await getHistoricoSMS();
      if (r.ok) setHistorico(r.data);
    });
  };

  useEffect(() => {
    if (!pronto || !moduloAtivo) return;
    recarregarUso();
    recarregarPlano();
    recarregarHistorico();
  }, [pronto, moduloAtivo]);

  if (!pronto) return null;

  const toggleModulo = () => {
    const novo = !moduloAtivo;
    setModuloAtivo(novo);
    gravarModuloSMSAtivo(novo);
    toast.sucesso(novo ? "Modulo SMS ativado" : "Modulo SMS desativado");
  };

  const toggleTipo = (chave: SMSTipoChave) => {
    const novo: SMSTiposPrefs = { ...tipos, [chave]: !tipos[chave] };
    setTipos(novo);
    gravarTiposSMSAtivos(novo);
  };

  const handleContratar = (pacote: AddonPacote) => {
    setErro(null);
    setPacoteEmAcao(pacote);
    startTransition(async () => {
      const r = await contratarAddon("sms", pacote);
      setPacoteEmAcao(null);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      toast.sucesso("Pacote contratado");
      recarregarPlano();
      recarregarUso();
    });
  };

  const handleCancelar = () => {
    if (!addonSMS) return;
    if (
      !window.confirm(
        "Deseja cancelar o pacote SMS? Voce continuara com 10 SMS gratis/mes.",
      )
    )
      return;
    setErro(null);
    setPacoteEmAcao("cancelar");
    startTransition(async () => {
      const r = await cancelarAddon(addonSMS.id);
      setPacoteEmAcao(null);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      toast.sucesso("Pacote cancelado");
      recarregarPlano();
      recarregarUso();
    });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 space-y-5">
      <header className="flex items-start gap-2">
        <MessageSquare
          size={18}
          strokeWidth={1.5}
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-primary-text"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-900">SMS</h2>
          <p className="text-xs text-slate-500">
            Envie mensagens SMS para pacientes que preferem este canal de
            contato.
          </p>
        </div>
        <Switch checked={moduloAtivo} onChange={toggleModulo} />
      </header>

      {!moduloAtivo ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Ative o modulo SMS para enviar mensagens automaticas e usar o envio
          manual.
        </p>
      ) : (
        <>
          {erro ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {erro}
            </p>
          ) : null}

          {/* Bloco 2: Pacote atual */}
          <BlocoPacote
            uso={uso}
            addonSMS={addonSMS}
            pacoteEmAcao={pacoteEmAcao}
            onContratar={handleContratar}
            onCancelar={handleCancelar}
          />

          {/* Bloco 3: Tipos automaticos */}
          <div className="space-y-2">
            <p className="text-[13px] font-semibold text-slate-900">
              Tipos de SMS automatico
            </p>
            <div className="space-y-2 rounded-lg border border-slate-200 bg-white">
              {(Object.keys(TIPO_INFO) as SMSTipoChave[]).map((chave) => {
                const info = TIPO_INFO[chave];
                return (
                  <label
                    key={chave}
                    className="flex items-start justify-between gap-3 px-3 py-2.5 cursor-pointer border-b border-slate-100 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium text-slate-900">
                        {info.label}
                      </p>
                      <p className="text-[12px] text-slate-500">
                        {info.descricao}
                      </p>
                    </div>
                    <Switch
                      checked={tipos[chave]}
                      onChange={() => toggleTipo(chave)}
                    />
                  </label>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500">
              Preferencias salvas neste navegador. Os CRONs respeitam o limite
              de SMS contratado.
            </p>
          </div>

          {/* Bloco 4: Historico */}
          <div className="space-y-2">
            <p className="text-[13px] font-semibold text-slate-900">
              Historico de envios
            </p>
            {historico.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                Nenhum SMS enviado ainda.
              </p>
            ) : (
              <>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                  {historico.slice(0, historicoPag).map((h) => {
                    const data = (() => {
                      try {
                        return format(
                          new Date(h.created_at),
                          "dd/MM HH:mm",
                          { locale: ptBR },
                        );
                      } catch {
                        return h.created_at;
                      }
                    })();
                    const falha = h.status === "falha";
                    return (
                      <li
                        key={h.id}
                        className="flex items-start justify-between gap-3 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-medium text-slate-900 truncate">
                              {h.paciente_nome ?? formatPhone(h.telefone)}
                            </p>
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-1.5 py-[1px] text-[10px] font-medium",
                                HISTORICO_BADGE[h.tipo] ??
                                  "bg-slate-200 text-slate-700",
                              )}
                            >
                              {h.tipo}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {data}
                            {h.paciente_nome
                              ? ` · ${formatPhone(h.telefone)}`
                              : ""}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 text-[11px] font-medium",
                            falha
                              ? "text-red-600"
                              : h.status === "entregue"
                                ? "text-[#16A34A]"
                                : "text-slate-500",
                          )}
                        >
                          {falha ? "Falha" : h.status}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {historico.length > historicoPag ? (
                  <button
                    type="button"
                    onClick={() => setHistoricoPag((v) => v + 20)}
                    className="text-[13px] font-medium text-primary-text hover:underline"
                  >
                    Carregar mais
                  </button>
                ) : null}
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function BlocoPacote({
  uso,
  addonSMS,
  pacoteEmAcao,
  onContratar,
  onCancelar,
}: {
  uso: UsoState | null;
  addonSMS: AddonAtivo | null;
  pacoteEmAcao: AddonPacote | "cancelar" | null;
  onContratar: (pacote: AddonPacote) => void;
  onCancelar: () => void;
}) {
  const [trocando, setTrocando] = useState(false);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-primary/30 bg-primary-surface p-3 sm:p-4">
        <div className="flex items-start gap-2">
          <Package
            size={18}
            strokeWidth={1.5}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-primary-text"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium uppercase tracking-wide text-primary-text">
              Seu pacote
            </p>
            <p className="mt-0.5 text-[15px] font-semibold text-slate-900">
              {addonSMS?.info
                ? `${addonSMS.info.nome}`
                : "Degustacao — 10 SMS gratis/mes"}
            </p>
            {addonSMS?.info ? (
              <p className="text-[12px] text-slate-700">
                {addonSMS.info.quantidade} SMS/mes ·{" "}
                {addonSMS.preco.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </p>
            ) : (
              <p className="text-[12px] text-slate-700">
                Contrate um pacote para enviar mais SMS.
              </p>
            )}
          </div>
        </div>

        {uso ? (
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-[12px] text-slate-700">
              <span>
                {uso.usado} de {uso.limite} usados
              </span>
              <span>{uso.disponivel} disponiveis</span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-white/70"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={uso.limite}
              aria-valuenow={uso.usado}
            >
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  corBarra(uso.percentual),
                )}
                style={{ width: `${Math.min(100, uso.percentual)}%` }}
              />
            </div>
            {uso.percentual >= 80 ? (
              <p className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-amber-800">
                <AlertTriangle
                  size={12}
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                {uso.percentual >= 100
                  ? "Limite atingido — SMS automaticos pausados"
                  : `Voce ja usou ${Math.round(uso.percentual)}% do mes`}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTrocando((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-primary bg-white px-3 py-1.5 text-[13px] font-medium text-primary-text hover:bg-primary-surface transition-colors"
          >
            {trocando ? "Esconder" : addonSMS ? "Trocar pacote" : "Ver pacotes"}
          </button>
          {addonSMS ? (
            <button
              type="button"
              onClick={onCancelar}
              disabled={pacoteEmAcao !== null}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {pacoteEmAcao === "cancelar"
                ? "Cancelando..."
                : "Cancelar pacote"}
            </button>
          ) : null}
        </div>
      </div>

      {trocando ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(["p1", "p2", "p3"] as AddonPacote[]).map((p) => {
            const info = ADDONS_SMS[p];
            const ehAtual = addonSMS?.pacote === p;
            const acaoAtiva = pacoteEmAcao === p;
            return (
              <div
                key={p}
                className={cn(
                  "rounded-lg border p-3 space-y-2",
                  ehAtual
                    ? "border-primary bg-primary-surface/40"
                    : "border-slate-200 bg-white",
                )}
              >
                <p className="text-[13px] font-semibold text-slate-900">
                  {info.nome}
                </p>
                <p className="text-[12px] text-slate-500">
                  {info.quantidade} SMS/mes
                </p>
                <p className="text-[16px] font-semibold text-slate-900">
                  {info.preco.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </p>
                {ehAtual ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[11px] font-medium text-white">
                    <Check
                      size={11}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    Atual
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onContratar(p)}
                    disabled={pacoteEmAcao !== null}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-3 py-2 text-[13px] font-medium text-white hover:bg-primary-dark disabled:opacity-50"
                  >
                    {acaoAtiva ? "Contratando..." : "Contratar"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default SecaoSMS;
