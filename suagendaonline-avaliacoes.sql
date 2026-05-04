-- ============================================================
-- Avaliacoes do profissional pelo paciente
-- + flag enviar_avaliacao em profissionais
-- ============================================================

CREATE TABLE IF NOT EXISTS public.avaliacoes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agendamento_id uuid NOT NULL UNIQUE REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  paciente_id uuid REFERENCES public.pacientes(id) ON DELETE SET NULL,
  profissional_id uuid REFERENCES public.profissionais(id) ON DELETE SET NULL,
  nota integer NOT NULL CHECK (nota BETWEEN 1 AND 5),
  gostou text,
  melhorar text,
  recomendaria boolean,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_avaliacoes_tenant
  ON public.avaliacoes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_profissional
  ON public.avaliacoes(profissional_id, created_at DESC);

ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS avaliacoes_tenant ON public.avaliacoes;
CREATE POLICY avaliacoes_tenant ON public.avaliacoes
  FOR ALL
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

GRANT ALL ON public.avaliacoes TO service_role;

-- ============================================================
-- Flag enviar_avaliacao em profissionais
-- ============================================================
ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS enviar_avaliacao boolean DEFAULT true;
