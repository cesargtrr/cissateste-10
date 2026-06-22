-- Ensure orders have status_comanda if not exists
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'status_comanda') THEN
    ALTER TABLE public.orders ADD COLUMN status_comanda TEXT DEFAULT 'aberta';
  END IF;
END $$;

-- Safely add tables to supabase_realtime
DO $$
DECLARE
  tbl text;
  tables_to_add text[] := ARRAY['orders', 'order_items', 'abandoned_carts', 'menu_items', 'adicionais'];
BEGIN
  FOREACH tbl IN ARRAY tables_to_add
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    EXCEPTION
      WHEN duplicate_object THEN
        -- Ignore if already added
        NULL;
    END;
  END LOOP;
END $$;

-- Ensure RLS allows the admin to see everything in realtime
GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;
GRANT SELECT ON public.abandoned_carts TO authenticated;
