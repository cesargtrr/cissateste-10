-- Garantir que a tabela restaurants exista
CREATE TABLE IF NOT EXISTS public.restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurants TO authenticated;
GRANT ALL ON public.restaurants TO service_role;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated to read restaurants" ON public.restaurants FOR SELECT TO authenticated USING (true);

-- Criar ou atualizar a tabela payment_provider_settings
CREATE TABLE IF NOT EXISTS public.payment_provider_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL, -- 'mercadopago', 'asaas', 'stripe', 'manual'
  public_key text NULL,
  access_token text NULL,
  api_key text NULL, -- Legado Asaas
  webhook_secret text NULL,
  environment text DEFAULT 'sandbox', -- 'sandbox' ou 'production'
  active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Adicionar colunas caso a tabela já exista mas esteja incompleta
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_provider_settings' AND column_name='restaurant_id') THEN
        ALTER TABLE public.payment_provider_settings ADD COLUMN restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_provider_settings' AND column_name='public_key') THEN
        ALTER TABLE public.payment_provider_settings ADD COLUMN public_key text NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_provider_settings' AND column_name='access_token') THEN
        ALTER TABLE public.payment_provider_settings ADD COLUMN access_token text NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_provider_settings' AND column_name='webhook_secret') THEN
        ALTER TABLE public.payment_provider_settings ADD COLUMN webhook_secret text NULL;
    END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_provider_settings TO authenticated;
GRANT ALL ON public.payment_provider_settings TO service_role;
ALTER TABLE public.payment_provider_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own payment settings" ON public.payment_provider_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_payment_provider_settings_updated_at ON public.payment_provider_settings;
CREATE TRIGGER update_payment_provider_settings_updated_at BEFORE UPDATE ON public.payment_provider_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
