
-- 1) Expand delivery_status check to include the new vocabulary (keeping legacy values)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_delivery_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_delivery_status_check
  CHECK (
    delivery_status IS NULL OR delivery_status = ANY (ARRAY[
      'aguardando_entregador','em_entrega','entregue',
      'pedido_recebido','em_preparo','pronto_para_entrega','saiu_para_entrega'
    ])
  );

-- 2) order_status_history table
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_osh_order_id ON public.order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_osh_restaurant_id ON public.order_status_history(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_osh_created_at ON public.order_status_history(created_at DESC);

GRANT SELECT ON public.order_status_history TO authenticated;
GRANT ALL ON public.order_status_history TO service_role;
GRANT SELECT ON public.order_status_history TO anon;

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- Admins: full read
CREATE POLICY "Admins manage status history"
ON public.order_status_history FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Drivers: read history of their assigned orders
CREATE POLICY "Drivers read own assigned history"
ON public.order_status_history FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_status_history.order_id
      AND o.delivery_driver_id = public.get_driver_id_for_user(auth.uid())
  )
);

-- Public (anon): allow read for a specific order id (customer tracking by URL)
CREATE POLICY "Public read status history by order"
ON public.order_status_history FOR SELECT
TO anon
USING (true);

-- 3) Trigger to log delivery_status changes
CREATE OR REPLACE FUNCTION public.log_delivery_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
BEGIN
  IF NEW.delivery_status IS DISTINCT FROM OLD.delivery_status AND NEW.delivery_status IS NOT NULL THEN
    SELECT dd.restaurant_id INTO v_restaurant_id
    FROM public.delivery_drivers dd
    WHERE dd.id = NEW.delivery_driver_id
    LIMIT 1;

    INSERT INTO public.order_status_history (restaurant_id, order_id, status, changed_by)
    VALUES (v_restaurant_id, NEW.id, NEW.delivery_status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_delivery_status_change ON public.orders;
CREATE TRIGGER trg_log_delivery_status_change
AFTER UPDATE OF delivery_status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.log_delivery_status_change();

-- 4) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_status_history;
