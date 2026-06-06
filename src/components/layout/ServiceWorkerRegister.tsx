"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { limparCacheERecarregar } from "@/lib/pwa";

/**
 * Registra o service worker /sw.js apos o load e detecta quando ha uma nova
 * versao disponivel (via "updatefound" + "controllerchange"). Ao detectar,
 * mostra um banner fixo no topo com "Atualizar agora", que limpa o cache e
 * recarrega para baixar a versao mais recente.
 *
 * Erros de registro sao logados silenciosamente (extensoes de privacidade
 * podem bloquear o SW — nao deve virar barulho pro usuario).
 */
function ServiceWorkerRegister() {
  const [atualizacaoDisponivel, setAtualizacaoDisponivel] = useState(false);
  const [dispensado, setDispensado] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Se ja havia um SW controlando a pagina no mount, qualquer instalacao/
    // troca de controller posterior e uma ATUALIZACAO — nao a primeira
    // instalacao. Usado para nao exibir o banner no primeiro acesso.
    const haviaControllerInicial = Boolean(navigator.serviceWorker.controller);

    const sinalizarNovaVersao = () => setAtualizacaoDisponivel(true);

    const monitorar = (reg: ServiceWorkerRegistration) => {
      // Update ja baixado e aguardando ativacao.
      if (reg.waiting && navigator.serviceWorker.controller) {
        sinalizarNovaVersao();
      }
      reg.addEventListener("updatefound", () => {
        const instalando = reg.installing;
        if (!instalando) return;
        instalando.addEventListener("statechange", () => {
          // "installed" com um controller existente = nova versao pronta.
          if (
            instalando.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            sinalizarNovaVersao();
          }
        });
      });
    };

    const registrar = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then(monitorar)
        .catch((err) => {
          console.warn("[sw] falha ao registrar:", err);
        });
    };

    if (document.readyState === "complete") {
      registrar();
    } else {
      window.addEventListener("load", registrar, { once: true });
    }

    // Novo SW assumiu o controle da pagina. Ignora a primeira instalacao.
    const onControllerChange = () => {
      if (haviaControllerInicial) sinalizarNovaVersao();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    return () => {
      window.removeEventListener("load", registrar);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  const atualizarAgora = () => {
    setAtualizando(true);
    void limparCacheERecarregar();
  };

  if (!atualizacaoDisponivel || dispensado) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-3 bg-[#0D9488] px-4 py-2.5 text-sm text-white shadow-md"
    >
      <RefreshCw
        size={16}
        strokeWidth={2}
        aria-hidden="true"
        className={atualizando ? "animate-spin" : ""}
      />
      <span className="font-medium">Nova versão disponível</span>
      <button
        type="button"
        onClick={atualizarAgora}
        disabled={atualizando}
        className="rounded-md bg-white px-3 py-1 text-[13px] font-semibold text-[#0D9488] transition-colors hover:bg-white/90 disabled:opacity-70"
      >
        {atualizando ? "Atualizando…" : "Atualizar agora"}
      </button>
      <button
        type="button"
        onClick={() => setDispensado(true)}
        aria-label="Dispensar aviso"
        className="ml-1 inline-flex items-center justify-center rounded p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}

export default ServiceWorkerRegister;
