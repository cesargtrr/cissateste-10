
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_driver_id uuid NULL
    REFERENCES public.delivery_drivers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_status text NULL;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_driver
  ON public.orders(delivery_driver_id)
  WHERE delivery_driver_id IS NOT NULL;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_delivery_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_delivery_status_check
  CHECK (delivery_status IS NULL OR delivery_status IN ('aguardando_entregador','em_entrega','entregue'));
