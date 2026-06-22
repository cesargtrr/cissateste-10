
-- ============ FASE 13: Gamificação Entregador ============

-- Enum reason
DO $$ BEGIN
  CREATE TYPE public.driver_point_reason AS ENUM (
    'delivery','on_time_bonus','streak_5','streak_10','cancellation','achievement','manual'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) Ledger
CREATE TABLE IF NOT EXISTS public.driver_points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.delivery_drivers(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  points integer NOT NULL,
  reason public.driver_point_reason NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dpl_driver_created ON public.driver_points_ledger(driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dpl_restaurant_created ON public.driver_points_ledger(restaurant_id, created_at DESC);

GRANT SELECT, INSERT ON public.driver_points_ledger TO authenticated;
GRANT ALL ON public.driver_points_ledger TO service_role;
ALTER TABLE public.driver_points_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drivers view own points" ON public.driver_points_ledger
  FOR SELECT TO authenticated
  USING (driver_id = public.get_driver_id_for_user(auth.uid()));

CREATE POLICY "drivers view restaurant ranking" ON public.driver_points_ledger
  FOR SELECT TO authenticated
  USING (restaurant_id IN (
    SELECT dd.restaurant_id FROM public.delivery_drivers dd
    WHERE dd.id = public.get_driver_id_for_user(auth.uid())
  ));

CREATE POLICY "admins manage points" ON public.driver_points_ledger
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 2) Achievements
CREATE TABLE IF NOT EXISTS public.driver_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.delivery_drivers(id) ON DELETE CASCADE,
  code text NOT NULL,
  points_awarded integer NOT NULL DEFAULT 0,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_id, code)
);
CREATE INDEX IF NOT EXISTS idx_da_driver ON public.driver_achievements(driver_id, unlocked_at DESC);

GRANT SELECT, INSERT ON public.driver_achievements TO authenticated;
GRANT ALL ON public.driver_achievements TO service_role;
ALTER TABLE public.driver_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drivers view own achievements" ON public.driver_achievements
  FOR SELECT TO authenticated
  USING (driver_id = public.get_driver_id_for_user(auth.uid()));

CREATE POLICY "drivers view restaurant achievements" ON public.driver_achievements
  FOR SELECT TO authenticated
  USING (restaurant_id IN (
    SELECT dd.restaurant_id FROM public.delivery_drivers dd
    WHERE dd.id = public.get_driver_id_for_user(auth.uid())
  ));

CREATE POLICY "admins manage achievements" ON public.driver_achievements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 3) Trigger function: award points on delivery status change
CREATE OR REPLACE FUNCTION public.award_driver_points_on_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rest uuid;
  v_total_delivered integer;
  v_streak integer;
  v_ach RECORD;
  v_levels jsonb := '[
    {"code":"first_delivery","threshold":1,"pts":10},
    {"code":"beginner_10","threshold":10,"pts":20},
    {"code":"experienced_50","threshold":50,"pts":50},
    {"code":"professional_100","threshold":100,"pts":100},
    {"code":"elite_500","threshold":500,"pts":250},
    {"code":"legend_1000","threshold":1000,"pts":500}
  ]'::jsonb;
  v_item jsonb;
BEGIN
  IF NEW.delivery_driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT restaurant_id INTO v_rest FROM public.delivery_drivers WHERE id = NEW.delivery_driver_id;
  IF v_rest IS NULL THEN RETURN NEW; END IF;

  -- Entrega concluída
  IF NEW.delivery_status IN ('entregue','delivered')
     AND (OLD.delivery_status IS DISTINCT FROM NEW.delivery_status) THEN

    INSERT INTO public.driver_points_ledger(restaurant_id, driver_id, order_id, points, reason, description)
    VALUES (v_rest, NEW.delivery_driver_id, NEW.id, 10, 'delivery', 'Entrega concluída');

    -- Bônus pontualidade: <= 45 min do início ao fim
    IF NEW.delivery_started_at IS NOT NULL AND NEW.delivery_completed_at IS NOT NULL
       AND NEW.delivery_completed_at <= NEW.delivery_started_at + interval '45 minutes' THEN
      INSERT INTO public.driver_points_ledger(restaurant_id, driver_id, order_id, points, reason, description)
      VALUES (v_rest, NEW.delivery_driver_id, NEW.id, 5, 'on_time_bonus', 'Entrega no prazo');
    END IF;

    -- Total e sequências
    SELECT count(*) INTO v_total_delivered
    FROM public.orders
    WHERE delivery_driver_id = NEW.delivery_driver_id
      AND delivery_status IN ('entregue','delivered');

    -- Streak hoje
    SELECT count(*) INTO v_streak
    FROM public.orders
    WHERE delivery_driver_id = NEW.delivery_driver_id
      AND delivery_status IN ('entregue','delivered')
      AND COALESCE(delivery_completed_at, updated_at)::date = CURRENT_DATE;

    IF v_streak = 5 THEN
      INSERT INTO public.driver_points_ledger(restaurant_id, driver_id, order_id, points, reason, description)
      VALUES (v_rest, NEW.delivery_driver_id, NEW.id, 20, 'streak_5', '5 entregas consecutivas');
    ELSIF v_streak = 10 THEN
      INSERT INTO public.driver_points_ledger(restaurant_id, driver_id, order_id, points, reason, description)
      VALUES (v_rest, NEW.delivery_driver_id, NEW.id, 50, 'streak_10', '10 entregas consecutivas');
    END IF;

    -- Conquistas por threshold
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_levels) LOOP
      IF v_total_delivered >= (v_item->>'threshold')::int THEN
        BEGIN
          INSERT INTO public.driver_achievements(restaurant_id, driver_id, code, points_awarded)
          VALUES (v_rest, NEW.delivery_driver_id, v_item->>'code', (v_item->>'pts')::int);

          INSERT INTO public.driver_points_ledger(restaurant_id, driver_id, order_id, points, reason, description)
          VALUES (v_rest, NEW.delivery_driver_id, NEW.id, (v_item->>'pts')::int, 'achievement', 'Conquista: ' || (v_item->>'code'));
        EXCEPTION WHEN unique_violation THEN
          NULL;
        END;
      END IF;
    END LOOP;

  ELSIF NEW.delivery_status IN ('cancelado','cancelled')
     AND (OLD.delivery_status IS DISTINCT FROM NEW.delivery_status) THEN
    INSERT INTO public.driver_points_ledger(restaurant_id, driver_id, order_id, points, reason, description)
    VALUES (v_rest, NEW.delivery_driver_id, NEW.id, -15, 'cancellation', 'Entrega cancelada');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_driver_points ON public.orders;
CREATE TRIGGER trg_award_driver_points
AFTER UPDATE OF delivery_status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.award_driver_points_on_status();

-- 4) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_points_ledger;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_achievements;
