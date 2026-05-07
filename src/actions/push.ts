'use server';

import { createAdminClient, createClient } from '@/lib/supabase/server';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export interface PushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

async function obterContexto(): Promise<
  | { ok: true; tenantId: string; profissionalId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessao expirada.' };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('profissionais')
    .select('id, tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Profissional nao encontrado.' };

  return {
    ok: true,
    tenantId: data.tenant_id as string,
    profissionalId: data.id as string,
  };
}

/**
 * Salva a subscription do navegador atual. Usa upsert por endpoint para
 * evitar duplicar quando o usuario reativa apos desativar.
 */
export async function salvarSubscription(
  subscription: PushSubscriptionInput,
): Promise<Result<{ id: string }>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  if (!subscription?.endpoint || !subscription?.keys?.p256dh ||
    !subscription?.keys?.auth) {
    return { ok: false, error: 'Subscription invalida.' };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('push_subscriptions')
    .upsert(
      {
        tenant_id: ctx.tenantId,
        profissional_id: ctx.profissionalId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        ativo: true,
      },
      { onConflict: 'endpoint' },
    )
    .select('id')
    .single();

  if (error) {
    console.error('[push] erro ao salvar subscription:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, data: { id: data.id as string } };
}

export async function removerSubscription(
  endpoint: string,
): Promise<Result<null>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  if (!endpoint) return { ok: false, error: 'Endpoint invalido.' };

  const admin = createAdminClient();
  const { error } = await admin
    .from('push_subscriptions')
    .update({ ativo: false })
    .eq('endpoint', endpoint)
    .eq('profissional_id', ctx.profissionalId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function getSubscriptionAtiva(
  endpoint?: string | null,
): Promise<Result<{ ativa: boolean }>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  let q = admin
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('profissional_id', ctx.profissionalId)
    .eq('ativo', true);
  if (endpoint) q = q.eq('endpoint', endpoint);

  const { count, error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { ativa: (count ?? 0) > 0 } };
}
