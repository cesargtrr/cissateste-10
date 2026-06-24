
-- 1. Trigger to force-sync orders.status from delivery_status changes.
CREATE OR REPLACE FUNCTION public.tg_sync_status_from_delivery_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.delivery_status IS DISTINCT FROM OLD.delivery_status THEN
    IF NEW.delivery_status = 'saiu_para_entrega'
       AND NEW.status NOT IN ('completed','cancelled','delivered') THEN
      NEW.status := 'delivered';
      IF NEW.delivery_started_at IS NULL THEN
        NEW.delivery_started_at := now();
      END IF;
    ELSIF NEW.delivery_status = 'entregue'
       AND NEW.status <> 'cancelled' THEN
      NEW.status := 'completed';
      IF NEW.delivery_completed_at IS NULL THEN
        NEW.delivery_completed_at := now();
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_status_from_delivery_status ON public.orders;
CREATE TRIGGER sync_status_from_delivery_status
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.tg_sync_status_from_delivery_status();

-- 2. Tighten the claim policy: drivers can only claim orders the kitchen
--    has released (delivery_status = 'pronto_para_entrega').
DROP POLICY IF EXISTS "Driver claims unassigned orders" ON public.orders;
CREATE POLICY "Driver claims unassigned orders"
ON public.orders
FOR UPDATE
USING (
  delivery_driver_id IS NULL
  AND get_driver_id_for_user(auth.uid()) IS NOT NULL
  AND delivery_status = 'pronto_para_entrega'
)
WITH CHECK (
  delivery_driver_id = get_driver_id_for_user(auth.uid())
);
