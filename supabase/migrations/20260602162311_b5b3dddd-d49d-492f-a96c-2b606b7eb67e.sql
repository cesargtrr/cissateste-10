-- Fix function security search path
ALTER FUNCTION public.apply_stock_change(UUID, INTEGER, TEXT, UUID) SET search_path = public;
ALTER FUNCTION public.handle_order_stock_movement() SET search_path = public;

-- Revoke permissions to avoid unauthorized calls to SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.apply_stock_change(UUID, INTEGER, TEXT, UUID) FROM public;
REVOKE EXECUTE ON FUNCTION public.apply_stock_change(UUID, INTEGER, TEXT, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_stock_change(UUID, INTEGER, TEXT, UUID) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_order_stock_movement() FROM public;
REVOKE EXECUTE ON FUNCTION public.handle_order_stock_movement() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_order_stock_movement() FROM authenticated;
