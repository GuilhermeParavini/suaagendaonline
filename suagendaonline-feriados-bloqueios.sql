-- ============================================================
-- SUA AGENDA ONLINE - Tabelas feriados e bloqueios + seed
-- Execute este script no SQL Editor do Supabase.
-- Idempotente: pode ser executado mais de uma vez sem efeitos
-- colaterais (usa IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- ============================================================

-- 1. EXTENSOES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 2. TABELA: feriados
--    tenant_id = NULL  -> feriado nacional (visivel a todos)
--    tenant_id = uuid  -> feriado especifico do tenant
-- ============================================================
CREATE TABLE IF NOT EXISTS public.feriados (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  data date NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'nacional'
    CHECK (tipo IN ('nacional', 'municipal', 'custom')),
  recorrente boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_feriados_tenant_data
  ON public.feriados(tenant_id, data);
CREATE INDEX IF NOT EXISTS idx_feriados_data
  ON public.feriados(data);

-- Evita duplicar nacionais (tenant_id IS NULL) por data + tipo
CREATE UNIQUE INDEX IF NOT EXISTS idx_feriados_nacional_data
  ON public.feriados(data) WHERE tenant_id IS NULL AND tipo = 'nacional';

-- RLS
ALTER TABLE public.feriados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feriados_leitura ON public.feriados;
CREATE POLICY feriados_leitura ON public.feriados
  FOR SELECT
  USING (
    tenant_id IS NULL
    OR tenant_id = public.get_user_tenant_id()
  );

DROP POLICY IF EXISTS feriados_insercao ON public.feriados;
CREATE POLICY feriados_insercao ON public.feriados
  FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS feriados_atualizacao ON public.feriados;
CREATE POLICY feriados_atualizacao ON public.feriados
  FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS feriados_remocao ON public.feriados;
CREATE POLICY feriados_remocao ON public.feriados
  FOR DELETE
  USING (tenant_id = public.get_user_tenant_id());

GRANT ALL ON public.feriados TO service_role;

-- ============================================================
-- 3. TABELA: bloqueios
--    Periodos em que o profissional nao atende (ferias, folga,
--    feriado especifico do profissional).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bloqueios (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  profissional_id uuid NOT NULL REFERENCES public.profissionais(id) ON DELETE CASCADE,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  motivo text,
  tipo text NOT NULL DEFAULT 'ferias'
    CHECK (tipo IN ('ferias', 'folga', 'feriado', 'outro')),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT bloqueios_periodo_valido CHECK (data_fim >= data_inicio)
);

CREATE INDEX IF NOT EXISTS idx_bloqueios_profissional_periodo
  ON public.bloqueios(profissional_id, data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_bloqueios_tenant
  ON public.bloqueios(tenant_id);

-- RLS
ALTER TABLE public.bloqueios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bloqueios_tenant ON public.bloqueios;
CREATE POLICY bloqueios_tenant ON public.bloqueios
  FOR ALL
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

GRANT ALL ON public.bloqueios TO service_role;

-- ============================================================
-- 4. SEED: feriados nacionais 2026 e 2027
--    Inseridos com tenant_id = NULL (visiveis a todos os tenants).
--    ON CONFLICT DO NOTHING evita duplicidade.
-- ============================================================
INSERT INTO public.feriados (tenant_id, data, nome, tipo, recorrente) VALUES
  -- 2026
  (NULL, '2026-01-01', 'Confraternizacao Universal', 'nacional', true),
  (NULL, '2026-02-16', 'Carnaval', 'nacional', false),
  (NULL, '2026-02-17', 'Carnaval', 'nacional', false),
  (NULL, '2026-04-03', 'Sexta-feira Santa', 'nacional', false),
  (NULL, '2026-04-21', 'Tiradentes', 'nacional', true),
  (NULL, '2026-05-01', 'Dia do Trabalho', 'nacional', true),
  (NULL, '2026-06-04', 'Corpus Christi', 'nacional', false),
  (NULL, '2026-09-07', 'Independencia do Brasil', 'nacional', true),
  (NULL, '2026-10-12', 'Nossa Senhora Aparecida', 'nacional', true),
  (NULL, '2026-11-02', 'Finados', 'nacional', true),
  (NULL, '2026-11-15', 'Proclamacao da Republica', 'nacional', true),
  (NULL, '2026-11-20', 'Consciencia Negra', 'nacional', true),
  (NULL, '2026-12-25', 'Natal', 'nacional', true),
  -- 2027
  (NULL, '2027-01-01', 'Confraternizacao Universal', 'nacional', true),
  (NULL, '2027-02-08', 'Carnaval', 'nacional', false),
  (NULL, '2027-02-09', 'Carnaval', 'nacional', false),
  (NULL, '2027-03-26', 'Sexta-feira Santa', 'nacional', false),
  (NULL, '2027-04-21', 'Tiradentes', 'nacional', true),
  (NULL, '2027-05-01', 'Dia do Trabalho', 'nacional', true),
  (NULL, '2027-05-27', 'Corpus Christi', 'nacional', false),
  (NULL, '2027-09-07', 'Independencia do Brasil', 'nacional', true),
  (NULL, '2027-10-12', 'Nossa Senhora Aparecida', 'nacional', true),
  (NULL, '2027-11-02', 'Finados', 'nacional', true),
  (NULL, '2027-11-15', 'Proclamacao da Republica', 'nacional', true),
  (NULL, '2027-11-20', 'Consciencia Negra', 'nacional', true),
  (NULL, '2027-12-25', 'Natal', 'nacional', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- VERIFICACAO (opcional)
-- SELECT data, nome FROM public.feriados WHERE tenant_id IS NULL ORDER BY data;
-- SELECT * FROM public.bloqueios;
-- ============================================================
