/* eslint-disable */
// Service Worker — Sua Agenda Online
//
// Versao do shell. Bump para invalidar cache antigo apos deploy.
const CACHE_VERSION = "sao-shell-v1";
const SHELL_FILES = [
  "/",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-384.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_VERSION);
        // addAll falha se um item nao existir; usa add individual para nao
        // quebrar o install completo se algum asset estiver indisponivel.
        await Promise.all(
          SHELL_FILES.map((url) =>
            cache.add(url).catch((err) => {
              console.warn("[sw] falha ao cachear", url, err);
            }),
          ),
        );
      } finally {
        // Forca o novo SW a substituir o antigo imediatamente.
        await self.skipWaiting();
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(
        nomes
          .filter((n) => n !== CACHE_VERSION)
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Apenas GET — POST/PUT/DELETE nao deve ser cacheado.
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // 1) APIs nunca sao cacheadas — sempre rede.
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // 2) Assets estaticos do Next + icones: cache-first.
  const ehAssetEstatico =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:png|jpg|jpeg|svg|webp|woff|woff2|css|js|ico)$/i.test(url.pathname);

  if (ehAssetEstatico) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        try {
          const resp = await fetch(req);
          if (resp.ok && resp.type === "basic") {
            const cache = await caches.open(CACHE_VERSION);
            cache.put(req, resp.clone()).catch(() => undefined);
          }
          return resp;
        } catch (err) {
          // Fallback para o icone se for um asset critico.
          return Response.error();
        }
      })(),
    );
    return;
  }

  // 3) Paginas HTML (navegacao): stale-while-revalidate.
  const ehNavegacao =
    req.mode === "navigate" ||
    (req.headers.get("accept") ?? "").includes("text/html");

  if (ehNavegacao) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_VERSION);
        const cached = await cache.match(req);
        const networkPromise = fetch(req)
          .then((resp) => {
            if (resp.ok) {
              cache.put(req, resp.clone()).catch(() => undefined);
            }
            return resp;
          })
          .catch(() => null);

        if (cached) {
          // Atualiza em background e devolve cache imediato.
          networkPromise.catch(() => undefined);
          return cached;
        }

        const fromNetwork = await networkPromise;
        if (fromNetwork) return fromNetwork;

        // Sem cache, sem rede: tenta servir a home como fallback.
        const fallback = await cache.match("/");
        if (fallback) return fallback;
        return new Response(
          "<!DOCTYPE html><meta charset='utf-8'><title>Offline</title>" +
            "<body style='font-family:system-ui;padding:24px;color:#0F172A;background:#F8FAFC;'>" +
            "<h1>Voce esta offline</h1>" +
            "<p>Reconecte para acessar o sistema.</p></body>",
          {
            status: 503,
            headers: { "content-type": "text/html; charset=utf-8" },
          },
        );
      })(),
    );
    return;
  }

  // 4) Outras requisicoes: rede com fallback de cache.
  event.respondWith(
    (async () => {
      try {
        return await fetch(req);
      } catch (err) {
        const cached = await caches.match(req);
        if (cached) return cached;
        throw err;
      }
    })(),
  );
});

// ---------------- Push notifications ----------------

self.addEventListener("push", (event) => {
  let payload = { titulo: "Nova notificacao", corpo: "" };
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { titulo: "Nova notificacao", corpo: event.data.text() };
    }
  }
  const titulo = payload.titulo || "Sua Agenda Online";
  const opts = {
    body: payload.corpo || "",
    icon: payload.icone || "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag,
    data: { url: payload.url || "/" },
    vibrate: [80, 40, 80],
  };
  event.waitUntil(self.registration.showNotification(titulo, opts));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url =
    (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Se ja existe uma janela aberta no mesmo origin, foca e navega.
      for (const client of allClients) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === self.location.origin) {
            client.focus();
            if ("navigate" in client) {
              return client.navigate(url).catch(() => undefined);
            }
            return;
          }
        } catch {
          // ignore
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
