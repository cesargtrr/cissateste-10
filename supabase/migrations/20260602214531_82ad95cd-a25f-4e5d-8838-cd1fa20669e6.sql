ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'ready';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS prepared_at timestamp with time zone;
