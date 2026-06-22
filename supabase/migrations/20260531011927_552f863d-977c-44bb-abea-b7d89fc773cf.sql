-- Create categories table
CREATE TABLE public.categories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create menu_items table
CREATE TABLE public.menu_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC NOT NULL,
    image_url TEXT,
    rating NUMERIC DEFAULT 5.0,
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated and anon users
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT SELECT ON public.menu_items TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
GRANT ALL ON public.menu_items TO service_role;

-- Policies for public reading
CREATE POLICY "Categories are viewable by everyone" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Menu items are viewable by everyone" ON public.menu_items FOR SELECT USING (true);

-- Initial Categories
INSERT INTO public.categories (name) VALUES 
('Hambúrgueres'),
('Acompanhamentos'),
('Bebidas');

-- Initial Menu Items
DO $$ 
DECLARE 
    h_id UUID;
    a_id UUID;
    b_id UUID;
BEGIN
    SELECT id INTO h_id FROM public.categories WHERE name = 'Hambúrgueres';
    SELECT id INTO a_id FROM public.categories WHERE name = 'Acompanhamentos';
    SELECT id INTO b_id FROM public.categories WHERE name = 'Bebidas';

    -- Hambúrgueres
    INSERT INTO public.menu_items (name, description, price, image_url, rating, category_id) VALUES
    ('Sertão Burguer', 'Blend 180g, queijo coalho grelhado, mel de engenho e cebola caramelizada.', 38, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=700&auto=format&fit=crop', 4.8, h_id),
    ('Cangaço Prime', 'Blend 180g, carne de sol desfiada, queijo manteiga e maionese de coentro.', 42, 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=700&auto=format&fit=crop', 4.9, h_id),
    ('Oxente Bacon', 'Blend 180g, muito bacon crocante, cheddar inglês e barbecue artesanal.', 40, 'https://images.unsplash.com/photo-1586199141939-fbe6541547b9?q=80&w=700&auto=format&fit=crop', 4.7, h_id),
    ('Mandacaru Veg', 'Hambúrguer de grão de bico, queijo coalho, alface, tomate e molho especial.', 35, 'https://images.unsplash.com/photo-1525059696034-4767759ad7ba?q=80&w=700&auto=format&fit=crop', 5.0, h_id);

    -- Acompanhamentos
    INSERT INTO public.menu_items (name, description, price, image_url, rating, category_id) VALUES
    ('Batata Rústica', 'Porção de batata rústica com alecrim e maionese da casa.', 22, 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=700&auto=format&fit=crop', 4.7, a_id),
    ('Mandioca Frita', 'Mandioca crocante por fora, macia por dentro, com manteiga de garrafa.', 20, 'https://images.unsplash.com/photo-1518013431117-eb1465b1c2ab?q=80&w=700&auto=format&fit=crop', 4.8, a_id);

    -- Bebidas
    INSERT INTO public.menu_items (name, description, price, image_url, rating, category_id) VALUES
    ('Refrigerante Lata', 'Coca-Cola, Guaraná ou Sprite gelados — 350ml.', 7, 'https://images.unsplash.com/photo-1554866585-cd94860890b7?q=80&w=700&auto=format&fit=crop', 4.6, b_id),
    ('Suco de Caju', 'Suco natural de caju da fazenda, gelado e refrescante.', 12, 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?q=80&w=700&auto=format&fit=crop', 4.9, b_id);
END $$;
