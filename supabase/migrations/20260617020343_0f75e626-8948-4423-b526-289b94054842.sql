CREATE TABLE IF NOT EXISTS public.driver_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.delivery_drivers(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL,
  current_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy double precision,
  speed double precision,
  heading double precision,
  is_online boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_locations TO authenticated;
GRANT SELECT ON public.driver_locations TO anon;
GRANT ALL ON public.driver_locations TO service_role;

ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_driver_locations_restaurant_id ON public.driver_locations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_id ON public.driver_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_current_order_id ON public.driver_locations(current_order_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_updated_at ON public.driver_locations(updated_at DESC);

CREATE POLICY "Admins view driver locations by restaurant"
  ON public.driver_locations
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM public.delivery_drivers dd
      WHERE dd.id = driver_locations.driver_id
        AND dd.restaurant_id = driver_locations.restaurant_id
    )
  );

CREATE POLICY "Drivers view own location"
  ON public.driver_locations
  FOR SELECT
  TO authenticated
  USING (driver_id = public.get_driver_id_for_user(auth.uid()));

CREATE POLICY "Drivers insert own location"
  ON public.driver_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    driver_id = public.get_driver_id_for_user(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.delivery_drivers dd
      WHERE dd.id = driver_locations.driver_id
        AND dd.restaurant_id = driver_locations.restaurant_id
    )
    AND (
      current_order_id IS NULL OR EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = current_order_id
          AND o.delivery_driver_id = driver_locations.driver_id
          AND o.delivery_status IN ('em_entrega', 'saiu_para_entrega')
      )
    )
  );

CREATE POLICY "Drivers update own location"
  ON public.driver_locations
  FOR UPDATE
  TO authenticated
  USING (driver_id = public.get_driver_id_for_user(auth.uid()))
  WITH CHECK (
    driver_id = public.get_driver_id_for_user(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.delivery_drivers dd
      WHERE dd.id = driver_locations.driver_id
        AND dd.restaurant_id = driver_locations.restaurant_id
    )
    AND (
      current_order_id IS NULL OR EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = current_order_id
          AND o.delivery_driver_id = driver_locations.driver_id
          AND o.delivery_status IN ('em_entrega', 'saiu_para_entrega')
      )
    )
  );

CREATE POLICY "Customers view location for their order"
  ON public.driver_locations
  FOR SELECT
  TO anon, authenticated
  USING (
    current_order_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = driver_locations.current_order_id
        AND o.delivery_driver_id = driver_locations.driver_id
        AND o.delivery_status IN ('em_entrega', 'saiu_para_entrega')
    )
  );

CREATE TRIGGER update_driver_locations_updated_at
  BEFORE UPDATE ON public.driver_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.driver_route_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.delivery_drivers(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  origin jsonb,
  destination jsonb,
  duration_seconds integer,
  distance_meters double precision,
  route_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_route_history TO authenticated;
GRANT ALL ON public.driver_route_history TO service_role;

ALTER TABLE public.driver_route_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_driver_route_history_restaurant_id ON public.driver_route_history(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_driver_route_history_driver_date ON public.driver_route_history(driver_id, route_date DESC);
CREATE INDEX IF NOT EXISTS idx_driver_route_history_order_id ON public.driver_route_history(order_id);

CREATE POLICY "Admins manage route history by restaurant"
  ON public.driver_route_history
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM public.delivery_drivers dd
      WHERE dd.id = driver_route_history.driver_id
        AND dd.restaurant_id = driver_route_history.restaurant_id
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM public.delivery_drivers dd
      WHERE dd.id = driver_route_history.driver_id
        AND dd.restaurant_id = driver_route_history.restaurant_id
    )
  );

CREATE POLICY "Drivers view own route history"
  ON public.driver_route_history
  FOR SELECT
  TO authenticated
  USING (driver_id = public.get_driver_id_for_user(auth.uid()));

CREATE POLICY "Drivers insert own route history"
  ON public.driver_route_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    driver_id = public.get_driver_id_for_user(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.delivery_drivers dd
      WHERE dd.id = driver_route_history.driver_id
        AND dd.restaurant_id = driver_route_history.restaurant_id
    )
  );

CREATE TRIGGER update_driver_route_history_updated_at
  BEFORE UPDATE ON public.driver_route_history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_route_history;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.driver_locations REPLICA IDENTITY FULL;
ALTER TABLE public.driver_route_history REPLICA IDENTITY FULL;