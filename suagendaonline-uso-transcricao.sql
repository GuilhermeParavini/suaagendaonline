-- ============================================================
-- Tabela uso_transcricao
-- Controla minutos consumidos de transcricao de audio (Whisper)
-- por profissional/mes. Por enquanto so registra; bloqueio futuro.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.uso_transcricao (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  profissional_id uuid NOT NULL REFERENCES public.profissionais(id) ON DELETE CASCADE,
  mes_ano text NOT NULL,
  segundos_usados integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_uso_transcricao_mes
  ON public.uso_transcricao(profissional_id, mes_ano);

ALTER TABLE public.uso_transcricao ENABLE ROW LEVEL SECURITY;

CREATE POLICY uso_transcricao_tenant ON public.uso_transcricao
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

GRANT ALL ON public.uso_transcricao TO service_role;
