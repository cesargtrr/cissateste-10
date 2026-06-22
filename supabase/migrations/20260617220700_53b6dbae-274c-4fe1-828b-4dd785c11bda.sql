
-- =====================================================================
-- FASE 14 — Jornada, notificações, auditoria, hardening GPS
-- Tudo isolado em tabelas novas. Não altera tabelas existentes.
-- =====================================================================

-- ---------- ENUMS ----------
DO $$ BEGIN
  CREATE TYPE public.driver_break_reason AS ENUM ('meal','rest','personal','vehicle','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.driver_notification_kind AS ENUM
    ('new_delivery','reassigned','delay_alert','inactivity','shift_reminder','customer_message');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.driver_event_kind AS ENUM
    ('login','clock_in','clock_out','break_start','break_end',
     'delivery_accepted','delivery_rejected','location_update_rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================
-- driver_breaks
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.driver_breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.driver_shifts(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.delivery_drivers(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  reason public.driver_break_reason NOT NULL DEFAULT 'rest',
  notes text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_breaks TO authenticated;
GRANT ALL ON public.driver_breaks TO service_role;

ALTER TABLE public.driver_breaks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_driver_breaks_shift ON public.driver_breaks(shift_id);
CREATE INDEX IF NOT EXISTS idx_driver_breaks_driver ON public.driver_breaks(driver_id, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_driver_breaks_one_open_per_shift
  ON public.driver_breaks(shift_id) WHERE ended_at IS NULL;

DROP POLICY IF EXISTS "Drivers manage own breaks" ON public.driver_breaks;
CREATE POLICY "Drivers manage own breaks" ON public.driver_breaks
  FOR ALL TO authenticated
  USING (driver_id = public.get_driver_id_for_user(auth.uid()))
  WITH CHECK (driver_id = public.get_driver_id_for_user(auth.uid()));

DROP POLICY IF EXISTS "Admins view breaks by restaurant" ON public.driver_breaks;
CREATE POLICY "Admins view breaks by restaurant" ON public.driver_breaks
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_driver_breaks_updated ON public.driver_breaks;
CREATE TRIGGER trg_driver_breaks_updated BEFORE UPDATE ON public.driver_breaks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- driver_schedules
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.driver_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.delivery_drivers(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_id, weekday)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_schedules TO authenticated;
GRANT ALL ON public.driver_schedules TO service_role;

ALTER TABLE public.driver_schedules ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_driver_schedules_driver ON public.driver_schedules(driver_id);

DROP POLICY IF EXISTS "Drivers view own schedule" ON public.driver_schedules;
CREATE POLICY "Drivers view own schedule" ON public.driver_schedules
  FOR SELECT TO authenticated
  USING (driver_id = public.get_driver_id_for_user(auth.uid()));

DROP POLICY IF EXISTS "Admins manage schedules" ON public.driver_schedules;
CREATE POLICY "Admins manage schedules" ON public.driver_schedules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_driver_schedules_updated ON public.driver_schedules;
CREATE TRIGGER trg_driver_schedules_updated BEFORE UPDATE ON public.driver_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- driver_notifications
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.driver_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.delivery_drivers(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  kind public.driver_notification_kind NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb,
  dedupe_key text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_id, dedupe_key)
);

GRANT SELECT, INSERT, UPDATE ON public.driver_notifications TO authenticated;
GRANT ALL ON public.driver_notifications TO service_role;

ALTER TABLE public.driver_notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_driver_notifications_driver_created
  ON public.driver_notifications(driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_notifications_unread
  ON public.driver_notifications(driver_id) WHERE read_at IS NULL;

DROP POLICY IF EXISTS "Drivers view own notifications" ON public.driver_notifications;
CREATE POLICY "Drivers view own notifications" ON public.driver_notifications
  FOR SELECT TO authenticated
  USING (driver_id = public.get_driver_id_for_user(auth.uid()));

DROP POLICY IF EXISTS "Drivers mark own notifications read" ON public.driver_notifications;
CREATE POLICY "Drivers mark own notifications read" ON public.driver_notifications
  FOR UPDATE TO authenticated
  USING (driver_id = public.get_driver_id_for_user(auth.uid()))
  WITH CHECK (driver_id = public.get_driver_id_for_user(auth.uid()));

DROP POLICY IF EXISTS "Admins manage driver notifications" ON public.driver_notifications;
CREATE POLICY "Admins manage driver notifications" ON public.driver_notifications
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =====================================================================
-- driver_event_logs
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.driver_event_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES public.delivery_drivers(id) ON DELETE SET NULL,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  actor_user_id uuid,
  event public.driver_event_kind NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.driver_event_logs TO authenticated;
GRANT ALL ON public.driver_event_logs TO service_role;

ALTER TABLE public.driver_event_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_driver_event_logs_driver
  ON public.driver_event_logs(driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_event_logs_restaurant
  ON public.driver_event_logs(restaurant_id, created_at DESC);

DROP POLICY IF EXISTS "Drivers view own events" ON public.driver_event_logs;
CREATE POLICY "Drivers view own events" ON public.driver_event_logs
  FOR SELECT TO authenticated
  USING (driver_id = public.get_driver_id_for_user(auth.uid()));

DROP POLICY IF EXISTS "Drivers insert own events" ON public.driver_event_logs;
CREATE POLICY "Drivers insert own events" ON public.driver_event_logs
  FOR INSERT TO authenticated
  WITH CHECK (driver_id = public.get_driver_id_for_user(auth.uid()));

DROP POLICY IF EXISTS "Admins view all events" ON public.driver_event_logs;
CREATE POLICY "Admins view all events" ON public.driver_event_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================================
-- Utility: get_active_shift
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_active_shift(_driver_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.driver_shifts
  WHERE driver_id = _driver_id AND ended_at IS NULL
  ORDER BY started_at DESC
  LIMIT 1;
$$;

-- =====================================================================
-- Trigger: block break without active shift; close on ended_at
-- =====================================================================
CREATE OR REPLACE FUNCTION public.tg_validate_driver_break()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_active uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT id INTO v_active FROM public.driver_shifts
      WHERE id = NEW.shift_id AND driver_id = NEW.driver_id AND ended_at IS NULL;
    IF v_active IS NULL THEN
      RAISE EXCEPTION 'Cannot start break: no active shift for driver';
    END IF;
  END IF;

  IF NEW.ended_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
    NEW.duration_seconds := GREATEST(0, EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::int);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_driver_breaks_validate ON public.driver_breaks;
CREATE TRIGGER trg_driver_breaks_validate
  BEFORE INSERT OR UPDATE ON public.driver_breaks
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_driver_break();

-- =====================================================================
-- Trigger: shift event logs
-- =====================================================================
CREATE OR REPLACE FUNCTION public.tg_log_shift_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.driver_event_logs(driver_id, restaurant_id, actor_user_id, event, metadata)
    VALUES (NEW.driver_id, NEW.restaurant_id, auth.uid(), 'clock_in',
            jsonb_build_object('shift_id', NEW.id, 'started_at', NEW.started_at));
  ELSIF TG_OP = 'UPDATE' AND OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL THEN
    INSERT INTO public.driver_event_logs(driver_id, restaurant_id, actor_user_id, event, metadata)
    VALUES (NEW.driver_id, NEW.restaurant_id, auth.uid(), 'clock_out',
            jsonb_build_object('shift_id', NEW.id, 'ended_at', NEW.ended_at,
                               'duration_seconds', NEW.duration_seconds));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_driver_shifts_event_log ON public.driver_shifts;
CREATE TRIGGER trg_driver_shifts_event_log
  AFTER INSERT OR UPDATE ON public.driver_shifts
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_shift_events();

-- =====================================================================
-- Trigger: break event logs
-- =====================================================================
CREATE OR REPLACE FUNCTION public.tg_log_break_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.driver_event_logs(driver_id, restaurant_id, actor_user_id, event, metadata)
    VALUES (NEW.driver_id, NEW.restaurant_id, auth.uid(), 'break_start',
            jsonb_build_object('break_id', NEW.id, 'shift_id', NEW.shift_id, 'reason', NEW.reason));
  ELSIF TG_OP = 'UPDATE' AND OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL THEN
    INSERT INTO public.driver_event_logs(driver_id, restaurant_id, actor_user_id, event, metadata)
    VALUES (NEW.driver_id, NEW.restaurant_id, auth.uid(), 'break_end',
            jsonb_build_object('break_id', NEW.id, 'duration_seconds', NEW.duration_seconds));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_driver_breaks_event_log ON public.driver_breaks;
CREATE TRIGGER trg_driver_breaks_event_log
  AFTER INSERT OR UPDATE ON public.driver_breaks
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_break_events();

-- =====================================================================
-- Trigger: validate driver location jump (anti-spoof)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.tg_validate_driver_location_jump()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev_lat double precision;
  prev_lng double precision;
  prev_at  timestamptz;
  dist_m   double precision;
  dt_s     double precision;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    prev_lat := OLD.latitude; prev_lng := OLD.longitude; prev_at := OLD.updated_at;
  ELSE
    SELECT latitude, longitude, updated_at INTO prev_lat, prev_lng, prev_at
    FROM public.driver_locations WHERE driver_id = NEW.driver_id;
  END IF;

  IF prev_lat IS NULL OR prev_lng IS NULL OR prev_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Haversine
  dist_m := 2 * 6371000 * asin(sqrt(
    power(sin(radians((NEW.latitude - prev_lat)/2)),2) +
    cos(radians(prev_lat)) * cos(radians(NEW.latitude)) *
    power(sin(radians((NEW.longitude - prev_lng)/2)),2)
  ));
  dt_s := GREATEST(1, EXTRACT(EPOCH FROM (now() - prev_at)));

  -- > 5km em < 60s => salto impossível (>300 km/h)
  IF dist_m > 5000 AND dt_s < 60 THEN
    INSERT INTO public.driver_event_logs(driver_id, restaurant_id, actor_user_id, event, metadata)
    VALUES (NEW.driver_id, NEW.restaurant_id, auth.uid(), 'location_update_rejected',
            jsonb_build_object('distance_m', dist_m, 'dt_s', dt_s,
                               'from', jsonb_build_object('lat', prev_lat, 'lng', prev_lng),
                               'to',   jsonb_build_object('lat', NEW.latitude, 'lng', NEW.longitude)));
    RAISE EXCEPTION 'Rejected impossible GPS jump: % m in % s', dist_m, dt_s;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_driver_locations_jump_guard ON public.driver_locations;
CREATE TRIGGER trg_driver_locations_jump_guard
  BEFORE INSERT OR UPDATE ON public.driver_locations
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_driver_location_jump();

-- =====================================================================
-- Realtime
-- =====================================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_breaks;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_event_logs;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.driver_breaks REPLICA IDENTITY FULL;
ALTER TABLE public.driver_notifications REPLICA IDENTITY FULL;
