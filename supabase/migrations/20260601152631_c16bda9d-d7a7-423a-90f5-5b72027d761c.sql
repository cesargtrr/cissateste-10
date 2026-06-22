-- Add customer_phone to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- Policy for expenses (only authenticated users can see their own? or all admins?)
-- Since this is an admin feature, we allow authenticated users (admins) to see all for now.
CREATE POLICY "Expenses are viewable by authenticated users" ON public.expenses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can insert expenses" ON public.expenses FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admins can update expenses" ON public.expenses FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can delete expenses" ON public.expenses FOR DELETE USING (auth.role() = 'authenticated');

-- Function to handle loyalty points
CREATE OR REPLACE FUNCTION public.handle_loyalty_on_order_completion()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.customer_phone IS NOT NULL) THEN
        INSERT INTO public.loyalty_points (customer_phone, customer_name, points, last_order_at)
        VALUES (NEW.customer_phone, NEW.customer_name, 1, now())
        ON CONFLICT (customer_phone)
        DO UPDATE SET 
            points = loyalty_points.points + 1,
            last_order_at = now(),
            customer_name = EXCLUDED.customer_name;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER on_order_completed_loyalty
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_loyalty_on_order_completion();
