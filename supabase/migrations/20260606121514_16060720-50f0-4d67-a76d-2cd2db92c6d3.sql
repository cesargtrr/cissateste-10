
-- Fix abandoned_carts: restrict SELECT to admins
DROP POLICY IF EXISTS "Anyone can view their own abandoned cart (if we had auth for cu" ON public.abandoned_carts;
CREATE POLICY "Admins can view abandoned carts"
  ON public.abandoned_carts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix loyalty_points: restrict SELECT to admins
DROP POLICY IF EXISTS "Loyalty points are viewable by everyone" ON public.loyalty_points;
CREATE POLICY "Admins can view loyalty points"
  ON public.loyalty_points FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix orders: remove public SELECT
DROP POLICY IF EXISTS "Public can see basic order info" ON public.orders;
DROP POLICY IF EXISTS "Admins can see everything" ON public.orders;
-- "Admin full access on orders" ALL policy still exists; add a re-create for clarity
CREATE POLICY "Admins can view orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix expenses: tighten to admins only
DROP POLICY IF EXISTS "Expenses are viewable by authenticated users" ON public.expenses;
DROP POLICY IF EXISTS "Admins can insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins can update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins can delete expenses" ON public.expenses;
CREATE POLICY "Admins manage expenses"
  ON public.expenses FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- order_items: explicit admin-only SELECT (the ALL policy already covers it, but make intent explicit)
CREATE POLICY "Admins can view order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- historico_estoque: restrict SELECT to admins
DROP POLICY IF EXISTS "Historico estoque viewable by everyone" ON public.historico_estoque;
CREATE POLICY "Admins view historico estoque"
  ON public.historico_estoque FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- stock_items: restrict to admins (full management)
DROP POLICY IF EXISTS "Stock items are viewable by everyone" ON public.stock_items;
CREATE POLICY "Admins manage stock items"
  ON public.stock_items FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- customers: explicit admin-only SELECT policy for clarity
CREATE POLICY "Admins can view customers"
  ON public.customers FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- menu_items_public view to hide cost_price from public
CREATE OR REPLACE VIEW public.menu_items_public
WITH (security_invoker=on) AS
  SELECT id, name, description, price, image_url, rating, category_id,
         is_available, created_at, updated_at, controlar_estoque,
         quantidade_estoque, estoque_minimo, permitir_observacao, placeholder_observacao
  FROM public.menu_items;
GRANT SELECT ON public.menu_items_public TO anon, authenticated;

-- Remove public SELECT on menu_items (cost_price exposure); keep admin-only for full table
DROP POLICY IF EXISTS "Menu items are viewable by everyone" ON public.menu_items;
CREATE POLICY "Authenticated admins view menu items"
  ON public.menu_items FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix dashboard_stats view: recreate with security_invoker
DROP VIEW IF EXISTS public.dashboard_stats;
CREATE VIEW public.dashboard_stats
WITH (security_invoker=on) AS
 WITH paid_orders AS (
         SELECT o.id, o.customer_name, o.table_number, o.total_amount, o.status,
            o.payment_method, o.source, o.created_at, o.updated_at,
            o.delivery_address, o.delivery_reference, o.delivery_fee,
            o.customer_phone, o.customer_id, o.mesa_session, o.prepared_at
           FROM public.orders o
          WHERE (((o.source <> 'mesa'::order_source) AND (o.status = ANY (ARRAY['preparing'::order_status, 'delivered'::order_status, 'ready'::order_status, 'completed'::order_status]))) OR ((o.source = 'mesa'::order_source) AND (o.status = 'completed'::order_status)))
        ), daily_metrics AS (
         SELECT COALESCE(sum(paid_orders.total_amount), 0::numeric) AS daily_revenue,
            count(paid_orders.id) AS daily_orders,
                CASE WHEN count(paid_orders.id) > 0 THEN sum(paid_orders.total_amount) / count(paid_orders.id)::numeric ELSE 0::numeric END AS daily_avg_ticket
           FROM paid_orders WHERE paid_orders.created_at >= CURRENT_DATE
        ), last_week_same_day AS (
         SELECT COALESCE(sum(paid_orders.total_amount), 0::numeric) AS revenue
           FROM paid_orders WHERE paid_orders.created_at >= (CURRENT_DATE - '7 days'::interval) AND paid_orders.created_at < (CURRENT_DATE - '6 days'::interval)
        ), monthly_metrics AS (
         SELECT COALESCE(sum(paid_orders.total_amount), 0::numeric) AS monthly_revenue
           FROM paid_orders WHERE paid_orders.created_at >= date_trunc('month', CURRENT_DATE::timestamp with time zone)
        ), top_products AS (
         SELECT mi.id AS product_id, mi.name, sum(oi.quantity) AS total_qty
           FROM public.order_items oi
             JOIN public.menu_items mi ON mi.id = oi.menu_item_id
             JOIN paid_orders o ON o.id = oi.order_id
          WHERE o.created_at >= (CURRENT_DATE - '30 days'::interval)
          GROUP BY mi.id, mi.name ORDER BY sum(oi.quantity) DESC LIMIT 5
        ), weekly_chart AS (
         SELECT date_trunc('day', paid_orders.created_at)::date AS day, sum(paid_orders.total_amount) AS revenue
           FROM paid_orders WHERE paid_orders.created_at >= (CURRENT_DATE - '6 days'::interval)
          GROUP BY date_trunc('day', paid_orders.created_at)::date ORDER BY date_trunc('day', paid_orders.created_at)::date
        ), orders_by_source AS (
         SELECT paid_orders.source, count(paid_orders.id) AS count
           FROM paid_orders WHERE paid_orders.created_at >= CURRENT_DATE GROUP BY paid_orders.source
        ), prep_times AS (
         SELECT EXTRACT(epoch FROM o.prepared_at - o.created_at) / 60.0 AS prep_minutes
           FROM public.orders o WHERE o.prepared_at IS NOT NULL AND o.prepared_at > o.created_at AND o.created_at >= (CURRENT_DATE - '7 days'::interval)
        )
 SELECT (SELECT daily_revenue FROM daily_metrics) AS revenue_today,
    (SELECT revenue FROM last_week_same_day) AS revenue_last_week_same_day,
    (SELECT monthly_revenue FROM monthly_metrics) AS revenue_month,
    (SELECT daily_avg_ticket FROM daily_metrics) AS ticket_medio,
    (SELECT daily_orders FROM daily_metrics) AS orders_today,
    (SELECT json_agg(t.*) FROM top_products t) AS top_products,
    (SELECT json_agg(w.*) FROM weekly_chart w) AS weekly_chart,
    (SELECT json_agg(s.*) FROM orders_by_source s) AS orders_by_source,
    (SELECT COALESCE(avg(prep_minutes), 0::numeric) FROM prep_times) AS avg_prep_time_mins;

GRANT SELECT ON public.dashboard_stats TO authenticated;

-- Fix function search_path for update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;
