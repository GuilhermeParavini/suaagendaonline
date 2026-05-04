-- ============================================================
-- Adiciona coluna logo_url em profissionais
-- Execute uma vez no SQL Editor do Supabase.
-- ============================================================
ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS logo_url text;
