-- Add sector to categories
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS sector TEXT DEFAULT 'Cozinha';

-- Stock Items
CREATE TABLE IF NOT EXISTS public.stock_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    unit TEXT NOT NULL, -- kg, g, un, l, ml
    quantity NUMERIC NOT NULL DEFAULT 0,
    min_quantity NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Menu Item Ingredients (Recipe)
CREATE TABLE IF NOT EXISTS public.menu_item_ingredients (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE CASCADE,
    stock_item_id UUID REFERENCES public.stock_items(id) ON DELETE CASCADE,
    quantity NUMERIC NOT NULL, -- quantity of stock_item per menu_item
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Loyalty Program
CREATE TABLE IF NOT EXISTS public.loyalty_points (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_phone TEXT UNIQUE NOT NULL,
    customer_name TEXT,
    points INTEGER DEFAULT 0,
    last_order_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Reviews
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE UNIQUE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Expenses
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    category TEXT NOT NULL, -- aluguel, luz, insumos, etc.
    expense_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT ON public.stock_items TO anon, authenticated;
GRANT ALL ON public.stock_items TO service_role;

GRANT SELECT ON public.menu_item_ingredients TO anon, authenticated;
GRANT ALL ON public.menu_item_ingredients TO service_role;

GRANT SELECT, INSERT ON public.loyalty_points TO anon, authenticated;
GRANT ALL ON public.loyalty_points TO service_role;

GRANT SELECT, INSERT ON public.reviews TO anon, authenticated;
GRANT ALL ON public.reviews TO service_role;

GRANT SELECT ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

-- Policies
CREATE POLICY "Stock items are viewable by everyone" ON public.stock_items FOR SELECT USING (true);
CREATE POLICY "Menu ingredients are viewable by everyone" ON public.menu_item_ingredients FOR SELECT USING (true);
CREATE POLICY "Loyalty points are viewable by everyone" ON public.loyalty_points FOR SELECT USING (true);
CREATE POLICY "Reviews are viewable by everyone" ON public.reviews FOR SELECT USING (true);

-- Function to deduct stock when order is completed
CREATE OR REPLACE FUNCTION public.handle_stock_on_order_completion()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.status = 'completed' AND OLD.status != 'completed') THEN
        -- Deduct stock for each item in the order
        UPDATE public.stock_items
        SET quantity = stock_items.quantity - (oi.quantity * mii.quantity)
        FROM public.order_items oi
        JOIN public.menu_item_ingredients mii ON oi.menu_item_id = mii.menu_item_id
        WHERE oi.order_id = NEW.id AND stock_items.id = mii.stock_item_id;

        -- Update loyalty points (simple: 1 order = 1 point)
        -- We assume phone number is stored somewhere or we need it in orders.
        -- Let's check if 'customer_phone' exists in orders.
        -- If it doesn't, we might need to add it or skip this part.
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER on_order_completed_stock
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_stock_on_order_completion();
