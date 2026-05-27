-- ============================================================
-- SUA AGENDA ONLINE / AGENDA4U - Integracao Stripe (Maio 2026)
-- ============================================================
-- Acrescenta colunas em public.tenants para guardar o estado da
-- assinatura Stripe (customer, subscription, periodo, status).
-- Compatibilizado com a migracao de planos v2 (individual/equipe3/
-- equipe5/clinica10), portanto deve ser aplicado DEPOIS de
-- suagendaonline-planos-v2.sql.
--
-- Aplicar no SQL Editor do Supabase em transacao unica.
-- ============================================================

begin;

-- Colunas Stripe na tabela tenants (idempotente).
alter table public.tenants
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists periodo_assinatura text,
  add column if not exists plano_expira_em timestamp with time zone,
  add column if not exists assinatura_status text;

-- CHECK constraint do periodo (mensal/anual). NULL e permitido para
-- tenants em trial / sem assinatura ativa.
alter table public.tenants
  drop constraint if exists tenants_periodo_assinatura_check;

alter table public.tenants
  add constraint tenants_periodo_assinatura_check
  check (
    periodo_assinatura is null
    or periodo_assinatura in ('mensal', 'anual')
  );

-- CHECK constraint do status da assinatura. Espelha os status que o
-- Stripe envia em customer.subscription.* e em invoice.payment_*.
alter table public.tenants
  drop constraint if exists tenants_assinatura_status_check;

alter table public.tenants
  add constraint tenants_assinatura_status_check
  check (
    assinatura_status is null
    or assinatura_status in (
      'active',
      'trialing',
      'past_due',
      'canceled',
      'unpaid',
      'incomplete',
      'incomplete_expired'
    )
  );

-- Indices para lookup no webhook.
create unique index if not exists idx_tenants_stripe_customer
  on public.tenants(stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists idx_tenants_stripe_subscription
  on public.tenants(stripe_subscription_id)
  where stripe_subscription_id is not null;

commit;

-- ============================================================
-- Notas
-- ============================================================
-- 1. O webhook /api/stripe/webhook recebe eventos do Stripe e
--    atualiza estas colunas. Configurar o endpoint apos deploy:
--      https://appagenda4u.com/api/stripe/webhook
-- 2. Eventos tratados: checkout.session.completed,
--    customer.subscription.updated, customer.subscription.deleted,
--    invoice.payment_failed.
-- 3. O lookup por customer/subscription usa indices unicos para
--    bater o tenant correto. Caso um customer Stripe seja excluido
--    e recriado, o webhook reconcilia via metadata.tenantId tambem.
