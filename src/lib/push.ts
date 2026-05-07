// Helpers de envio de push notifications via web-push (VAPID).
// Schema esperado em `public.push_subscriptions`:
//   id uuid PK, tenant_id uuid, profissional_id uuid, endpoint text UNIQUE,
//   p256dh text, auth text, ativo bool default true, created_at timestamptz.
//
// As chaves VAPID precisam estar nas variaveis de ambiente:
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY  (lida tambem no client para subscribe)
//   VAPID_PRIVATE_KEY             (server-only)
//
// Geradas com: `npx web-push generate-vapid-keys`.

import webpush from 'web-push';
import type { createAdminClient as CreateAdmin } from '@/lib/supabase/server';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT ?? 'mailto:contato@suaagendaonline.com.br';

let vapidConfigurado = false;
function configurarVapid(): boolean {
  if (vapidConfigurado) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  vapidConfigurado = true;
  return true;
}

export interface PayloadPush {
  titulo: string;
  corpo: string;
  url?: string;
  icone?: string;
  /** Tag agrupa notificacoes substituiveis (ex: "agendamento-{id}"). */
  tag?: string;
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface PushSubscriptionShape {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

function montarSubscription(row: SubscriptionRow): PushSubscriptionShape {
  return {
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth },
  };
}

async function desativar(
  admin: ReturnType<typeof CreateAdmin>,
  endpoint: string,
): Promise<void> {
  // Remove a subscription do banco — endpoint expirou.
  await admin
    .from('push_subscriptions')
    .update({ ativo: false })
    .eq('endpoint', endpoint);
}

/**
 * Envia push para uma unica subscription. Em caso de erro 404/410 marca a
 * subscription como inativa (expirou). Outros erros sao logados — fluxo
 * principal nao deve ser interrompido por falha de push.
 */
export async function enviarPush(
  admin: ReturnType<typeof CreateAdmin>,
  row: SubscriptionRow,
  payload: PayloadPush,
): Promise<{ ok: boolean; error?: string }> {
  if (!configurarVapid()) {
    return { ok: false, error: 'VAPID nao configurado.' };
  }
  try {
    await webpush.sendNotification(
      montarSubscription(row),
      JSON.stringify(payload),
    );
    return { ok: true };
  } catch (e: unknown) {
    const status =
      typeof e === 'object' && e !== null && 'statusCode' in e
        ? Number((e as { statusCode?: number }).statusCode)
        : 0;
    if (status === 404 || status === 410) {
      await desativar(admin, row.endpoint);
      return { ok: false, error: 'Subscription expirada.' };
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[push] erro ao enviar:', msg);
    return { ok: false, error: msg };
  }
}

export async function enviarPushParaProfissional(
  admin: ReturnType<typeof CreateAdmin>,
  profissionalId: string,
  payload: PayloadPush,
): Promise<{ enviadas: number; expiradas: number }> {
  if (!configurarVapid()) return { enviadas: 0, expiradas: 0 };
  const { data, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('profissional_id', profissionalId)
    .eq('ativo', true);
  if (error || !data) return { enviadas: 0, expiradas: 0 };

  let enviadas = 0;
  let expiradas = 0;
  await Promise.all(
    data.map(async (row) => {
      const r = await enviarPush(
        admin,
        row as SubscriptionRow,
        payload,
      );
      if (r.ok) enviadas += 1;
      else if (r.error === 'Subscription expirada.') expiradas += 1;
    }),
  );
  return { enviadas, expiradas };
}

export async function enviarPushParaTenant(
  admin: ReturnType<typeof CreateAdmin>,
  tenantId: string,
  payload: PayloadPush,
): Promise<{ enviadas: number; expiradas: number }> {
  if (!configurarVapid()) return { enviadas: 0, expiradas: 0 };
  const { data, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('tenant_id', tenantId)
    .eq('ativo', true);
  if (error || !data) return { enviadas: 0, expiradas: 0 };

  let enviadas = 0;
  let expiradas = 0;
  await Promise.all(
    data.map(async (row) => {
      const r = await enviarPush(
        admin,
        row as SubscriptionRow,
        payload,
      );
      if (r.ok) enviadas += 1;
      else if (r.error === 'Subscription expirada.') expiradas += 1;
    }),
  );
  return { enviadas, expiradas };
}

/**
 * Util base64url -> ArrayBuffer (necessario no client para registrar a
 * subscription via PushManager.subscribe). Retorna ArrayBuffer porque o
 * `applicationServerKey` exige `BufferSource` (Uint8Array<ArrayBufferLike>
 * pode ser SharedArrayBuffer e nao satisfaz a tipagem do TS lib.dom).
 */
export function vapidPublicToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw =
    typeof atob === 'function'
      ? atob(b64)
      : Buffer.from(b64, 'base64').toString('binary');
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}
