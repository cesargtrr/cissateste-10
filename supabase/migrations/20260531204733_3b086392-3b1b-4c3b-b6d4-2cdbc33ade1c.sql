DELETE FROM public.order_items WHERE order_id IN (SELECT id FROM public.orders WHERE created_at >= CURRENT_DATE);
DELETE FROM public.orders WHERE created_at >= CURRENT_DATE;