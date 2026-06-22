ALTER TABLE public.restaurant_settings
  ADD COLUMN IF NOT EXISTS limite_virada_caixa time NOT NULL DEFAULT '05:00',
  ADD COLUMN IF NOT EXISTS aviso_titulo text,
  ADD COLUMN IF NOT EXISTS aviso_mensagem text,
  ADD COLUMN IF NOT EXISTS aviso_link text,
  ADD COLUMN IF NOT EXISTS aviso_ativo boolean NOT NULL DEFAULT false;

ALTER TABLE public.cash_registers
  ADD COLUMN IF NOT EXISTS fechado_automaticamente boolean NOT NULL DEFAULT false;

ALTER TABLE public.cash_registers REPLICA IDENTITY FULL;

-- Ensure cash_registers is in the realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'cash_registers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_registers;
  END IF;
END $$;