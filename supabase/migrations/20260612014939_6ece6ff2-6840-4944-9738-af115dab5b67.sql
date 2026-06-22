
-- 1. Remove legacy card_pickup rows
DELETE FROM public.payment_methods WHERE type = 'card_pickup';

-- 2. Deduplicate: keep the oldest row per type
DELETE FROM public.payment_methods pm
USING public.payment_methods pm2
WHERE pm.type = pm2.type
  AND pm.created_at > pm2.created_at;

-- In case created_at ties exist, fall back to id ordering
DELETE FROM public.payment_methods pm
USING public.payment_methods pm2
WHERE pm.type = pm2.type
  AND pm.id > pm2.id;

-- 3. Add unique constraint on type to prevent future duplicates
ALTER TABLE public.payment_methods
  ADD CONSTRAINT payment_methods_type_unique UNIQUE (type);
