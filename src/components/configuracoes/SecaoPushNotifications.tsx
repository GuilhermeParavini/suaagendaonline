"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Bell, BellOff, Check } from "lucide-react";
import {
  getSubscriptionAtiva,
  removerSubscription,
  salvarSubscription,
} from "@/actions/push";
import { vapidPublicToUint8Array } from "@/lib/push-client";
import { cn } from "@/lib/utils";

type Estado =
  | "carregando"
  | "nao_suportado"
  | "permissao_negada"
  | "ativa"
  | "inativa";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function suporteOk(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function SecaoPushNotifications() {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [erro, setErro] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (!suporteOk()) {
        if (cancelado) return;
        setEstado("nao_suportado");
        return;
      }
      const permissao = Notification.permission;
      if (permissao === "denied") {
        if (cancelado) return;
        setEstado("permissao_negada");
        return;
      }
      // Verifica subscription atual no navegador.
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const r = await getSubscriptionAtiva(sub.endpoint);
          if (cancelado) return;
          setEstado(r.ok && r.data.ativa ? "ativa" : "inativa");
          return;
        }
      } catch (e) {
        console.error("[push] verificacao inicial:", e);
      }
      if (cancelado) return;
      setEstado("inativa");
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const ativar = async () => {
    setErro(null);
    if (!suporteOk()) {
      setEstado("nao_suportado");
      return;
    }
    if (!VAPID_PUBLIC) {
      setErro(
        "Notificacoes nao configuradas neste ambiente. Contate o suporte.",
      );
      return;
    }
    setPendingAction(true);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setEstado(
          permissao === "denied" ? "permissao_negada" : "inativa",
        );
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidPublicToUint8Array(VAPID_PUBLIC),
        });
      }
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setErro("Falha ao obter subscription.");
        return;
      }
      const r = await salvarSubscription({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setEstado("ativa");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao ativar notificacoes.");
    } finally {
      setPendingAction(false);
    }
  };

  const desativar = async () => {
    setErro(null);
    setPendingAction(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removerSubscription(sub.endpoint);
        await sub.unsubscribe().catch(() => undefined);
      }
      setEstado("inativa");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao desativar.");
    } finally {
      setPendingAction(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Notificacoes push
          </h2>
          <p className="text-[13px] text-slate-500">
            Receba avisos no navegador quando um paciente agendar, cancelar ou
            reagendar.
          </p>
        </div>
        <Toggle
          ativo={estado === "ativa"}
          desabilitado={
            estado === "carregando" ||
            estado === "nao_suportado" ||
            estado === "permissao_negada" ||
            pendingAction
          }
          onToggle={() =>
            estado === "ativa" ? desativar() : ativar()
          }
        />
      </header>

      <Status estado={estado} erro={erro} />
    </section>
  );
}

function Toggle({
  ativo,
  desabilitado,
  onToggle,
}: {
  ativo: boolean;
  desabilitado: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ativo}
      aria-label={ativo ? "Desativar notificacoes" : "Ativar notificacoes"}
      disabled={desabilitado}
      onClick={onToggle}
      className={cn(
        "shrink-0 inline-flex h-11 w-12 items-center justify-center rounded-md",
        desabilitado && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
          ativo ? "bg-primary" : "bg-slate-300",
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
            ativo ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

function Status({
  estado,
  erro,
}: {
  estado: Estado;
  erro: string | null;
}) {
  if (estado === "carregando") {
    return (
      <p className="text-[13px] text-slate-500">Verificando suporte...</p>
    );
  }
  if (estado === "nao_suportado") {
    return (
      <p className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
        <AlertTriangle size={14} strokeWidth={1.5} aria-hidden="true" />
        Nao suportado neste navegador.
      </p>
    );
  }
  if (estado === "permissao_negada") {
    return (
      <div className="space-y-1">
        <p className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
          <BellOff size={14} strokeWidth={1.5} aria-hidden="true" />
          Permissao bloqueada nas configuracoes do navegador.
        </p>
        <p className="text-[12px] text-slate-500">
          Habilite notificacoes para este site nas configuracoes do navegador e
          recarregue a pagina.
        </p>
      </div>
    );
  }
  if (estado === "ativa") {
    return (
      <p className="inline-flex items-center gap-2 rounded-lg border border-[#CCFBF1] bg-[#F0FDFA] px-3 py-2 text-[13px] text-[#115E59]">
        <Check size={14} strokeWidth={2} aria-hidden="true" />
        Notificacoes ativas neste navegador.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-[13px] text-slate-700">
        <Bell size={14} strokeWidth={1.5} aria-hidden="true" />
        Desativadas
      </p>
      {erro ? (
        <p className="text-[12px] text-danger">{erro}</p>
      ) : null}
    </div>
  );
}

export default SecaoPushNotifications;
