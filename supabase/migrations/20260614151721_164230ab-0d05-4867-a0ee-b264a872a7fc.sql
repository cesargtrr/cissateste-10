ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_completed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_completed_at
  ON public.orders (delivery_completed_at)
  WHERE delivery_completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_status
  ON public.orders (delivery_status)
  WHERE delivery_status IS NOT NULL;