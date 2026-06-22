DROP POLICY IF EXISTS "Customers view location for their order" ON public.driver_locations;
REVOKE SELECT ON public.driver_locations FROM anon;

CREATE OR REPLACE FUNCTION public.get_driver_location_for_order(_order_id uuid)
RETURNS TABLE (
  id uuid,
  driver_id uuid,
  restaurant_id uuid,
  current_order_id uuid,
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  speed double precision,
  heading double precision,
  is_online boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dl.id, dl.driver_id, dl.restaurant_id, dl.current_order_id,
         dl.latitude, dl.longitude, dl.accuracy, dl.speed, dl.heading,
         dl.is_online, dl.created_at, dl.updated_at
  FROM public.driver_locations dl
  JOIN public.orders o
    ON o.id = _order_id
   AND o.delivery_driver_id = dl.driver_id
   AND dl.current_order_id = o.id
  WHERE o.delivery_status IN ('em_entrega', 'saiu_para_entrega')
    AND dl.is_online = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_driver_location_for_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_driver_location_for_order(uuid) TO anon, authenticated;