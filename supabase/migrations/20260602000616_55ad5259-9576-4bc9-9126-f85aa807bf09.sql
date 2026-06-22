ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS mesa_session text;
CREATE INDEX IF NOT EXISTS idx_orders_mesa_session ON public.orders(mesa_session) WHERE mesa_session IS NOT NULL;