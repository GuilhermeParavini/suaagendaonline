import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getStripeServer } from '@/lib/stripe';
import {
  getStripePriceId,
  type PeriodoAssinatura,
} from '@/lib/stripe-prices';
import { PLANOS, type PlanoId } from '@/lib/planos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLANO_IDS_VALIDOS: PlanoId[] = [
  'individual',
  'equipe3',
  'equipe5',
  'clinica10',
];
const PERIODOS_VALIDOS: PeriodoAssinatura[] = ['mensal', 'anual'];

function brl(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

export async function POST(request: NextRequest) {
  try {
    // 1. Autenticacao do tenant via Supabase.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Sessão expirada.' },
        { status: 401 },
      );
    }

    // 2. Parse e validacao do body.
    const body = (await request.json().catch(() => null)) as
      | { planoId?: string; periodo?: string }
      | null;
    if (!body) {
      return NextResponse.json(
        { error: 'Body inválido.' },
        { status: 400 },
      );
    }
    const planoId = body.planoId as PlanoId;
    const periodo = body.periodo as PeriodoAssinatura;
    if (!PLANO_IDS_VALIDOS.includes(planoId)) {
      return NextResponse.json(
        { error: 'Plano inválido.' },
        { status: 400 },
      );
    }
    if (!PERIODOS_VALIDOS.includes(periodo)) {
      return NextResponse.json(
        { error: 'Período inválido.' },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    // 3. Resolve o tenant do profissional logado.
    const { data: prof, error: profErr } = await admin
      .from('profissionais')
      .select('id, tenant_id, role, email, nome')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profErr) {
      return NextResponse.json(
        { error: profErr.message },
        { status: 500 },
      );
    }
    if (!prof) {
      return NextResponse.json(
        { error: 'Profissional não encontrado.' },
        { status: 404 },
      );
    }
    if (prof.role !== 'admin') {
      return NextResponse.json(
        {
          error:
            'Apenas o administrador do tenant pode contratar uma assinatura.',
        },
        { status: 403 },
      );
    }

    const { data: tenant, error: tenantErr } = await admin
      .from('tenants')
      .select(
        'id, nome_empresa, email, stripe_customer_id, plano, trial_expira_em, assinatura_status',
      )
      .eq('id', prof.tenant_id as string)
      .maybeSingle();
    if (tenantErr) {
      return NextResponse.json(
        { error: tenantErr.message },
        { status: 500 },
      );
    }
    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant não encontrado.' },
        { status: 404 },
      );
    }

    const stripe = getStripeServer();

    // 4. Garante customer no Stripe (cria se ainda nao existe).
    let stripeCustomerId =
      (tenant.stripe_customer_id as string | null) ?? null;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email:
          (tenant.email as string | null) ||
          (prof.email as string | null) ||
          user.email ||
          undefined,
        name: (tenant.nome_empresa as string | null) || undefined,
        metadata: {
          tenantId: tenant.id as string,
          tenantNome: (tenant.nome_empresa as string | null) ?? '',
        },
      });
      stripeCustomerId = customer.id;
      await admin
        .from('tenants')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', tenant.id as string);
    }

    // 5. Decide se ainda concede trial de 14 dias. Concedemos somente
    //    para tenants que NUNCA tiveram uma assinatura paga (status atual
    //    nao indica historico) — heuristica simples baseada no status.
    const statusAtual = (tenant.assinatura_status as string | null) ?? null;
    const trialUsado =
      statusAtual !== null && statusAtual !== 'trialing';

    // 6. Monta o checkout session.
    const priceId = getStripePriceId(planoId, periodo);
    const plano = PLANOS[planoId];
    const origin =
      request.headers.get('origin') ||
      `https://${request.headers.get('host') ?? 'appagenda4u.com'}`;

    const customText: { submit?: { message: string } } = {};
    if (periodo === 'anual') {
      customText.submit = {
        message: `Você será cobrado ${brl(
          plano.precos.anualTotal,
        )} agora referente a 12 meses de uso. Renovação automática anual.`,
      };
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        ...(trialUsado ? {} : { trial_period_days: 14 }),
        metadata: {
          tenantId: tenant.id as string,
          planoId,
          periodo,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      locale: 'pt-BR',
      success_url: `${origin}/configuracoes?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/configuracoes?stripe=cancel`,
      metadata: {
        tenantId: tenant.id as string,
        planoId,
        periodo,
      },
      ...(Object.keys(customText).length > 0
        ? { custom_text: customText }
        : {}),
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('[stripe/checkout] erro:', error);
    const msg =
      error instanceof Error ? error.message : 'Erro desconhecido.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
