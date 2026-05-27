import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getStripeServer } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
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

    const admin = createAdminClient();
    const { data: prof, error: profErr } = await admin
      .from('profissionais')
      .select('id, tenant_id, role')
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
            'Apenas o administrador pode gerenciar a assinatura.',
        },
        { status: 403 },
      );
    }

    const { data: tenant, error: tenantErr } = await admin
      .from('tenants')
      .select('id, stripe_customer_id')
      .eq('id', prof.tenant_id as string)
      .maybeSingle();
    if (tenantErr) {
      return NextResponse.json(
        { error: tenantErr.message },
        { status: 500 },
      );
    }
    if (!tenant || !tenant.stripe_customer_id) {
      return NextResponse.json(
        {
          error:
            'Nenhuma assinatura encontrada. Contrate um plano antes de abrir o portal.',
        },
        { status: 400 },
      );
    }

    const stripe = getStripeServer();
    const origin =
      request.headers.get('origin') ||
      `https://${request.headers.get('host') ?? 'appagenda4u.com'}`;

    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripe_customer_id as string,
      return_url: `${origin}/configuracoes`,
      locale: 'pt-BR',
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[stripe/portal] erro:', error);
    const msg =
      error instanceof Error ? error.message : 'Erro desconhecido.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
