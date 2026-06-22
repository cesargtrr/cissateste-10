
-- 1. available_for column on payment_methods
ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS available_for text[] NOT NULL DEFAULT ARRAY['delivery','pickup']::text[];

ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- Seed defaults / normalize existing
INSERT INTO public.payment_methods (name, type, is_active, display_order, available_for, is_system)
VALUES
  ('PIX', 'pix', true, 1, ARRAY['delivery','pickup','dine_in'], true),
  ('Dinheiro na Entrega', 'cash', true, 2, ARRAY['delivery'], true),
  ('Cartão na Entrega', 'card_delivery', true, 3, ARRAY['delivery'], true),
  ('Pagar na Retirada', 'pay_at_store', true, 4, ARRAY['pickup'], true)
ON CONFLICT DO NOTHING;

-- Mark existing matching rows as system & set sensible available_for
UPDATE public.payment_methods SET is_system = true, available_for = ARRAY['delivery','pickup','dine_in'] WHERE type = 'pix';
UPDATE public.payment_methods SET is_system = true, available_for = ARRAY['delivery'] WHERE type = 'cash';
UPDATE public.payment_methods SET is_system = true, available_for = ARRAY['delivery'] WHERE type = 'card_delivery';
UPDATE public.payment_methods SET is_system = true, available_for = ARRAY['pickup'] WHERE type IN ('pay_at_store','card_pickup');

-- 2. PIX settings table
CREATE TABLE IF NOT EXISTS public.payment_pix_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receiver_name text,
  pix_key text,
  pix_key_type text,
  city text,
  static_pix_code text,
  qr_code_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_pix_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_pix_settings TO authenticated;
GRANT ALL ON public.payment_pix_settings TO service_role;

ALTER TABLE public.payment_pix_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pix settings public read" ON public.payment_pix_settings;
CREATE POLICY "pix settings public read" ON public.payment_pix_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "pix settings admin write" ON public.payment_pix_settings;
CREATE POLICY "pix settings admin write" ON public.payment_pix_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_payment_pix_settings_updated_at ON public.payment_pix_settings;
CREATE TRIGGER update_payment_pix_settings_updated_at
  BEFORE UPDATE ON public.payment_pix_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure one row exists
INSERT INTO public.payment_pix_settings (receiver_name, active)
SELECT 'Oxente Burguer', true
WHERE NOT EXISTS (SELECT 1 FROM public.payment_pix_settings);
