
-- Harden driver_event_logs: remove direct INSERT from drivers, append-only
DROP POLICY IF EXISTS "Drivers insert own events" ON public.driver_event_logs;
REVOKE INSERT, UPDATE, DELETE ON public.driver_event_logs FROM authenticated, anon;
GRANT SELECT ON public.driver_event_logs TO authenticated;
GRANT ALL ON public.driver_event_logs TO service_role;

-- Server-side logger callable from the client
CREATE OR REPLACE FUNCTION public.log_driver_event(_event text, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id uuid;
  v_restaurant uuid;
  v_kind driver_event_kind;
  v_id uuid;
BEGIN
  v_driver_id := public.get_driver_id_for_user(auth.uid());
  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Not a driver';
  END IF;

  -- Only allow a safe subset from the client
  IF _event NOT IN ('login','delivery_accepted','delivery_rejected') THEN
    RAISE EXCEPTION 'Event % not allowed from client', _event;
  END IF;
  v_kind := _event::driver_event_kind;

  SELECT restaurant_id INTO v_restaurant
  FROM public.delivery_drivers WHERE id = v_driver_id;

  INSERT INTO public.driver_event_logs(driver_id, restaurant_id, actor_user_id, event, metadata)
  VALUES (v_driver_id, v_restaurant, auth.uid(), v_kind, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.log_driver_event(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_driver_event(text, jsonb) TO authenticated;

-- start_break RPC
CREATE OR REPLACE FUNCTION public.start_break(_reason text, _notes text DEFAULT NULL)
RETURNS public.driver_breaks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id uuid;
  v_restaurant uuid;
  v_shift_id uuid;
  v_existing uuid;
  v_row public.driver_breaks;
BEGIN
  v_driver_id := public.get_driver_id_for_user(auth.uid());
  IF v_driver_id IS NULL THEN RAISE EXCEPTION 'Not a driver'; END IF;

  v_shift_id := public.get_active_shift(v_driver_id);
  IF v_shift_id IS NULL THEN RAISE EXCEPTION 'No active shift'; END IF;

  SELECT id INTO v_existing FROM public.driver_breaks
   WHERE shift_id = v_shift_id AND ended_at IS NULL LIMIT 1;
  IF v_existing IS NOT NULL THEN RAISE EXCEPTION 'A break is already open'; END IF;

  SELECT restaurant_id INTO v_restaurant FROM public.delivery_drivers WHERE id = v_driver_id;

  INSERT INTO public.driver_breaks(shift_id, driver_id, restaurant_id, reason, notes, started_at)
  VALUES (v_shift_id, v_driver_id, v_restaurant, _reason::driver_break_reason, _notes, now())
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.start_break(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_break(text, text) TO authenticated;

-- end_break RPC
CREATE OR REPLACE FUNCTION public.end_break()
RETURNS public.driver_breaks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id uuid;
  v_shift_id uuid;
  v_row public.driver_breaks;
BEGIN
  v_driver_id := public.get_driver_id_for_user(auth.uid());
  IF v_driver_id IS NULL THEN RAISE EXCEPTION 'Not a driver'; END IF;

  v_shift_id := public.get_active_shift(v_driver_id);
  IF v_shift_id IS NULL THEN RAISE EXCEPTION 'No active shift'; END IF;

  UPDATE public.driver_breaks
     SET ended_at = now()
   WHERE shift_id = v_shift_id AND ended_at IS NULL AND driver_id = v_driver_id
   RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN RAISE EXCEPTION 'No open break'; END IF;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.end_break() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.end_break() TO authenticated;
