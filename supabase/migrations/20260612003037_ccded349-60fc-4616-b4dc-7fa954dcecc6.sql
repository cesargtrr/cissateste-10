-- 1. Adicionar colunas de detalhes de pagamento na tabela orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_details JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS status_financeiro TEXT DEFAULT 'pendente',
ADD COLUMN IF NOT EXISTS change_for NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS needs_change BOOLEAN DEFAULT false;

-- 2. Criar tabela de formas de pagamento
CREATE TABLE IF NOT EXISTS public.payment_methods (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'pix', 'cash', 'card_delivery', 'card_pickup', 'other'
    is_active BOOLEAN DEFAULT true,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Inserir métodos padrão
INSERT INTO public.payment_methods (name, type, display_order)
VALUES 
('PIX', 'pix', 1),
('Dinheiro na Entrega', 'cash', 2),
('Cartão na Entrega', 'card_delivery', 3),
('Pagar na Retirada', 'card_pickup', 4)
ON CONFLICT DO NOTHING;

-- 4. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO service_role;
GRANT SELECT ON public.payment_methods TO anon;

-- 5. RLS para payment_methods
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read of payment methods" ON public.payment_methods FOR SELECT USING (true);
CREATE POLICY "Allow authenticated manage payment methods" ON public.payment_methods FOR ALL TO authenticated USING (true);

-- 6. Trigger para updated_at em payment_methods
CREATE OR REPLACE FUNCTION public.handle_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payment_methods_updated_at 
BEFORE UPDATE ON public.payment_methods 
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();