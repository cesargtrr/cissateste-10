-- 1. Unificar funções de estoque
DROP FUNCTION IF EXISTS public.apply_stock_change(UUID, INTEGER, TEXT, UUID);
DROP FUNCTION IF EXISTS public.apply_stock_change(UUID, INTEGER, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.apply_stock_change(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.apply_stock_change(
    p_id UUID,
    p_qty INTEGER,
    p_type TEXT,
    p_order_id UUID,
    p_name TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_controlar BOOLEAN;
    v_is_extra BOOLEAN := false;
    v_final_id UUID := p_id;
BEGIN
    -- Se não temos ID mas temos nome, tentamos achar o ID na tabela de adicionais
    IF v_final_id IS NULL AND p_name IS NOT NULL THEN
        SELECT id INTO v_final_id FROM public.adicionais 
        WHERE nome = p_name OR nome = LTRIM(p_name, '+ ') OR nome = REGEXP_REPLACE(p_name, '^\+?\s*\d+x\s*', '')
        LIMIT 1;
    END IF;

    IF v_final_id IS NULL THEN
        RETURN;
    END IF;

    SELECT controlar_estoque INTO v_controlar FROM public.menu_items WHERE id = v_final_id;

    IF v_controlar IS NULL THEN
        SELECT controlar_estoque INTO v_controlar FROM public.adicionais WHERE id = v_final_id;
        IF v_controlar IS NOT NULL THEN
            v_is_extra := true;
        END IF;
    END IF;

    IF v_controlar = true THEN
        IF v_is_extra THEN
            UPDATE public.adicionais
            SET quantidade_estoque = quantidade_estoque + p_qty,
                updated_at = NOW()
            WHERE id = v_final_id;

            INSERT INTO public.historico_estoque (produto_id, quantidade, tipo_movimentacao, order_id)
            VALUES (v_final_id, p_qty, p_type, p_order_id);
        ELSE
            UPDATE public.menu_items
            SET quantidade_estoque = quantidade_estoque + p_qty,
                updated_at = NOW()
            WHERE id = v_final_id;

            INSERT INTO public.historico_estoque (produto_id, quantidade, tipo_movimentacao, order_id)
            VALUES (v_final_id, p_qty, p_type, p_order_id);
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Garantir coluna de controle na tabela orders
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'stock_deducted') THEN
        ALTER TABLE public.orders ADD COLUMN stock_deducted BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 3. Atualizar função do Trigger
CREATE OR REPLACE FUNCTION public.handle_order_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    extra_item JSONB;
    v_extra_id UUID;
    v_extra_name TEXT;
    v_extra_qty INTEGER;
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.status NOT IN ('pending', 'cancelled')) OR
       (TG_OP = 'UPDATE' AND OLD.status IN ('pending', 'cancelled') AND NEW.status NOT IN ('pending', 'cancelled'))
    THEN
        IF NEW.stock_deducted = false THEN
            FOR item IN SELECT menu_item_id, quantity, extras FROM public.order_items WHERE order_id = NEW.id LOOP
                PERFORM public.apply_stock_change(item.menu_item_id, -item.quantity, 'venda', NEW.id);

                IF item.extras IS NOT NULL AND jsonb_array_length(item.extras) > 0 THEN
                    FOR extra_item IN SELECT * FROM jsonb_array_elements(item.extras) LOOP
                        v_extra_id := NULL;
                        v_extra_name := extra_item->>'name';
                        v_extra_qty := COALESCE((extra_item->>'qty')::INTEGER, 1);

                        BEGIN
                            IF extra_item->>'id' IS NOT NULL THEN
                                v_extra_id := (extra_item->>'id')::UUID;
                            END IF;
                        EXCEPTION WHEN others THEN
                            v_extra_id := NULL;
                        END;

                        PERFORM public.apply_stock_change(
                            v_extra_id,
                            -(item.quantity * v_extra_qty),
                            'venda',
                            NEW.id,
                            v_extra_name
                        );
                    END LOOP;
                END IF;
            END LOOP;
            
            NEW.stock_deducted := true;
        END IF;
    END IF;

    IF (TG_OP = 'UPDATE' AND OLD.status NOT IN ('pending', 'cancelled') AND NEW.status = 'cancelled' AND OLD.stock_deducted = true) THEN
        FOR item IN SELECT menu_item_id, quantity, extras FROM public.order_items WHERE order_id = NEW.id LOOP
            PERFORM public.apply_stock_change(item.menu_item_id, item.quantity, 'cancelamento', NEW.id);

            IF item.extras IS NOT NULL AND jsonb_array_length(item.extras) > 0 THEN
                FOR extra_item IN SELECT * FROM jsonb_array_elements(item.extras) LOOP
                    v_extra_id := NULL;
                    v_extra_name := extra_item->>'name';
                    v_extra_qty := COALESCE((extra_item->>'qty')::INTEGER, 1);

                    BEGIN
                        IF extra_item->>'id' IS NOT NULL THEN
                            v_extra_id := (extra_item->>'id')::UUID;
                        END IF;
                    EXCEPTION WHEN others THEN
                        v_extra_id := NULL;
                    END;

                    PERFORM public.apply_stock_change(
                        v_extra_id,
                        (item.quantity * v_extra_qty),
                        'cancelamento',
                        NEW.id,
                        v_extra_name
                    );
                END LOOP;
            END IF;
        END LOOP;
        
        NEW.stock_deducted := false;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Garantir que o trigger está habilitado
DROP TRIGGER IF EXISTS trigger_handle_order_stock_movement ON public.orders;
CREATE TRIGGER trigger_handle_order_stock_movement
BEFORE INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_order_stock_movement();
