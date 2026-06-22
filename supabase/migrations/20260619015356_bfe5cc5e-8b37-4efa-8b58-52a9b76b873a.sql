-- Phase 16: enable drivers to claim unassigned delivery orders and recognize
-- drivers stored in delivery_drivers.user_id (Phase 15 unified auth).

-- 1) Make get_driver_id_for_user look in both the legacy mirror and the
--    canonical delivery_drivers.user_id column.
CREATE OR REPLACE FUNCTION public.get_driver_id_for_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT driver_id FROM (
    SELECT id AS driver_id, 1 AS priority
      FROM public.delivery_drivers
     WHERE user_id = _user_id AND active = true
    UNION ALL
    SELECT driver_id, 2 AS priority
      FROM public.delivery_driver_users
     WHERE user_id = _user_id AND active = true
  ) t
  ORDER BY priority
  LIMIT 1;
$$;

-- 2) Allow an authenticated driver to claim (assign themselves to) an order
--    that currently has no driver. The WITH CHECK guarantees they can only
--    write their own driver_id into the row.
DROP POLICY IF EXISTS "Driver claims unassigned orders" ON public.orders;
CREATE POLICY "Driver claims unassigned orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  delivery_driver_id IS NULL
  AND public.get_driver_id_for_user(auth.uid()) IS NOT NULL
)
WITH CHECK (
  delivery_driver_id = public.get_driver_id_for_user(auth.uid())
);