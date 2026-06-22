ALTER TABLE public.restaurant_settings
  ADD COLUMN IF NOT EXISTS limite_virada_caixa time NOT NULL DEFAULT '05:00',
  ADD COLUMN IF NOT EXISTS aviso_titulo text,
  ADD COLUMN IF NOT EXISTS aviso_mensagem text,
  ADD COLUMN IF NOT EXISTS aviso_link text,
  ADD COLUMN IF NOT EXISTS aviso_ativo boolean NOT NULL DEFAULT false;

ALTER TABLE public.cash_registers
  ADD COLUMN IF NOT EXISTS fechado_automaticamente boolean NOT NULL DEFAULT false;

ALTER TABLE public.cash_registers REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_registers';
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;