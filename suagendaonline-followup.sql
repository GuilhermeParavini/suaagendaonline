-- ============================================================
-- Acompanhamento pos-consulta
-- - Flags + mensagem personalizada em profissionais
-- - Expande tipos validos da tabela notificacoes
-- ============================================================

ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS enviar_followup boolean DEFAULT true;

ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS mostrar_acompanhamento boolean DEFAULT true;

ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS followup_mensagem text;

-- Permite tipos novos em notificacoes
ALTER TABLE public.notificacoes
  DROP CONSTRAINT IF EXISTS notificacoes_tipo_check;

ALTER TABLE public.notificacoes
  ADD CONSTRAINT notificacoes_tipo_check CHECK (
    tipo IN (
      'confirmacao',
      'lembrete_24h',
      'cancelamento',
      'feedback',
      'boas_vindas',
      'followup',
      'followup_whatsapp'
    )
  );
