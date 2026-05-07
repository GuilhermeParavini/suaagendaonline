// Helpers client-safe relacionados a push notifications.
// NAO importa `web-push` — esse arquivo e usado por componentes "use client".
// O envio efetivo (que usa o pacote Node `web-push`) vive em `push-server.ts`.

export interface PayloadPush {
  titulo: string;
  corpo: string;
  url?: string;
  icone?: string;
  /** Tag agrupa notificacoes substituiveis (ex: "agendamento-{id}"). */
  tag?: string;
}

/**
 * Util base64url -> ArrayBuffer (necessario no client para registrar a
 * subscription via PushManager.subscribe). Retorna ArrayBuffer porque o
 * `applicationServerKey` exige `BufferSource` (Uint8Array<ArrayBufferLike>
 * pode ser SharedArrayBuffer e nao satisfaz a tipagem do TS lib.dom).
 */
export function vapidPublicToUint8Array(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw =
    typeof atob === "function"
      ? atob(b64)
      : Buffer.from(b64, "base64").toString("binary");
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}
