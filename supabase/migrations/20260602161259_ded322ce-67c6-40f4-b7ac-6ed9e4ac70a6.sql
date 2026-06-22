
REVOKE EXECUTE ON FUNCTION public.apply_stock_change(uuid, int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_order_stock_movement() FROM PUBLIC, anon, authenticated;
