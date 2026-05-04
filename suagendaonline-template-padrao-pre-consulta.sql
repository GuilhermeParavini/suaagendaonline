-- ============================================================
-- Adiciona coluna padrao_pre_consulta em templates_anamnese
-- Executar no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE public.templates_anamnese
  ADD COLUMN IF NOT EXISTS padrao_pre_consulta boolean NOT NULL DEFAULT false;

-- Garante que apenas um template por profissional seja padrao_pre_consulta
CREATE UNIQUE INDEX IF NOT EXISTS templates_anamnese_padrao_pre_consulta_uniq
  ON public.templates_anamnese (profissional_id)
  WHERE padrao_pre_consulta = true;
