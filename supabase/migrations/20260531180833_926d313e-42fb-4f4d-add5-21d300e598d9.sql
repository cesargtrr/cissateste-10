-- Add 'completed' to order_status enum
ALTER TYPE public.order_status ADD VALUE 'completed';

-- Note: We can't easily remove values from an enum in a migration without dropping and recreating, 
-- but we can just use 'completed' as requested.
