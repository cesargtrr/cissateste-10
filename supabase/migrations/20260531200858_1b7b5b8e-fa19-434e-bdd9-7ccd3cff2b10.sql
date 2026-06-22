-- Tabela de turnos de caixa
CREATE TABLE public.cash_registers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    initial_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
    expected_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
    final_balance DECIMAL(12,2),
    physical_balance DECIMAL(12,2),
    opening_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    closing_time TIMESTAMP WITH TIME ZONE,
    discrepancy_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de movimentações manuais (sangria/suprimento)
CREATE TABLE public.cash_movements (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    register_id UUID NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('sangria', 'suprimento')),
    amount DECIMAL(12,2) NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Permissões
GRANT SELECT, INSERT, UPDATE ON public.cash_registers TO authenticated;
GRANT ALL ON public.cash_registers TO service_role;

GRANT SELECT, INSERT ON public.cash_movements TO authenticated;
GRANT ALL ON public.cash_movements TO service_role;

-- RLS
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver e gerenciar o caixa
CREATE POLICY "Admins can manage cash registers" 
ON public.cash_registers 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "Admins can manage cash movements" 
ON public.cash_movements 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- Trigger para updated_at
CREATE TRIGGER update_cash_registers_updated_at
BEFORE UPDATE ON public.cash_registers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
