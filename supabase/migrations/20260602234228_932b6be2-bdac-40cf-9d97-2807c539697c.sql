-- Add columns for audit tracking to historico_estoque
ALTER TABLE public.historico_estoque
ADD COLUMN responsavel_id UUID REFERENCES auth.users(id),
ADD COLUMN motivo TEXT;

-- Update existing records if any (not strictly necessary but good for consistency)
UPDATE public.historico_estoque SET motivo = split_part(tipo_movimentacao, ': ', 2) WHERE tipo_movimentacao LIKE '%: %';
UPDATE public.historico_estoque SET tipo_movimentacao = split_part(tipo_movimentacao, ': ', 1) WHERE tipo_movimentacao LIKE '%: %';

-- Ensure permissions
GRANT SELECT, INSERT ON public.historico_estoque TO authenticated;
GRANT ALL ON public.historico_estoque TO service_role;
