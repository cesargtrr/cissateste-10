
ALTER TABLE public.delivery_drivers ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_delivery_drivers_user_id ON public.delivery_drivers(user_id);

DROP POLICY IF EXISTS "Drivers can view themselves" ON public.delivery_drivers;
CREATE POLICY "Drivers can view themselves"
ON public.delivery_drivers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
