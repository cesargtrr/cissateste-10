
CREATE TABLE public.delivery_neighborhoods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.delivery_neighborhoods TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_neighborhoods TO authenticated;
GRANT ALL ON public.delivery_neighborhoods TO service_role;

ALTER TABLE public.delivery_neighborhoods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view neighborhoods"
  ON public.delivery_neighborhoods FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert neighborhoods"
  ON public.delivery_neighborhoods FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update neighborhoods"
  ON public.delivery_neighborhoods FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete neighborhoods"
  ON public.delivery_neighborhoods FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_delivery_neighborhoods_updated_at
  BEFORE UPDATE ON public.delivery_neighborhoods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.restaurant_settings
  ADD COLUMN IF NOT EXISTS default_neighborhood_fee NUMERIC(10,2) NOT NULL DEFAULT 15;
