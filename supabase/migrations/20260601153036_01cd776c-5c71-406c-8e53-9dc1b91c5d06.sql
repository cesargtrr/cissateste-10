CREATE TABLE IF NOT EXISTS public.abandoned_carts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_phone TEXT,
    customer_name TEXT,
    items JSONB NOT NULL,
    total_amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, recovered, expired
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.abandoned_carts TO anon, authenticated;
GRANT ALL ON public.abandoned_carts TO service_role;

CREATE POLICY "Anyone can insert abandoned carts" ON public.abandoned_carts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view their own abandoned cart (if we had auth for customers)" ON public.abandoned_carts FOR SELECT USING (true);
