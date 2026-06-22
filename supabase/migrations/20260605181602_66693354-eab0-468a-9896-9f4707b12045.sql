ALTER FUNCTION public.apply_stock_change(UUID, INTEGER, TEXT, UUID, TEXT) SET search_path = public;
ALTER FUNCTION public.handle_order_stock_movement() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.apply_stock_change(UUID, INTEGER, TEXT, UUID, TEXT) FROM public;
REVOKE EXECUTE ON FUNCTION public.apply_stock_change(UUID, INTEGER, TEXT, UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_stock_change(UUID, INTEGER, TEXT, UUID, TEXT) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_order_stock_movement() FROM public;
REVOKE EXECUTE ON FUNCTION public.handle_order_stock_movement() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_order_stock_movement() FROM authenticated;
