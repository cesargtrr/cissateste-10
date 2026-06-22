GRANT SELECT ON public.driver_locations TO anon;

CREATE POLICY "Customers realtime active order driver locations"
  ON public.driver_locations
  FOR SELECT
  TO anon, authenticated
  USING (
    current_order_id IS NOT NULL
    AND is_online = true
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = driver_locations.current_order_id
        AND o.delivery_driver_id = driver_locations.driver_id
        AND o.delivery_status IN ('em_entrega', 'saiu_para_entrega')
    )
  );