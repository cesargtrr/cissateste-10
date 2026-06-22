ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS provider text DEFAULT 'manual';

CREATE TABLE IF NOT EXISTS public.payment_pix_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    receiver_name text,
    pix_key_type text,
    pix_key text,
    city text,
    static_pix_code text,
    qr_code_url text,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_pix_settings TO authenticated;
GRANT ALL ON public.payment_pix_settings TO service_role;
ALTER TABLE public.payment_pix_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON public.payment_pix_settings
    FOR ALL USING (true) WITH CHECK (true);
