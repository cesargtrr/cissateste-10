-- Create 'adicionais' table
CREATE TABLE public.adicionais (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    preco DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create relationship table 'produto_adicionais'
CREATE TABLE public.produto_adicionais (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    produto_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
    adicional_id UUID NOT NULL REFERENCES public.adicionais(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(produto_id, adicional_id)
);

-- Grant permissions
GRANT SELECT ON public.adicionais TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.adicionais TO authenticated;
GRANT ALL ON public.adicionais TO service_role;

GRANT SELECT ON public.produto_adicionais TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.produto_adicionais TO authenticated;
GRANT ALL ON public.produto_adicionais TO service_role;

-- Enable RLS
ALTER TABLE public.adicionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_adicionais ENABLE ROW LEVEL SECURITY;

-- Policies for 'adicionais'
CREATE POLICY "Adicionais are viewable by everyone" 
ON public.adicionais FOR SELECT USING (true);

CREATE POLICY "Adicionais are manageable by admins" 
ON public.adicionais FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Policies for 'produto_adicionais'
CREATE POLICY "Product adicionais are viewable by everyone" 
ON public.produto_adicionais FOR SELECT USING (true);

CREATE POLICY "Product adicionais are manageable by admins" 
ON public.produto_adicionais FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Trigger for updated_at on adicionais
CREATE TRIGGER update_adicionais_updated_at
BEFORE UPDATE ON public.adicionais
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
