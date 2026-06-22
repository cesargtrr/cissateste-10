-- Create customers table
CREATE TABLE public.customers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    whatsapp TEXT,
    cpf TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Grant permissions for customers
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;

-- Enable RLS for customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on customers"
ON public.customers
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Add customer_id to orders
ALTER TABLE public.orders ADD COLUMN customer_id UUID REFERENCES public.customers(id);

-- Create index for performance
CREATE INDEX idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX idx_customers_whatsapp ON public.customers(whatsapp);
CREATE INDEX idx_customers_cpf ON public.customers(cpf);

-- Update loyalty_points to potentially link to customers
-- If loyalty_points table exists and uses phone, we might want to migrate or link.
-- Let's check columns of loyalty_points first in a thought or just assume it's for legacy.
-- We'll use the orders count for the 10th order logic.
