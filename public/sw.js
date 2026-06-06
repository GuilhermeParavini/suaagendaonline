/* eslint-disable */
// Service Worker — Sua Agenda Online
//
// Versao do shell. Bump para invalidar cache antigo apos deploy.
// IMPORTANTE: trocar este valor a cada deploy que altere o shell/HTML,
// senao o `activate` nao limpa caches antigos (era a causa de tela branca
// ao reabrir o app apos um novo deploy).
const CACHE_VERSION = "sao-shell-v3";
const SHELL_FILES = [
  "/",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-384.png",
  "/icon-512.png",
];

// Rotas de autenticacao/fluxo de sessao: NUNCA podem ser servidas de cache.
// Servir HTML stale dessas rotas conflita com o Supabase Auth e com os IDs
// de Server Action do Next (build skew), travando login e onboarding.
function ehRotaAuth(pathname) {
  return (
    pathname === "/login" ||
    pathname === "/cadastro" ||
    pathname === "/signup" ||
    pathname === "/onboarding" ||
    pathname === "/esqueci-senha" ||
    pathname === "/redefinir-senha" ||
    pathname.startsWith("/auth/")
  );
}

function ehNavegacao(req) {
  return (
    req.mode === "navigate" ||
    (req.headers.get("accept") ?? "").includes("text/html")
  );
}

async function limparTodoCache() {
  const nomes = await caches.keys();
  await Promise.all(nomes.map((n) => caches.delete(n)));
}

function respostaOffline() {
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
}

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
  // Apenas GET — POST/PUT/DELETE (inclui Server Actions) sempre vao pra rede.
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Apenas same-origin. Requisicoes a terceiros nao sao tocadas pelo SW.
  if (url.origin !== self.location.origin) return;

  // 1) APIs nunca sao cacheadas — sempre rede (NetworkOnly).
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // 2) Rotas de autenticacao: NetworkOnly.
  if (ehRotaAuth(url.pathname)) {
    // Ao chegar em /login (logout ou sessao expirada), limpa TODO o cache
    // para nao reexibir paginas autenticadas servidas de cache.
    if (ehNavegacao(req) && url.pathname === "/login") {
      event.respondWith(
        (async () => {
          await limparTodoCache().catch(() => undefined);
          try {
            return await fetch(req);
          } catch {
            return respostaOffline();
          }
        })(),
      );
    }
    // Demais rotas de auth: deixa passar direto pra rede (sem respondWith).
    return;
  }

  // 3) Assets estaticos do Next + icones: cache-first.
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

  // 4) Paginas HTML (navegacao): network-first.
  // Numa app SSR/App Router, servir HTML stale causa mismatch de buildId/RSC
  // e Server Actions quebrados (tela branca ao reabrir). Por isso buscamos
  // sempre da rede; o cache so e usado como fallback offline.
  if (ehNavegacao(req)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_VERSION);
        try {
          const resp = await fetch(req);
          // Nao cacheia respostas que pedem no-store (paginas dinamicas/auth).
          const cc = resp.headers.get("cache-control") ?? "";
          if (resp.ok && resp.type === "basic" && !cc.includes("no-store")) {
            cache.put(req, resp.clone()).catch(() => undefined);
          }
          return resp;
        } catch (err) {
          const cached = await cache.match(req);
          if (cached) return cached;
          const fallback = await cache.match("/");
          if (fallback) return fallback;
          return respostaOffline();
        }
      })(),
    );
    return;
  }

  // 5) Outras requisicoes: rede com fallback de cache.
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

// Permite que o cliente solicite a limpeza total do cache (ex: ao deslogar).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "LIMPAR_CACHE") {
    event.waitUntil(limparTodoCache().catch(() => undefined));
  }
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
