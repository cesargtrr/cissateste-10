
-- Table for driver login accounts
CREATE TABLE public.delivery_driver_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  driver_id uuid NOT NULL REFERENCES public.delivery_drivers(id) ON DELETE CASCADE,
  email text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_id),
  UNIQUE (email)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_driver_users TO authenticated;
GRANT ALL ON public.delivery_driver_users TO service_role;

ALTER TABLE public.delivery_driver_users ENABLE ROW LEVEL SECURITY;

-- Admin manages all driver accounts
CREATE POLICY "Admins manage driver users"
  ON public.delivery_driver_users
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Driver can read their own row
CREATE POLICY "Drivers view own account"
  ON public.delivery_driver_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER update_delivery_driver_users_updated_at
  BEFORE UPDATE ON public.delivery_driver_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: get driver_id for the currently logged in driver user
CREATE OR REPLACE FUNCTION public.get_driver_id_for_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT driver_id
  FROM public.delivery_driver_users
  WHERE user_id = _user_id AND active = true
  LIMIT 1;
$$;

-- Allow driver to also see their own driver record (for profile display)
CREATE POLICY "Driver views own driver record"
  ON public.delivery_drivers
  FOR SELECT
  TO authenticated
  USING (id = public.get_driver_id_for_user(auth.uid()));

-- Allow driver to view orders assigned to them only
CREATE POLICY "Driver views own assigned orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    delivery_driver_id IS NOT NULL
    AND delivery_driver_id = public.get_driver_id_for_user(auth.uid())
  );

-- Allow driver to update delivery_status on their orders
CREATE POLICY "Driver updates own assigned orders"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    delivery_driver_id IS NOT NULL
    AND delivery_driver_id = public.get_driver_id_for_user(auth.uid())
  )
  WITH CHECK (
    delivery_driver_id IS NOT NULL
    AND delivery_driver_id = public.get_driver_id_for_user(auth.uid())
  );
