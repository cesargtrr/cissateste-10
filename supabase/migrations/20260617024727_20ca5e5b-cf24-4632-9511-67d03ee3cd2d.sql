
-- 1) Table
CREATE TABLE public.driver_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  driver_id uuid NOT NULL REFERENCES public.delivery_drivers(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  delivery_fee numeric NOT NULL DEFAULT 0,
  bonus_amount numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  total_earned numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id)
);

CREATE INDEX idx_driver_earnings_driver ON public.driver_earnings(driver_id, created_at DESC);
CREATE INDEX idx_driver_earnings_restaurant ON public.driver_earnings(restaurant_id, created_at DESC);
CREATE INDEX idx_driver_earnings_status ON public.driver_earnings(status);

-- 2) Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_earnings TO authenticated;
GRANT ALL ON public.driver_earnings TO service_role;

-- 3) RLS
ALTER TABLE public.driver_earnings ENABLE ROW LEVEL SECURITY;

-- Driver sees only their own earnings
CREATE POLICY "Drivers view own earnings"
ON public.driver_earnings
FOR SELECT
TO authenticated
USING (
  driver_id = public.get_driver_id_for_user(auth.uid())
);

-- Admins of the restaurant manage earnings
CREATE POLICY "Admins manage restaurant earnings"
ON public.driver_earnings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Service role bypass via system triggers
CREATE POLICY "Service role full access"
ON public.driver_earnings
FOR ALL
TO service_role
USING (true) WITH CHECK (true);

-- 4) updated_at trigger
CREATE TRIGGER trg_driver_earnings_updated_at
BEFORE UPDATE ON public.driver_earnings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Auto-create earnings on delivery completion
CREATE OR REPLACE FUNCTION public.handle_driver_earnings_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
  v_fee numeric;
BEGIN
  IF NEW.delivery_status = 'delivered'
     AND (OLD.delivery_status IS DISTINCT FROM NEW.delivery_status)
     AND NEW.delivery_driver_id IS NOT NULL
  THEN
    SELECT restaurant_id INTO v_restaurant_id
    FROM public.delivery_drivers
    WHERE id = NEW.delivery_driver_id;

    v_fee := COALESCE(NEW.delivery_fee, 0);

    INSERT INTO public.driver_earnings (
      restaurant_id, driver_id, order_id,
      delivery_fee, bonus_amount, discount_amount, total_earned, status
    )
    VALUES (
      v_restaurant_id, NEW.delivery_driver_id, NEW.id,
      v_fee, 0, 0, v_fee, 'pending'
    )
    ON CONFLICT (order_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_driver_earnings_on_delivery
AFTER UPDATE OF delivery_status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_driver_earnings_on_delivery();

-- 6) Realtime
ALTER TABLE public.driver_earnings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_earnings;
