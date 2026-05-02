-- ============================================================
-- SUA AGENDA ONLINE - Schema Completo do Banco de Dados
-- Supabase (PostgreSQL) com Row Level Security
-- Versao 1.0 | Maio 2026 | AGPXL
-- ============================================================

-- Executar este script no SQL Editor do Supabase
-- Projeto: suagendaonline (novo projeto na conta existente)

-- ============================================================
-- 0. EXTENSOES
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. TABELA: tenants (Contas/Clinicas)
-- ============================================================

create table public.tenants (
  id uuid primary key default uuid_generate_v4(),
  nome_empresa text not null,
  slug text unique not null,
  plano text not null default 'trial' check (plano in ('trial', 'essencial', 'profissional', 'clinica')),
  status_assinatura text not null default 'trial' check (status_assinatura in ('trial', 'ativo', 'cancelado', 'suspenso')),
  max_profissionais integer not null default 1,
  trial_expira_em timestamp with time zone default (now() + interval '14 days'),
  telefone text,
  email text,
  endereco text,
  cidade text,
  estado text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create unique index idx_tenants_slug on public.tenants(slug);

-- ============================================================
-- 2. TABELA: profissionais
-- ============================================================

create table public.profissionais (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  especialidade text not null,
  registro_profissional text,
  email text not null,
  telefone text,
  bio text,
  avatar_url text,
  duracao_padrao_min integer not null default 30,
  intervalo_entre_consultas_min integer not null default 0,
  tolerancia_atraso_min integer not null default 5,
  role text not null default 'profissional' check (role in ('admin', 'profissional', 'secretaria')),
  ativo boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index idx_profissionais_tenant on public.profissionais(tenant_id);
create unique index idx_profissionais_user on public.profissionais(user_id);
create index idx_profissionais_especialidade on public.profissionais(especialidade);

-- ============================================================
-- 3. TABELA: horarios_disponiveis
-- ============================================================

create table public.horarios_disponiveis (
  id uuid primary key default uuid_generate_v4(),
  profissional_id uuid not null references public.profissionais(id) on delete cascade,
  dia_semana integer not null check (dia_semana between 0 and 6),
  hora_inicio time not null,
  hora_fim time not null,
  ativo boolean not null default true,
  created_at timestamp with time zone default now()
);

create index idx_horarios_profissional on public.horarios_disponiveis(profissional_id);

-- ============================================================
-- 4. TABELA: pacientes
-- ============================================================

create table public.pacientes (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nome text not null,
  cpf text not null,
  data_nascimento date not null,
  genero text not null check (genero in ('masculino', 'feminino', 'prefiro_nao_informar')),
  telefone text not null,
  email text,
  endereco text,
  cidade text,
  estado text,
  cep text,
  convenio text,
  menor_idade boolean not null default false,
  observacoes text,
  ativo boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index idx_pacientes_tenant on public.pacientes(tenant_id);
create index idx_pacientes_cpf on public.pacientes(tenant_id, cpf);
create index idx_pacientes_nome on public.pacientes(tenant_id, nome);

-- ============================================================
-- 5. TABELA: responsaveis (para menores de idade)
-- ============================================================

create table public.responsaveis (
  id uuid primary key default uuid_generate_v4(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  nome text not null,
  cpf text not null,
  telefone text not null,
  email text,
  grau_parentesco text not null check (grau_parentesco in ('mae', 'pai', 'avo', 'tio', 'outro')),
  created_at timestamp with time zone default now()
);

create index idx_responsaveis_paciente on public.responsaveis(paciente_id);

-- ============================================================
-- 6. TABELA: consentimentos (LGPD)
-- ============================================================

create table public.consentimentos (
  id uuid primary key default uuid_generate_v4(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  responsavel_id uuid references public.responsaveis(id) on delete set null,
  tipo text not null check (tipo in ('lgpd_geral', 'lgpd_menor', 'tratamento_dados', 'comunicacao_email')),
  aceite boolean not null default false,
  texto_aceito text not null,
  ip_address text,
  user_agent text,
  data_aceite timestamp with time zone default now()
);

create index idx_consentimentos_paciente on public.consentimentos(paciente_id);

-- ============================================================
-- 7. TABELA: procedimentos (tipos de atendimento)
-- ============================================================

create table public.procedimentos (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profissional_id uuid references public.profissionais(id) on delete cascade,
  nome text not null,
  duracao_min integer not null default 30,
  valor decimal(10,2),
  ativo boolean not null default true,
  created_at timestamp with time zone default now()
);

create index idx_procedimentos_tenant on public.procedimentos(tenant_id);

-- ============================================================
-- 8. TABELA: agendamentos
-- ============================================================

create table public.agendamentos (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profissional_id uuid not null references public.profissionais(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  procedimento_id uuid references public.procedimentos(id) on delete set null,
  data_hora timestamp with time zone not null,
  duracao_min integer not null default 30,
  status text not null default 'agendado' check (status in ('agendado', 'confirmado', 'em_atendimento', 'concluido', 'faltou', 'cancelado')),
  tolerancia_min integer not null default 5,
  observacoes text,
  cancelado_por text check (cancelado_por in ('profissional', 'paciente', null)),
  motivo_cancelamento text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index idx_agendamentos_tenant on public.agendamentos(tenant_id);
create index idx_agendamentos_profissional_data on public.agendamentos(profissional_id, data_hora);
create index idx_agendamentos_paciente on public.agendamentos(paciente_id);
create index idx_agendamentos_status on public.agendamentos(status);
create index idx_agendamentos_data on public.agendamentos(data_hora);

-- ============================================================
-- 9. TABELA: templates_anamnese
-- ============================================================

create table public.templates_anamnese (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profissional_id uuid not null references public.profissionais(id) on delete cascade,
  nome text not null,
  especialidade text not null,
  campos jsonb not null default '[]'::jsonb,
  padrao boolean not null default false,
  ativo boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Estrutura do campo em campos (jsonb array):
-- {
--   "id": "uuid",
--   "label": "Queixa principal",
--   "tipo": "texto_livre" | "selecao_multipla" | "sim_nao" | "escala_numerica" | "data" | "upload_foto",
--   "obrigatorio": true/false,
--   "opcoes": ["opcao1", "opcao2"],  -- para selecao_multipla
--   "min": 0, "max": 10,             -- para escala_numerica
--   "ordem": 1
-- }

create index idx_templates_profissional on public.templates_anamnese(profissional_id);
create index idx_templates_especialidade on public.templates_anamnese(especialidade);

-- ============================================================
-- 10. TABELA: anamneses
-- ============================================================

create table public.anamneses (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  profissional_id uuid not null references public.profissionais(id) on delete cascade,
  agendamento_id uuid references public.agendamentos(id) on delete set null,
  template_id uuid references public.templates_anamnese(id) on delete set null,
  dados jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index idx_anamneses_paciente on public.anamneses(paciente_id);
create index idx_anamneses_profissional on public.anamneses(profissional_id);

-- ============================================================
-- 11. TABELA: evolucoes (registros clinicos por consulta)
-- ============================================================

create table public.evolucoes (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  anamnese_id uuid references public.anamneses(id) on delete set null,
  agendamento_id uuid references public.agendamentos(id) on delete set null,
  profissional_id uuid not null references public.profissionais(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  texto text,
  audio_url text,
  transcricao text,
  receita text,
  diagnostico text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index idx_evolucoes_paciente on public.evolucoes(paciente_id);
create index idx_evolucoes_agendamento on public.evolucoes(agendamento_id);

-- ============================================================
-- 12. TABELA: financeiro
-- ============================================================

create table public.financeiro (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  agendamento_id uuid references public.agendamentos(id) on delete set null,
  paciente_id uuid references public.pacientes(id) on delete set null,
  profissional_id uuid references public.profissionais(id) on delete set null,
  tipo text not null check (tipo in ('receita', 'despesa')),
  descricao text not null,
  valor decimal(10,2) not null,
  forma_pagamento text check (forma_pagamento in ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'convenio', 'transferencia', 'outro')),
  data_lancamento date not null default current_date,
  data_pagamento date,
  pago boolean not null default false,
  categoria text,
  observacoes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index idx_financeiro_tenant on public.financeiro(tenant_id);
create index idx_financeiro_data on public.financeiro(tenant_id, data_lancamento);
create index idx_financeiro_tipo on public.financeiro(tenant_id, tipo);

-- ============================================================
-- 13. TABELA: notificacoes
-- ============================================================

create table public.notificacoes (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  agendamento_id uuid references public.agendamentos(id) on delete cascade,
  tipo text not null check (tipo in ('confirmacao', 'lembrete_24h', 'cancelamento', 'feedback', 'boas_vindas')),
  canal text not null default 'email' check (canal in ('email', 'sms')),
  destino text not null,
  assunto text,
  conteudo text,
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'falhou', 'aberto')),
  enviado_em timestamp with time zone,
  erro text,
  created_at timestamp with time zone default now()
);

create index idx_notificacoes_agendamento on public.notificacoes(agendamento_id);
create index idx_notificacoes_status on public.notificacoes(status);

-- ============================================================
-- 14. TABELA: audit_log (LGPD: quem acessou o que e quando)
-- ============================================================

create table public.audit_log (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null,
  acao text not null,
  tabela text not null,
  registro_id uuid,
  dados_anteriores jsonb,
  dados_novos jsonb,
  ip_address text,
  created_at timestamp with time zone default now()
);

create index idx_audit_tenant on public.audit_log(tenant_id);
create index idx_audit_user on public.audit_log(user_id);
create index idx_audit_created on public.audit_log(created_at);

-- ============================================================
-- 15. TABELA: lista_espera
-- ============================================================

create table public.lista_espera (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profissional_id uuid not null references public.profissionais(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  procedimento_id uuid references public.procedimentos(id) on delete set null,
  data_preferencia date,
  turno_preferencia text check (turno_preferencia in ('manha', 'tarde', 'qualquer')),
  observacoes text,
  status text not null default 'aguardando' check (status in ('aguardando', 'agendado', 'cancelado')),
  created_at timestamp with time zone default now()
);

create index idx_lista_espera_profissional on public.lista_espera(profissional_id);

-- ============================================================
-- 16. FUNCOES UTILITARIAS
-- ============================================================

-- Funcao: calcular idade a partir da data de nascimento
create or replace function public.calcular_idade(data_nasc date)
returns integer as $$
begin
  return extract(year from age(current_date, data_nasc))::integer;
end;
$$ language plpgsql immutable;

-- Funcao: verificar se paciente e menor de idade
create or replace function public.eh_menor_idade(data_nasc date)
returns boolean as $$
begin
  return public.calcular_idade(data_nasc) < 18;
end;
$$ language plpgsql immutable;

-- Funcao: obter tenant_id do usuario autenticado
create or replace function public.get_user_tenant_id()
returns uuid as $$
begin
  return (
    select tenant_id from public.profissionais
    where user_id = auth.uid()
    limit 1
  );
end;
$$ language plpgsql security definer stable;

-- Funcao: atualizar updated_at automaticamente
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- 17. TRIGGERS DE UPDATED_AT
-- ============================================================

create trigger set_updated_at before update on public.tenants
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.profissionais
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.pacientes
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.agendamentos
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.templates_anamnese
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.anamneses
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.evolucoes
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.financeiro
  for each row execute function public.handle_updated_at();

-- Trigger: setar menor_idade automaticamente no paciente
create or replace function public.handle_menor_idade()
returns trigger as $$
begin
  new.menor_idade = public.eh_menor_idade(new.data_nascimento);
  return new;
end;
$$ language plpgsql;

create trigger set_menor_idade before insert or update of data_nascimento on public.pacientes
  for each row execute function public.handle_menor_idade();

-- ============================================================
-- 18. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Habilitar RLS em todas as tabelas
alter table public.tenants enable row level security;
alter table public.profissionais enable row level security;
alter table public.horarios_disponiveis enable row level security;
alter table public.pacientes enable row level security;
alter table public.responsaveis enable row level security;
alter table public.consentimentos enable row level security;
alter table public.procedimentos enable row level security;
alter table public.agendamentos enable row level security;
alter table public.templates_anamnese enable row level security;
alter table public.anamneses enable row level security;
alter table public.evolucoes enable row level security;
alter table public.financeiro enable row level security;
alter table public.notificacoes enable row level security;
alter table public.audit_log enable row level security;
alter table public.lista_espera enable row level security;

-- Policies: cada usuario so ve dados do seu tenant

-- TENANTS
create policy "Usuarios veem seu proprio tenant"
  on public.tenants for select
  using (id = public.get_user_tenant_id());

create policy "Admin pode atualizar tenant"
  on public.tenants for update
  using (id = public.get_user_tenant_id());

-- PROFISSIONAIS
-- Policy que permite ao usuario ver o proprio registro.
-- Necessaria pois get_user_tenant_id() consulta a propria tabela profissionais,
-- causando recursao circular sob RLS na primeira leitura (logo apos onboarding).
create policy "Usuario ve proprio profissional"
  on public.profissionais for select
  using (user_id = auth.uid());

create policy "Profissionais do mesmo tenant"
  on public.profissionais for select
  using (tenant_id = public.get_user_tenant_id());

create policy "Admin insere profissionais"
  on public.profissionais for insert
  with check (tenant_id = public.get_user_tenant_id());

create policy "Admin atualiza profissionais"
  on public.profissionais for update
  using (tenant_id = public.get_user_tenant_id());

-- HORARIOS DISPONIVEIS
create policy "Horarios do mesmo tenant"
  on public.horarios_disponiveis for all
  using (
    profissional_id in (
      select id from public.profissionais where tenant_id = public.get_user_tenant_id()
    )
  );

-- PACIENTES
create policy "Pacientes do mesmo tenant"
  on public.pacientes for select
  using (tenant_id = public.get_user_tenant_id());

create policy "Inserir pacientes no tenant"
  on public.pacientes for insert
  with check (tenant_id = public.get_user_tenant_id());

create policy "Atualizar pacientes do tenant"
  on public.pacientes for update
  using (tenant_id = public.get_user_tenant_id());

-- RESPONSAVEIS
create policy "Responsaveis do mesmo tenant"
  on public.responsaveis for all
  using (
    paciente_id in (
      select id from public.pacientes where tenant_id = public.get_user_tenant_id()
    )
  );

-- CONSENTIMENTOS
create policy "Consentimentos do mesmo tenant"
  on public.consentimentos for all
  using (
    paciente_id in (
      select id from public.pacientes where tenant_id = public.get_user_tenant_id()
    )
  );

-- PROCEDIMENTOS
create policy "Procedimentos do mesmo tenant"
  on public.procedimentos for all
  using (tenant_id = public.get_user_tenant_id());

-- AGENDAMENTOS
create policy "Agendamentos do mesmo tenant"
  on public.agendamentos for select
  using (tenant_id = public.get_user_tenant_id());

create policy "Inserir agendamentos no tenant"
  on public.agendamentos for insert
  with check (tenant_id = public.get_user_tenant_id());

create policy "Atualizar agendamentos do tenant"
  on public.agendamentos for update
  using (tenant_id = public.get_user_tenant_id());

create policy "Deletar agendamentos do tenant"
  on public.agendamentos for delete
  using (tenant_id = public.get_user_tenant_id());

-- TEMPLATES ANAMNESE
create policy "Templates do mesmo tenant"
  on public.templates_anamnese for all
  using (tenant_id = public.get_user_tenant_id());

-- ANAMNESES
create policy "Anamneses do mesmo tenant"
  on public.anamneses for all
  using (tenant_id = public.get_user_tenant_id());

-- EVOLUCOES
create policy "Evolucoes do mesmo tenant"
  on public.evolucoes for all
  using (tenant_id = public.get_user_tenant_id());

-- FINANCEIRO
create policy "Financeiro do mesmo tenant"
  on public.financeiro for all
  using (tenant_id = public.get_user_tenant_id());

-- NOTIFICACOES
create policy "Notificacoes do mesmo tenant"
  on public.notificacoes for all
  using (tenant_id = public.get_user_tenant_id());

-- AUDIT LOG
create policy "Audit do mesmo tenant"
  on public.audit_log for select
  using (tenant_id = public.get_user_tenant_id());

create policy "Inserir audit no tenant"
  on public.audit_log for insert
  with check (tenant_id = public.get_user_tenant_id());

-- LISTA DE ESPERA
create policy "Lista espera do mesmo tenant"
  on public.lista_espera for all
  using (tenant_id = public.get_user_tenant_id());

-- ============================================================
-- 19. POLICY ESPECIAL: Paciente acessa sua propria ficha
--     (para o link de agendamento online)
-- ============================================================

-- Paciente anonimo pode inserir seus dados via agendamento online
-- Isso sera tratado via Supabase Edge Function com service_role key
-- para bypass do RLS quando necessario (cadastro do paciente pelo link publico)

-- ============================================================
-- 20. STORAGE BUCKETS (executar via Supabase Dashboard ou API)
-- ============================================================

-- Bucket: documentos-pacientes (fotos, laudos, exames)
-- Bucket: audios-evolucoes (gravacoes de audio para transcricao)
-- Bucket: avatares (fotos de perfil dos profissionais)
-- Configurar via Dashboard > Storage > New Bucket
-- Policies: apenas usuarios do mesmo tenant podem ler/escrever

-- ============================================================
-- FIM DO SCHEMA
-- ============================================================
