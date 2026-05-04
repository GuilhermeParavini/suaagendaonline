-- ============================================================
-- SUA AGENDA ONLINE - Row Level Security (RLS) Policies
-- Supabase (PostgreSQL)
-- Versao 1.0 | Maio 2026 | AGPXL
-- ============================================================

-- Executar este script no SQL Editor do Supabase APÓS executar o schema.sql
-- Projeto: suagendaonline

-- ============================================================
-- 1. ATIVAR RLS NAS TABELAS
-- ============================================================

-- Já ativado no schema.sql, mas confirmando
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profissionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios_disponiveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responsaveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consentimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates_anamnese ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. POLÍTICAS PARA TENANTS
-- ============================================================

-- Profissionais podem ver apenas seu próprio tenant
CREATE POLICY "Profissionais podem ver seu tenant" ON public.tenants
  FOR SELECT USING (
    id IN (
      SELECT tenant_id FROM public.profissionais
      WHERE user_id = auth.uid()
    )
  );

-- Profissionais podem atualizar apenas seu próprio tenant
CREATE POLICY "Profissionais podem atualizar seu tenant" ON public.tenants
  FOR UPDATE USING (
    id IN (
      SELECT tenant_id FROM public.profissionais
      WHERE user_id = auth.uid()
    )
  );

-- Service role pode fazer tudo (para onboarding)
CREATE POLICY "Service role pode gerenciar tenants" ON public.tenants
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 3. POLÍTICAS PARA PROFISSIONAIS
-- ============================================================

-- Profissionais podem ver apenas seu próprio registro
CREATE POLICY "Profissionais podem ver seu registro" ON public.profissionais
  FOR SELECT USING (user_id = auth.uid());

-- Profissionais podem atualizar apenas seu próprio registro
CREATE POLICY "Profissionais podem atualizar seu registro" ON public.profissionais
  FOR UPDATE USING (user_id = auth.uid());

-- Service role pode fazer tudo (para onboarding)
CREATE POLICY "Service role pode gerenciar profissionais" ON public.profissionais
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 4. POLÍTICAS PARA HORARIOS_DISPONIVEIS
-- ============================================================

-- Profissionais podem ver apenas seus horários
CREATE POLICY "Profissionais podem ver seus horarios" ON public.horarios_disponiveis
  FOR SELECT USING (
    profissional_id IN (
      SELECT id FROM public.profissionais
      WHERE user_id = auth.uid()
    )
  );

-- Profissionais podem gerenciar apenas seus horários
CREATE POLICY "Profissionais podem gerenciar seus horarios" ON public.horarios_disponiveis
  FOR ALL USING (
    profissional_id IN (
      SELECT id FROM public.profissionais
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- 5. POLÍTICAS PARA PACIENTES
-- ============================================================

-- Profissionais podem ver apenas pacientes do seu tenant
CREATE POLICY "Profissionais podem ver pacientes do tenant" ON public.pacientes
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profissionais
      WHERE user_id = auth.uid()
    )
  );

-- Profissionais podem gerenciar apenas pacientes do seu tenant
CREATE POLICY "Profissionais podem gerenciar pacientes do tenant" ON public.pacientes
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profissionais
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- 6. POLÍTICAS PARA RESPONSÁVEIS
-- ============================================================

-- Profissionais podem ver apenas responsáveis de pacientes do seu tenant
CREATE POLICY "Profissionais podem ver responsaveis do tenant" ON public.responsaveis
  FOR SELECT USING (
    paciente_id IN (
      SELECT id FROM public.pacientes
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.profissionais
        WHERE user_id = auth.uid()
      )
    )
  );

-- Profissionais podem gerenciar apenas responsáveis de pacientes do seu tenant
CREATE POLICY "Profissionais podem gerenciar responsaveis do tenant" ON public.responsaveis
  FOR ALL USING (
    paciente_id IN (
      SELECT id FROM public.pacientes
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.profissionais
        WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- 7. POLÍTICAS PARA CONSENTIMENTOS
-- ============================================================

-- Profissionais podem ver apenas consentimentos de pacientes do seu tenant
CREATE POLICY "Profissionais podem ver consentimentos do tenant" ON public.consentimentos
  FOR SELECT USING (
    paciente_id IN (
      SELECT id FROM public.pacientes
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.profissionais
        WHERE user_id = auth.uid()
      )
    )
  );

-- Profissionais podem gerenciar apenas consentimentos de pacientes do seu tenant
CREATE POLICY "Profissionais podem gerenciar consentimentos do tenant" ON public.consentimentos
  FOR ALL USING (
    paciente_id IN (
      SELECT id FROM public.pacientes
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.profissionais
        WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- 8. POLÍTICAS PARA PROCEDIMENTOS
-- ============================================================

-- Profissionais podem ver apenas procedimentos do seu tenant
CREATE POLICY "Profissionais podem ver procedimentos do tenant" ON public.procedimentos
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profissionais
      WHERE user_id = auth.uid()
    )
  );

-- Profissionais podem gerenciar apenas procedimentos do seu tenant
CREATE POLICY "Profissionais podem gerenciar procedimentos do tenant" ON public.procedimentos
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profissionais
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- 9. POLÍTICAS PARA AGENDAMENTOS
-- ============================================================

-- Profissionais podem ver apenas agendamentos do seu tenant
CREATE POLICY "Profissionais podem ver agendamentos do tenant" ON public.agendamentos
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profissionais
      WHERE user_id = auth.uid()
    )
  );

-- Profissionais podem gerenciar apenas agendamentos do seu tenant
CREATE POLICY "Profissionais podem gerenciar agendamentos do tenant" ON public.agendamentos
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profissionais
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- 10. POLÍTICAS PARA TEMPLATES_ANAMNESE
-- ============================================================

-- Profissionais podem ver apenas templates do seu tenant
CREATE POLICY "Profissionais podem ver templates do tenant" ON public.templates_anamnese
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profissionais
      WHERE user_id = auth.uid()
    )
  );

-- Profissionais podem gerenciar apenas templates do seu tenant
CREATE POLICY "Profissionais podem gerenciar templates do tenant" ON public.templates_anamnese
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profissionais
      WHERE user_id = auth.uid()
    )
  );
