"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Lock,
  MessageSquare,
  Mic,
  Sparkles,
  X,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  cancelarAddon,
  contratarAddon,
  getPlanoAtual,
  getUsoIA,
  getUsoSMS,
  type AddonAtivo,
  type PlanoAtual,
  type UsoMensal,
} from "@/actions/planos";
import {
  ADDONS_IA,
  ADDONS_SMS,
  type AddonPacote,
  type AddonTipo,
  type InfoAddon,
} from "@/lib/planos";
import Button from "@/components/ui/Button";
import { useToast } from "@/contexts/ToastContext";
import { cn } from "@/lib/utils";

interface SecaoMeuPlanoProps {
  plano: string;
  trialExpiraEm: string | null;
}

function formatarPreco(valor: number): string {
  if (valor === 0) return "Gratis";
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function diasRestantes(iso: string | null): number | null {
  if (!iso) return null;
  const fim = new Date(iso).getTime();
  if (!Number.isFinite(fim)) return null;
  const diff = Math.ceil((fim - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
}

function corBarra(percentual: number): string {
  if (percentual >= 80) return "bg-red-500";
  if (percentual >= 50) return "bg-amber-500";
  return "bg-primary";
}

const FUNC_NOMES: Record<string, string> = {
  agenda: "Agenda completa",
  pacientes: "Cadastro de pacientes",
  financeiro: "Modulo financeiro",
  relatorios: "Relatorios",
  transcricao_audio: "Transcricao de audio",
  assistente_ia: "Assistente IA",
  planos_tratamento: "Planos de tratamento",
  estoque: "Controle de estoque",
  comissoes: "Comissoes",
  aftercare: "Aftercare",
  multi_profissional: "Ate 5 profissionais",
  avaliacoes_publicas: "Avaliacoes publicas",
};

function SecaoMeuPlano({ plano: planoSlug, trialExpiraEm }: SecaoMeuPlanoProps) {
  const [dados, setDados] = useState<PlanoAtual | null>(null);
  const [usoSMS, setUsoSMS] = useState<UsoMensal | null>(null);
  const [usoIA, setUsoIA] = useState<UsoMensal | null>(null);
  const [modalAberto, setModalAberto] = useState(false);

  async function recarregar() {
    const [r1, r2, r3] = await Promise.all([
      getPlanoAtual(),
      getUsoSMS(),
      getUsoIA(),
    ]);
    if (r1.ok) setDados(r1.data);
    if (r2.ok) setUsoSMS(r2.data);
    if (r3.ok) setUsoIA(r3.data);
  }

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const [r1, r2, r3] = await Promise.all([
        getPlanoAtual(),
        getUsoSMS(),
        getUsoIA(),
      ]);
      if (cancelado) return;
      if (r1.ok) setDados(r1.data);
      if (r2.ok) setUsoSMS(r2.data);
      if (r3.ok) setUsoIA(r3.data);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const plano = dados?.plano;
  const isTrial = planoSlug === "trial";
  const dias = isTrial ? diasRestantes(trialExpiraEm) : null;

  const addonsSMS = useMemo(
    () => dados?.addons.filter((a) => a.tipo === "sms") ?? [],
    [dados],
  );
  const addonsIA = useMemo(
    () => dados?.addons.filter((a) => a.tipo === "ia") ?? [],
    [dados],
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Meu plano</h2>
          <p className="text-[13px] text-slate-500">
            Plano atual, add-ons contratados e uso do mes.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => setModalAberto(true)}
          className="text-[13px] px-3"
        >
          Gerenciar add-ons
        </Button>
      </header>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-base font-semibold text-slate-900">
                {plano?.nome ?? "Carregando..."}
              </p>
              {isTrial ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-surface px-2 py-1 text-[12px] font-medium text-[#0F766E]">
                  <Sparkles size={12} strokeWidth={1.5} aria-hidden="true" />
                  Em teste
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-[#D1FAE5] px-2 py-1 text-[12px] font-medium text-[#065F46]">
                  Ativo
                </span>
              )}
            </div>
            <p className="text-[14px] text-slate-700">
              {plano && plano.preco === 0
                ? "Periodo de teste gratuito"
                : plano
                  ? `${formatarPreco(plano.preco)} / mes`
                  : ""}
            </p>
          </div>
        </div>

        {isTrial && dias !== null ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
            {dias > 0
              ? `Seu periodo de teste expira em ${dias} ${dias === 1 ? "dia" : "dias"}.`
              : "Seu periodo de teste expirou."}
          </p>
        ) : null}

        {plano ? (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
            {plano.funcionalidades.map((f) => (
              <li
                key={f}
                className="flex items-center gap-2 text-[13px] text-slate-700"
              >
                <Check
                  size={14}
                  strokeWidth={2}
                  className="text-primary-text"
                  aria-hidden="true"
                />
                {FUNC_NOMES[f] ?? f}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <CardUso
        titulo="SMS"
        icone={
          <MessageSquare
            size={14}
            strokeWidth={1.5}
            className="text-primary-text"
            aria-hidden="true"
          />
        }
        uso={usoSMS}
        unidade="SMS"
      />

      <CardUso
        titulo="Assistente IA + Transcricao"
        icone={
          <Mic
            size={14}
            strokeWidth={1.5}
            className="text-primary-text"
            aria-hidden="true"
          />
        }
        uso={usoIA}
        unidade="unidades"
      />

      {addonsSMS.length + addonsIA.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
          <p className="text-[14px] font-medium text-slate-900">
            Add-ons contratados
          </p>
          <ul className="space-y-1.5">
            {[...addonsSMS, ...addonsIA].map((a) => (
              <ItemAddon key={a.id} addon={a} onMudou={recarregar} />
            ))}
          </ul>
        </div>
      ) : null}

      <ModalAddons
        aberto={modalAberto}
        onClose={() => setModalAberto(false)}
        onMudou={recarregar}
      />
    </section>
  );
}

function CardUso({
  titulo,
  icone,
  uso,
  unidade,
}: {
  titulo: string;
  icone: React.ReactNode;
  uso: UsoMensal | null;
  unidade: string;
}) {
  const cor = uso ? corBarra(uso.percentual) : "bg-slate-200";
  const percent = uso ? Math.max(2, Math.round(uso.percentual)) : 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
      <div className="flex items-center gap-2">
        {uso && uso.limiteTotal > 0 ? (
          icone
        ) : (
          <Lock
            size={14}
            strokeWidth={1.5}
            className="text-slate-500"
            aria-hidden="true"
          />
        )}
        <p className="text-[14px] font-medium text-slate-900">{titulo}</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full transition-all", cor)}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex items-baseline justify-between gap-2 text-[13px]">
        <p className="text-slate-700">
          <span className="font-semibold text-slate-900">{uso?.usado ?? 0}</span>{" "}
          de {uso?.limiteTotal ?? 0} {unidade} este mes
        </p>
        <p className="text-slate-500">
          {uso ? `${Math.round(uso.percentual)}%` : "—"}
        </p>
      </div>
      {uso ? (
        <p className="text-[12px] text-slate-500">
          {uso.limiteGratis} gratis (degustacao) + {uso.limiteAddon} de add-ons
        </p>
      ) : null}
    </div>
  );
}

function ItemAddon({
  addon,
  onMudou,
}: {
  addon: AddonAtivo;
  onMudou: () => void;
}) {
  const [carregando, setCarregando] = useState(false);
  const toast = useToast();

  async function cancelar() {
    if (!window.confirm("Cancelar este add-on?")) return;
    setCarregando(true);
    const r = await cancelarAddon(addon.id);
    setCarregando(false);
    if (!r.ok) {
      toast.erro(r.error);
      return;
    }
    toast.sucesso("Add-on cancelado");
    onMudou();
  }

  return (
    <li className="flex items-center justify-between gap-2 rounded border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="text-[13px]">
        <p className="font-medium text-slate-900">
          {addon.info?.nome ?? `${addon.tipo.toUpperCase()} pacote`}
        </p>
        <p className="text-slate-500">
          {formatarPreco(addon.preco)} / mes — desde{" "}
          {addon.data_inicio.split("-").reverse().join("/")}
        </p>
      </div>
      <Button
        variant="ghost"
        onClick={cancelar}
        disabled={carregando}
        className="text-[13px] text-danger px-3"
      >
        Cancelar
      </Button>
    </li>
  );
}

function ModalAddons({
  aberto,
  onClose,
  onMudou,
}: {
  aberto: boolean;
  onClose: () => void;
  onMudou: () => void;
}) {
  const [tipo, setTipo] = useState<AddonTipo>("sms");

  return (
    <Dialog.Root open={aberto} onOpenChange={(v) => (v ? null : onClose())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-lg sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-[480px] sm:rounded-2xl">
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-base font-semibold text-slate-900">
              Gerenciar add-ons
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fechar"
                className="inline-flex items-center justify-center rounded text-slate-500 hover:bg-slate-100"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-[13px] text-slate-500 mt-1">
            Escolha o tipo de add-on e o pacote que deseja contratar.
          </Dialog.Description>

          <div className="mt-4 grid grid-cols-2 gap-1 rounded border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setTipo("sms")}
              className={cn(
                "rounded px-3 py-2 text-[14px] font-medium transition-colors",
                tipo === "sms"
                  ? "bg-primary-surface text-[#0F766E]"
                  : "text-slate-500 hover:text-slate-900",
              )}
            >
              SMS
            </button>
            <button
              type="button"
              onClick={() => setTipo("ia")}
              className={cn(
                "rounded px-3 py-2 text-[14px] font-medium transition-colors",
                tipo === "ia"
                  ? "bg-primary-surface text-[#0F766E]"
                  : "text-slate-500 hover:text-slate-900",
              )}
            >
              Assistente IA
            </button>
          </div>

          <ul className="mt-4 space-y-2">
            {Object.values(tipo === "sms" ? ADDONS_SMS : ADDONS_IA).map(
              (info) => (
                <ItemPacote
                  key={info.pacote}
                  info={info}
                  onContratado={() => {
                    onMudou();
                    onClose();
                  }}
                />
              ),
            )}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ItemPacote({
  info,
  onContratado,
}: {
  info: InfoAddon;
  onContratado: () => void;
}) {
  const [carregando, setCarregando] = useState(false);
  const toast = useToast();

  async function contratar() {
    setCarregando(true);
    const r = await contratarAddon(info.tipo, info.pacote as AddonPacote);
    setCarregando(false);
    if (!r.ok) {
      toast.erro(r.error);
      return;
    }
    toast.sucesso(`${info.nome} contratado`);
    onContratado();
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
      <div className="text-[14px]">
        <p className="font-medium text-slate-900">{info.nome}</p>
        <p className="text-[13px] text-slate-500">
          {info.quantidade} {info.tipo === "sms" ? "SMS" : "perguntas"} / mes
        </p>
      </div>
      <div className="flex items-center gap-3">
        <p className="text-[14px] font-semibold text-slate-900">
          {formatarPreco(info.preco)}
        </p>
        <Button onClick={contratar} disabled={carregando} className="text-[13px] px-3">
          Contratar
        </Button>
      </div>
    </li>
  );
}

export default SecaoMeuPlano;
