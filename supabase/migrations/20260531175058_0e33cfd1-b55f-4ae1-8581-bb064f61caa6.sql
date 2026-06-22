-- Add 'delivery' value to order_source enum
ALTER TYPE order_source ADD VALUE IF NOT EXISTS 'delivery';

-- Add delivery columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS delivery_reference text,
  ADD COLUMN IF NOT EXISTS delivery_fee numeric NOT NULL DEFAULT 0;

-- Add delivery_fee to restaurant_settings
ALTER TABLE public.restaurant_settings
  ADD COLUMN IF NOT EXISTS delivery_fee numeric NOT NULL DEFAULT 5;