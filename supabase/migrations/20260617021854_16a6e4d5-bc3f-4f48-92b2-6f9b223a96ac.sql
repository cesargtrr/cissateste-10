-- FASE 11: Shifts + Goals for delivery drivers
CREATE TABLE public.driver_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.delivery_drivers(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_driver_shifts_driver ON public.driver_shifts(driver_id, started_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_shifts TO authenticated;
GRANT ALL ON public.driver_shifts TO service_role;
ALTER TABLE public.driver_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers manage own shifts" ON public.driver_shifts
  FOR ALL TO authenticated
  USING (driver_id = public.get_driver_id_for_user(auth.uid()))
  WITH CHECK (driver_id = public.get_driver_id_for_user(auth.uid()));

CREATE POLICY "Admins view all shifts" ON public.driver_shifts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_driver_shifts_updated
  BEFORE UPDATE ON public.driver_shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Goals
CREATE TABLE public.driver_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.delivery_drivers(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  period text NOT NULL CHECK (period IN ('day','week','month')),
  target integer NOT NULL CHECK (target > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_id, period)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_goals TO authenticated;
GRANT ALL ON public.driver_goals TO service_role;
ALTER TABLE public.driver_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers manage own goals" ON public.driver_goals
  FOR ALL TO authenticated
  USING (driver_id = public.get_driver_id_for_user(auth.uid()))
  WITH CHECK (driver_id = public.get_driver_id_for_user(auth.uid()));

CREATE POLICY "Admins view all goals" ON public.driver_goals
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_driver_goals_updated
  BEFORE UPDATE ON public.driver_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();