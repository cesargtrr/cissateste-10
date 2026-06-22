ALTER TABLE public.adicionais
  ALTER COLUMN controlar_estoque SET DEFAULT true,
  ALTER COLUMN quantidade_estoque SET DEFAULT 20,
  ALTER COLUMN estoque_minimo SET DEFAULT 5;