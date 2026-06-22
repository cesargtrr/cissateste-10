
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS cost_price numeric NOT NULL DEFAULT 0;

ALTER TABLE public.adicionais
  ADD COLUMN IF NOT EXISTS cost_price numeric NOT NULL DEFAULT 0;

ALTER TABLE public.historico_estoque
  ADD COLUMN IF NOT EXISTS preco_custo_unitario numeric;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS cost_price_snapshot numeric;
