-- Ensure REPLICA IDENTITY FULL (safe to re-run)
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
ALTER TABLE public.abandoned_carts REPLICA IDENTITY FULL;

-- Add only the tables that are not yet in the publication
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='order_items') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='abandoned_carts') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.abandoned_carts';
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_orders_mesa_session ON public.orders(mesa_session) WHERE mesa_session IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_table_status ON public.orders(table_number, status) WHERE source = 'mesa';