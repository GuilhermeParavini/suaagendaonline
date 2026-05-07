"use client";

import { useEffect } from "react";

/**
 * Registra o service worker /sw.js apos o load. Sem efeito visual — apenas
 * habilita cache offline e push notifications. Erros sao logados (silencioso
 * pro usuario para nao virar barulho em ambientes que bloqueiam SW, ex:
 * extensoes de privacidade).
 */
function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Espera o load para nao competir com bundles iniciais.
    const registrar = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => {
          console.warn("[sw] falha ao registrar:", err);
        });
    };

    if (document.readyState === "complete") {
      registrar();
    } else {
      window.addEventListener("load", registrar, { once: true });
      return () => window.removeEventListener("load", registrar);
    }
  }, []);

  return null;
}

export default ServiceWorkerRegister;
