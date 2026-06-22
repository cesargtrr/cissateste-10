-- Dashboard Statistics View
CREATE OR REPLACE VIEW public.dashboard_stats AS
WITH 
paid_orders AS (
  SELECT * FROM public.orders 
  WHERE status IN ('preparing', 'delivered', 'completed')
),
daily_metrics AS (
  SELECT 
    COALESCE(SUM(total_amount), 0) as daily_revenue,
    COUNT(id) as daily_orders,
    CASE WHEN COUNT(id) > 0 THEN SUM(total_amount) / COUNT(id) ELSE 0 END as daily_avg_ticket
  FROM paid_orders
  WHERE created_at >= CURRENT_DATE
),
last_week_same_day AS (
  SELECT 
    COALESCE(SUM(total_amount), 0) as revenue
  FROM paid_orders
  WHERE created_at >= (CURRENT_DATE - INTERVAL '7 days') 
    AND created_at < (CURRENT_DATE - INTERVAL '6 days')
),
monthly_metrics AS (
  SELECT 
    COALESCE(SUM(total_amount), 0) as monthly_revenue
  FROM paid_orders
  WHERE created_at >= date_trunc('month', CURRENT_DATE)
),
top_products AS (
  SELECT 
    mi.id as product_id,
    mi.name as name,
    SUM(oi.quantity) as total_qty
  FROM public.order_items oi
  JOIN public.menu_items mi ON mi.id = oi.menu_item_id
  JOIN paid_orders o ON o.id = oi.order_id
  WHERE o.created_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY mi.id, mi.name
  ORDER BY total_qty DESC
  LIMIT 5
),
weekly_chart AS (
  SELECT 
    date_trunc('day', created_at)::date as day,
    SUM(total_amount) as revenue
  FROM paid_orders
  WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
  GROUP BY 1
  ORDER BY 1 ASC
),
orders_by_source AS (
  SELECT 
    source,
    COUNT(id) as count
  FROM paid_orders
  WHERE created_at >= CURRENT_DATE
  GROUP BY source
),
prep_times AS (
  SELECT 
    EXTRACT(EPOCH FROM (updated_at - created_at))/60 as prep_minutes
  FROM paid_orders
  WHERE status IN ('delivered', 'completed')
    AND updated_at > created_at
    AND created_at >= CURRENT_DATE - INTERVAL '7 days'
)
SELECT 
  (SELECT daily_revenue FROM daily_metrics) as revenue_today,
  (SELECT revenue FROM last_week_same_day) as revenue_last_week_same_day,
  (SELECT monthly_revenue FROM monthly_metrics) as revenue_month,
  (SELECT daily_avg_ticket FROM daily_metrics) as ticket_medio,
  (SELECT daily_orders FROM daily_metrics) as orders_today,
  (SELECT json_agg(t) FROM (SELECT * FROM top_products) t) as top_products_json,
  (SELECT json_agg(w) FROM (SELECT * FROM weekly_chart) w) as weekly_revenue_json,
  (SELECT json_agg(s) FROM (SELECT * FROM orders_by_source) s) as source_distribution_json,
  (SELECT AVG(prep_minutes) FROM prep_times) as avg_prep_time_mins;

GRANT SELECT ON public.dashboard_stats TO authenticated;
GRANT SELECT ON public.dashboard_stats TO service_role;
