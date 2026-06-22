ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS permitir_observacao boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS placeholder_observacao text NOT NULL DEFAULT 'Alguma observação? (ex: tirar cebola, ponto da carne, etc.)';