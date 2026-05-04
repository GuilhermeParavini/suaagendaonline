-- ============================================================
-- Expande os tipos validos da tabela bloqueios
-- Inclui 'congresso' e 'licenca'.
-- ============================================================

ALTER TABLE public.bloqueios
  DROP CONSTRAINT IF EXISTS bloqueios_tipo_check;

ALTER TABLE public.bloqueios
  ADD CONSTRAINT bloqueios_tipo_check CHECK (
    tipo IN ('ferias', 'folga', 'congresso', 'licenca', 'feriado', 'outro')
  );
