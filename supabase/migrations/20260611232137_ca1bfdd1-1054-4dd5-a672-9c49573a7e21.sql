ALTER TABLE public.restaurant_settings
ADD COLUMN IF NOT EXISTS limite_virada_caixa time NOT NULL DEFAULT '05:00';

ALTER TABLE public.cash_registers
ADD COLUMN IF NOT EXISTS business_date date NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS saldo_real numeric,
ADD COLUMN IF NOT EXISTS divergencia numeric,
ADD COLUMN IF NOT EXISTS observacao_divergencia text,
ADD COLUMN IF NOT EXISTS fundo_troco_deixado numeric,
ADD COLUMN IF NOT EXISTS closed_by_user_id uuid REFERENCES auth.users(id);

GRANT ALL ON public.cash_registers TO authenticated;
GRANT ALL ON public.cash_registers TO service_role;
GRANT ALL ON public.restaurant_settings TO authenticated;
GRANT ALL ON public.restaurant_settings TO service_role;