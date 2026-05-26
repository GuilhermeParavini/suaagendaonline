-- ============================================================
-- SUA AGENDA ONLINE - Planos v2.0 (26/05/2026)
-- ============================================================
-- Migra a estrutura de planos do modelo v1 (essencial/profissional/clinica
-- com feature gating) para o modelo v2 (individual/equipe3/equipe5/clinica10
-- com todas as funcionalidades inclusas em todos os planos).
--
-- Estrategia: drop e recriar planos_sistema. Tenants existentes sao
-- migrados via UPDATE com mapeamento explicito ANTES da troca da CHECK
-- constraint em tenants.plano, para evitar valores invalidos.
--
-- Aplicar no SQL Editor do Supabase em uma unica transacao.
-- Substitui partes da v1: suagendaonline-planos-precificacao.md (06/05/2026).
-- ============================================================

begin;

-- 1. Migrar tenants existentes do esquema v1 para v2.
--    essencial    -> individual  (R$ 59,90 -> R$ 29,90)
--    profissional -> equipe3     (R$ 79,90 -> R$ 39,90)
--    clinica      -> clinica10   (R$ 119,90 -> R$ 69,90)
update public.tenants
set plano = case
  when plano = 'essencial'    then 'individual'
  when plano = 'profissional' then 'equipe3'
  when plano = 'clinica'      then 'clinica10'
  else plano
end
where plano in ('essencial', 'profissional', 'clinica');

-- 2. Trocar a CHECK constraint da coluna tenants.plano para aceitar os
--    novos IDs. O nome historico da constraint e tenants_plano_check; se
--    nao existir, o ALTER DROP nao falha em sequencia porque ja garantimos
--    o nome via IF EXISTS.
alter table public.tenants
  drop constraint if exists tenants_plano_check;

alter table public.tenants
  add constraint tenants_plano_check
  check (plano in ('trial', 'individual', 'equipe3', 'equipe5', 'clinica10'));

-- 3. Recriar a tabela planos_sistema com a estrutura v2.
--    Em v2 nao ha colunas de feature flag — todas as funcionalidades sao
--    inclusas. A variacao entre planos e maxProfissionais + limites de IA.
drop table if exists public.planos_sistema cascade;

create table public.planos_sistema (
  id text primary key, -- 'individual', 'equipe3', 'equipe5', 'clinica10'
  nome text not null,
  preco_mensal decimal(10,2) not null,
  max_profissionais integer not null,
  limite_transcricao_min integer not null,
  limite_perguntas_ia integer not null,
  ativo boolean not null default true,
  created_at timestamp with time zone default now()
);

insert into public.planos_sistema
  (id, nome, preco_mensal, max_profissionais, limite_transcricao_min, limite_perguntas_ia)
values
  ('individual', 'Individual', 29.90, 1, 60, 100),
  ('equipe3',    'Equipe 3',   39.90, 3, 120, 200),
  ('equipe5',    'Equipe 5',   49.90, 5, 200, 350),
  ('clinica10',  'Clinica 10', 69.90, 10, 400, 700);

commit;

-- ============================================================
-- Notas
-- ============================================================
-- - IA (transcricao + assistente) agora esta inclusa nos planos. Os
--   add-ons de IA da v1 (tabela addons_tenant com tipo='ia') ficam como
--   historico — nao serao mais oferecidos para contratacao. A interface
--   sera atualizada em sprint posterior para esconder a opcao.
-- - Add-ons SMS continuam disponiveis com novos tamanhos definidos em
--   src/lib/planos.ts (ADDONS_SMS):
--     p1 = 100 SMS/R$ 19,90
--     p2 = 300 SMS/R$ 39,90
--     p3 = 1.000 SMS/R$ 89,90
--   SMS avulso (excedente): R$ 0,25 cada.
-- - Trial (14 dias) continua entregando a experiencia do plano mais alto
--   (Clinica 10) — gerenciado em codigo via PLANOS.trial.
