/**
 * Utilitarios de PWA / service worker.
 *
 * `limparCacheERecarregar` e a "saida de emergencia" para quando o app fica
 * preso servindo uma versao antiga (service worker com cache stale). Ela:
 *  1. pede ao SW ativo para limpar o cache (handler "LIMPAR_CACHE" em sw.js);
 *  2. limpa diretamente a Cache API a partir da pagina (mais confiavel — nao
 *     depende do timing da mensagem ao SW);
 *  3. recarrega a pagina para baixar HTML/JS/RSC frescos.
 *
 * Nao afeta dados do usuario (tudo vive no Supabase) — apenas caches locais.
 */
export async function limparCacheERecarregar(): Promise<void> {
  try {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.controller?.postMessage({ type: "LIMPAR_CACHE" });
    }
    if (typeof window !== "undefined" && "caches" in window) {
      const nomes = await caches.keys();
      await Promise.all(nomes.map((n) => caches.delete(n)));
    }
  } catch (err) {
    console.warn("[pwa] falha ao limpar cache:", err);
  } finally {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }
}
