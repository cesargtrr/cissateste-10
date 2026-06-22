
DROP VIEW IF EXISTS public.dashboard_stats;

CREATE VIEW public.dashboard_stats
WITH (security_invoker = on) AS
WITH paid_orders AS (
  SELECT o.*
  FROM public.orders o
  WHERE (o.source <> 'mesa'::order_source
         AND o.status = ANY (ARRAY['preparing'::order_status,'delivered'::order_status,'ready'::order_status,'completed'::order_status]))
     OR (o.source = 'mesa'::order_source AND o.status = 'completed'::order_status)
),
br_today AS (
  SELECT (date_trunc('day', (now() AT TIME ZONE 'America/Sao_Paulo')) AT TIME ZONE 'America/Sao_Paulo') AS day_start,
         ((date_trunc('day', (now() AT TIME ZONE 'America/Sao_Paulo')) + interval '1 day') AT TIME ZONE 'America/Sao_Paulo') AS day_end,
         ((date_trunc('day', (now() AT TIME ZONE 'America/Sao_Paulo')) - interval '7 days') AT TIME ZONE 'America/Sao_Paulo') AS lw_start,
         ((date_trunc('day', (now() AT TIME ZONE 'America/Sao_Paulo')) - interval '6 days') AT TIME ZONE 'America/Sao_Paulo') AS lw_end,
         (date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo')) AT TIME ZONE 'America/Sao_Paulo') AS month_start
),
daily_metrics AS (
  SELECT COALESCE(SUM(po.total_amount),0)::numeric AS daily_revenue,
         COUNT(po.id)::bigint AS daily_orders
  FROM paid_orders po, br_today b
  WHERE po.created_at >= b.day_start AND po.created_at < b.day_end
),
last_week_same_day AS (
  SELECT COALESCE(SUM(po.total_amount),0)::numeric AS revenue
  FROM paid_orders po, br_today b
  WHERE po.created_at >= b.lw_start AND po.created_at < b.lw_end
),
monthly_metrics AS (
  SELECT COALESCE(SUM(po.total_amount),0)::numeric AS monthly_revenue,
         COUNT(po.id)::bigint AS monthly_orders
  FROM paid_orders po, br_today b
  WHERE po.created_at >= b.month_start
),
monthly_cost AS (
  SELECT COALESCE(SUM(oi.quantity * COALESCE(mi.cost_price,0)),0)::numeric AS cost_amount
  FROM public.order_items oi
  JOIN paid_orders po ON po.id = oi.order_id
  LEFT JOIN public.menu_items mi ON mi.id = oi.menu_item_id
  CROSS JOIN br_today b
  WHERE po.created_at >= b.month_start
),
top_products AS (
  SELECT mi.id AS product_id, mi.name, SUM(oi.quantity)::bigint AS total_qty
  FROM public.order_items oi
  JOIN public.menu_items mi ON mi.id = oi.menu_item_id
  JOIN paid_orders po ON po.id = oi.order_id
  CROSS JOIN br_today b
  WHERE po.created_at >= b.month_start - interval '30 days'
  GROUP BY mi.id, mi.name
  ORDER BY SUM(oi.quantity) DESC
  LIMIT 5
),
weekly_chart AS (
  SELECT (date_trunc('day', po.created_at AT TIME ZONE 'America/Sao_Paulo'))::date AS day,
         SUM(po.total_amount)::numeric AS revenue
  FROM paid_orders po, br_today b
  WHERE po.created_at >= b.day_start - interval '6 days'
  GROUP BY 1
  ORDER BY 1
),
orders_by_source AS (
  SELECT po.source, COUNT(po.id)::bigint AS count
  FROM paid_orders po, br_today b
  WHERE po.created_at >= b.day_start AND po.created_at < b.day_end
  GROUP BY po.source
),
prep_times AS (
  SELECT EXTRACT(epoch FROM (o.prepared_at - o.created_at))/60.0 AS prep_minutes
  FROM public.orders o, br_today b
  WHERE o.prepared_at IS NOT NULL
    AND o.prepared_at > o.created_at
    AND o.created_at >= b.day_start AND o.created_at < b.day_end
)
SELECT
  (SELECT daily_revenue FROM daily_metrics) AS revenue_today,
  (SELECT revenue FROM last_week_same_day) AS revenue_last_week_same_day,
  (SELECT monthly_revenue FROM monthly_metrics) AS revenue_month,
  CASE WHEN (SELECT monthly_orders FROM monthly_metrics) > 0
       THEN (SELECT monthly_revenue FROM monthly_metrics) / (SELECT monthly_orders FROM monthly_metrics)::numeric
       ELSE 0::numeric END AS ticket_medio,
  (SELECT daily_orders FROM daily_metrics) AS orders_today,
  (SELECT json_agg(t.*) FROM top_products t) AS top_products,
  (SELECT json_agg(w.*) FROM weekly_chart w) AS weekly_chart,
  (SELECT json_agg(s.*) FROM orders_by_source s) AS orders_by_source,
  (SELECT COALESCE(AVG(prep_minutes),0)::numeric FROM prep_times) AS avg_prep_time_mins,
  (SELECT cost_amount FROM monthly_cost) AS custo_mes,
  ((SELECT monthly_revenue FROM monthly_metrics) - (SELECT cost_amount FROM monthly_cost)) AS lucro_mes;

GRANT SELECT ON public.dashboard_stats TO authenticated, anon, service_role;
