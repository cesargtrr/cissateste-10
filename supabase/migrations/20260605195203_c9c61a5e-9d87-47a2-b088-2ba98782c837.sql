
CREATE TABLE public.opening_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week smallint NOT NULL UNIQUE CHECK (day_of_week BETWEEN 0 AND 6),
  open_time time NOT NULL DEFAULT '18:00',
  close_time time NOT NULL DEFAULT '23:00',
  is_closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.opening_hours TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opening_hours TO authenticated;
GRANT ALL ON public.opening_hours TO service_role;

ALTER TABLE public.opening_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Opening hours viewable by everyone" ON public.opening_hours FOR SELECT USING (true);
CREATE POLICY "Admins manage opening hours" ON public.opening_hours FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER opening_hours_updated_at BEFORE UPDATE ON public.opening_hours
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- seed all 7 days with defaults
INSERT INTO public.opening_hours (day_of_week, open_time, close_time, is_closed)
SELECT d, '18:00'::time, '23:00'::time, false FROM generate_series(0,6) d
ON CONFLICT (day_of_week) DO NOTHING;

-- master force-close toggle
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS force_closed boolean NOT NULL DEFAULT false;
