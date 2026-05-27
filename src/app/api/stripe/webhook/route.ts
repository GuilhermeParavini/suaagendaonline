import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/server';
import { getStripeServer } from '@/lib/stripe';
import { getPlanoByStripePriceId } from '@/lib/stripe-prices';

export const runtime = 'nodejs';
// Webhook precisa do body RAW para verificar a assinatura. Desabilita
// qualquer cache/transformacao do Next.
export const dynamic = 'force-dynamic';

type TenantUpdate = {
  plano?: string;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
  periodo_assinatura?: 'mensal' | 'anual' | null;
  assinatura_status?: string | null;
  plano_expira_em?: string | null;
  trial_expira_em?: string | null;
};

async function atualizarTenantPorCustomer(
  admin: ReturnType<typeof createAdminClient>,
  customerId: string,
  update: TenantUpdate,
  fallbackTenantId?: string,
) {
  if (Object.keys(update).length === 0) return;
  const query = admin.from('tenants').update(update);
  if (fallbackTenantId) {
    await query.or(
      `stripe_customer_id.eq.${customerId},id.eq.${fallbackTenantId}`,
    );
  } else {
    await query.eq('stripe_customer_id', customerId);
  }
}

async function aplicarSubscription(
  admin: ReturnType<typeof createAdminClient>,
  subscription: Stripe.Subscription,
  fallbackTenantId?: string,
) {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

  const item = subscription.items.data[0];
  const priceId = item?.price?.id ?? null;
  const mapeado = getPlanoByStripePriceId(priceId);

  // current_period_end nao esta no type Subscription em todas as
  // versoes; acessamos via Record para evitar erro de tipagem.
  const subAny = subscription as unknown as Record<string, unknown>;
  const currentPeriodEnd =
    typeof subAny.current_period_end === 'number'
      ? (subAny.current_period_end as number)
      : null;

  const update: TenantUpdate = {
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    assinatura_status: subscription.status,
    periodo_assinatura: mapeado?.periodo ?? null,
    plano_expira_em: currentPeriodEnd
      ? new Date(currentPeriodEnd * 1000).toISOString()
      : null,
  };

  // Atualiza o plano em tenants somente quando o status corresponde a
  // assinatura ativa/trialing. Em past_due/unpaid mantemos o plano
  // anterior; em canceled rebaixamos para trial.
  if (mapeado && ['active', 'trialing'].includes(subscription.status)) {
    update.plano = mapeado.planoId;
  } else if (subscription.status === 'canceled') {
    update.plano = 'trial';
  }

  await atualizarTenantPorCustomer(
    admin,
    customerId,
    update,
    fallbackTenantId,
  );
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json(
      { error: 'Assinatura ausente.' },
      { status: 400 },
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error(
      '[stripe/webhook] STRIPE_WEBHOOK_SECRET nao configurado.',
    );
    return NextResponse.json(
      { error: 'Servidor mal configurado.' },
      { status: 500 },
    );
  }

  const rawBody = await request.text();
  const stripe = getStripeServer();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    );
  } catch (error) {
    console.error('[stripe/webhook] assinatura invalida:', error);
    return NextResponse.json(
      { error: 'Assinatura inválida.' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId =
          (session.metadata?.tenantId as string | undefined) ?? undefined;
        const customerId =
          typeof session.customer === 'string'
            ? session.customer
            : session.customer?.id;

        if (customerId && tenantId) {
          // Garante que o customer_id esta vinculado ao tenant correto
          // (no caso de pagamento via signup novo).
          await admin
            .from('tenants')
            .update({ stripe_customer_id: customerId })
            .eq('id', tenantId);
        }

        // Carrega a subscription para aplicar o estado completo.
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id;
        if (subscriptionId) {
          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId);
          await aplicarSubscription(admin, subscription, tenantId);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const fallbackTenantId =
          (subscription.metadata?.tenantId as string | undefined) ??
          undefined;
        await aplicarSubscription(admin, subscription, fallbackTenantId);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id;
        const fallbackTenantId =
          (subscription.metadata?.tenantId as string | undefined) ??
          undefined;

        await atualizarTenantPorCustomer(
          admin,
          customerId,
          {
            plano: 'trial',
            assinatura_status: 'canceled',
            stripe_subscription_id: null,
            stripe_price_id: null,
            periodo_assinatura: null,
            plano_expira_em: null,
          },
          fallbackTenantId,
        );
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === 'string'
            ? invoice.customer
            : invoice.customer?.id;
        if (!customerId) break;

        await admin
          .from('tenants')
          .update({ assinatura_status: 'past_due' })
          .eq('stripe_customer_id', customerId);

        // Notificacao por email do profissional admin do tenant.
        const { data: tenant } = await admin
          .from('tenants')
          .select('id, email, nome_empresa')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (tenant?.email) {
          console.warn(
            '[stripe/webhook] pagamento falhou — disparar email a',
            tenant.email,
            '(implementar envio via Resend).',
          );
        }
        break;
      }

      default:
        // Evento ignorado de proposito.
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(
      `[stripe/webhook] erro ao processar ${event.type}:`,
      error,
    );
    return NextResponse.json(
      { error: 'Falha ao processar webhook.' },
      { status: 500 },
    );
  }
}
