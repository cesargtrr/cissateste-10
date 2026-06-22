-- Set dashboard_stats to use security invoker
ALTER VIEW public.dashboard_stats SET (security_invoker = on);
