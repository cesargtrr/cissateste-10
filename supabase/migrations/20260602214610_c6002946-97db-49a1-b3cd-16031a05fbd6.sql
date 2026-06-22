DROP VIEW IF EXISTS public.dashboard_stats;

CREATE VIEW public.dashboard_stats AS
WITH paid_orders AS (
  SELECT o.id, o.customer_name, o.table_number, o.total_amount, o.status,
         o.payment_method, o.source, o.created_at, o.updated_at,
         o.delivery_address, o.delivery_reference, o.delivery_fee,
         o.customer_phone, o.customer_id, o.mesa_session, o.prepared_at
  FROM public.orders o
  WHERE (o.source <> 'mesa' AND o.status IN ('preparing','delivered','ready','completed'))
     OR (o.source =  'mesa' AND o.status = 'completed')
),
daily_metrics AS (
  SELECT COALESCE(sum(total_amount),0) AS daily_revenue,
         count(id) AS daily_orders,
         CASE WHEN count(id) > 0 THEN sum(total_amount)/count(id) ELSE 0 END AS daily_avg_ticket
  FROM paid_orders
  WHERE created_at >= CURRENT_DATE
),
last_week_same_day AS (
  SELECT COALESCE(sum(total_amount),0) AS revenue
  FROM paid_orders
  WHERE created_at >= (CURRENT_DATE - INTERVAL '7 days')
    AND created_at <  (CURRENT_DATE - INTERVAL '6 days')
),
monthly_metrics AS (
  SELECT COALESCE(sum(total_amount),0) AS monthly_revenue
  FROM paid_orders
  WHERE created_at >= date_trunc('month', CURRENT_DATE::timestamp with time zone)
),
top_products AS (
  SELECT mi.id AS product_id, mi.name, sum(oi.quantity) AS total_qty
  FROM public.order_items oi
  JOIN public.menu_items mi ON mi.id = oi.menu_item_id
  JOIN paid_orders o ON o.id = oi.order_id
  WHERE o.created_at >= (CURRENT_DATE - INTERVAL '30 days')
  GROUP BY mi.id, mi.name
  ORDER BY sum(oi.quantity) DESC
  LIMIT 5
),
weekly_chart AS (
  SELECT date_trunc('day', created_at)::date AS day,
         sum(total_amount) AS revenue
  FROM paid_orders
  WHERE created_at >= (CURRENT_DATE - INTERVAL '6 days')
  GROUP BY 1
  ORDER BY 1
),
orders_by_source AS (
  SELECT source, count(id) AS count
  FROM paid_orders
  WHERE created_at >= CURRENT_DATE
  GROUP BY source
),
prep_times AS (
  SELECT EXTRACT(epoch FROM (o.prepared_at - o.created_at))/60.0 AS prep_minutes
  FROM public.orders o
  WHERE o.prepared_at IS NOT NULL
    AND o.prepared_at > o.created_at
    AND o.created_at >= (CURRENT_DATE - INTERVAL '7 days')
)
SELECT
  (SELECT daily_revenue FROM daily_metrics) AS revenue_today,
  (SELECT revenue FROM last_week_same_day) AS revenue_last_week_same_day,
  (SELECT monthly_revenue FROM monthly_metrics) AS revenue_month,
  (SELECT daily_avg_ticket FROM daily_metrics) AS ticket_medio,
  (SELECT daily_orders FROM daily_metrics) AS orders_today,
  (SELECT json_agg(t.*) FROM top_products t) AS top_products,
  (SELECT json_agg(w.*) FROM weekly_chart w) AS weekly_chart,
  (SELECT json_agg(s.*) FROM orders_by_source s) AS orders_by_source,
  (SELECT COALESCE(avg(prep_minutes),0) FROM prep_times) AS avg_prep_time_mins;

GRANT SELECT ON public.dashboard_stats TO authenticated;
GRANT SELECT ON public.dashboard_stats TO service_role;
