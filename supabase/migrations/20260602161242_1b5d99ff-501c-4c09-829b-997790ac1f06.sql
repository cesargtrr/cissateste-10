
-- 1. Add stock control columns to menu_items
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS controlar_estoque boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quantidade_estoque integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estoque_minimo integer NOT NULL DEFAULT 0;

-- Flag on orders to avoid double deduction
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stock_deducted boolean NOT NULL DEFAULT false;

-- 2. historico_estoque table
CREATE TABLE IF NOT EXISTS public.historico_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  quantidade integer NOT NULL,
  tipo_movimentacao text NOT NULL CHECK (tipo_movimentacao IN ('venda','entrada','cancelamento','ajuste')),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historico_estoque_produto ON public.historico_estoque(produto_id);
CREATE INDEX IF NOT EXISTS idx_historico_estoque_criado_em ON public.historico_estoque(criado_em DESC);

GRANT SELECT ON public.historico_estoque TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.historico_estoque TO authenticated;
GRANT ALL ON public.historico_estoque TO service_role;

ALTER TABLE public.historico_estoque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Historico estoque viewable by everyone"
  ON public.historico_estoque FOR SELECT USING (true);

CREATE POLICY "Admins manage historico estoque"
  ON public.historico_estoque FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Stock deduction / restock helper
CREATE OR REPLACE FUNCTION public.apply_stock_change(_order_id uuid, _direction int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  -- _direction: -1 = deduct (venda), +1 = restock (cancelamento)
  FOR r IN
    SELECT oi.menu_item_id, oi.quantity, mi.controlar_estoque
    FROM public.order_items oi
    JOIN public.menu_items mi ON mi.id = oi.menu_item_id
    WHERE oi.order_id = _order_id AND mi.controlar_estoque = true
  LOOP
    UPDATE public.menu_items
       SET quantidade_estoque = GREATEST(0, quantidade_estoque + (_direction * r.quantity))
     WHERE id = r.menu_item_id;

    INSERT INTO public.historico_estoque (produto_id, quantidade, tipo_movimentacao, order_id)
    VALUES (
      r.menu_item_id,
      _direction * r.quantity,
      CASE WHEN _direction < 0 THEN 'venda' ELSE 'cancelamento' END,
      _order_id
    );
  END LOOP;
END;
$$;

-- 4. Trigger function on orders
CREATE OR REPLACE FUNCTION public.handle_order_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('pending','cancelled') AND NEW.stock_deducted = false THEN
      PERFORM public.apply_stock_change(NEW.id, -1);
      NEW.stock_deducted := true;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.status NOT IN ('pending','cancelled') AND OLD.stock_deducted = false THEN
    PERFORM public.apply_stock_change(NEW.id, -1);
    NEW.stock_deducted := true;
  ELSIF NEW.status = 'cancelled' AND OLD.stock_deducted = true THEN
    PERFORM public.apply_stock_change(NEW.id, 1);
    NEW.stock_deducted := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_stock_movement_ins ON public.orders;
CREATE TRIGGER trg_orders_stock_movement_ins
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_order_stock_movement();

DROP TRIGGER IF EXISTS trg_orders_stock_movement_upd ON public.orders;
CREATE TRIGGER trg_orders_stock_movement_upd
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_order_stock_movement();
