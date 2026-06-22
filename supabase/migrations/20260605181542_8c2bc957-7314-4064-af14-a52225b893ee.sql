CREATE OR REPLACE FUNCTION public.apply_stock_change(p_id UUID, p_qty INTEGER, p_type TEXT, p_order_id UUID DEFAULT NULL, p_name TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
    v_controlar BOOLEAN;
    v_is_extra BOOLEAN := false;
    v_final_id UUID := p_id;
BEGIN
    -- Se não temos ID mas temos nome, tentamos achar o ID na tabela de adicionais
    IF v_final_id IS NULL AND p_name IS NOT NULL THEN
        SELECT id INTO v_final_id FROM public.adicionais WHERE nome = p_name LIMIT 1;
    END IF;

    -- Se ainda não temos ID, não há o que fazer
    IF v_final_id IS NULL THEN
        RETURN;
    END IF;

    -- Check if it's a main menu item
    SELECT controlar_estoque INTO v_controlar FROM public.menu_items WHERE id = v_final_id;
    
    -- If not found in menu_items, check in adicionais
    IF v_controlar IS NULL THEN
        SELECT controlar_estoque INTO v_controlar FROM public.adicionais WHERE id = v_final_id;
        IF v_controlar IS NOT NULL THEN
            v_is_extra := true;
        END IF;
    END IF;

    -- Only proceed if tracking is enabled
    IF v_controlar = true THEN
        IF v_is_extra THEN
            UPDATE public.adicionais
            SET quantidade_estoque = quantidade_estoque + p_qty
            WHERE id = v_final_id;
            
            INSERT INTO public.historico_estoque (produto_id, quantidade, tipo_movimentacao, order_id)
            VALUES (v_final_id, p_qty, p_type, p_order_id);
        ELSE
            UPDATE public.menu_items
            SET quantidade_estoque = quantidade_estoque + p_qty
            WHERE id = v_final_id;
            
            INSERT INTO public.historico_estoque (produto_id, quantidade, tipo_movimentacao, order_id)
            VALUES (v_final_id, p_qty, p_type, p_order_id);
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_order_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    extra_item JSONB;
    v_extra_id UUID;
    v_extra_name TEXT;
BEGIN
    -- DEDUCT STOCK: When order moves from 'pending' or 'cancelled' to a "paid/preparing" state
    -- Or when a new order is created already in a "paid/preparing" state
    IF (TG_OP = 'INSERT' AND NEW.status NOT IN ('pending', 'cancelled')) OR
       (TG_OP = 'UPDATE' AND OLD.status IN ('pending', 'cancelled') AND NEW.status NOT IN ('pending', 'cancelled')) 
    THEN
        IF NEW.stock_deducted = false THEN
            -- Main items
            FOR item IN SELECT menu_item_id, quantity, extras FROM public.order_items WHERE order_id = NEW.id LOOP
                PERFORM public.apply_stock_change(item.menu_item_id, -item.quantity, 'venda', NEW.id);
                
                -- Extras/Adicionais deduction
                IF item.extras IS NOT NULL AND jsonb_array_length(item.extras) > 0 THEN
                    FOR extra_item IN SELECT * FROM jsonb_array_elements(item.extras) LOOP
                        v_extra_id := NULL;
                        v_extra_name := extra_item->>'name';
                        
                        -- Tenta converter 'id' para UUID se ele existir
                        BEGIN
                            IF extra_item->>'id' IS NOT NULL THEN
                                v_extra_id := (extra_item->>'id')::UUID;
                            END IF;
                        EXCEPTION WHEN others THEN
                            v_extra_id := NULL;
                        END;

                        -- Passa tanto ID quanto Nome para a função de aplicação
                        PERFORM public.apply_stock_change(
                            v_extra_id, 
                            -(item.quantity * (COALESCE((extra_item->>'qty')::INTEGER, 1))), 
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

    -- RESTOCK: When order is cancelled after stock was already deducted
    IF (TG_OP = 'UPDATE' AND OLD.status NOT IN ('pending', 'cancelled') AND NEW.status = 'cancelled' AND OLD.stock_deducted = true) THEN
        FOR item IN SELECT menu_item_id, quantity, extras FROM public.order_items WHERE order_id = NEW.id LOOP
            PERFORM public.apply_stock_change(item.menu_item_id, item.quantity, 'cancelamento', NEW.id);
            
            -- Extras/Adicionais restock
            IF item.extras IS NOT NULL AND jsonb_array_length(item.extras) > 0 THEN
                FOR extra_item IN SELECT * FROM jsonb_array_elements(item.extras) LOOP
                    v_extra_id := NULL;
                    v_extra_name := extra_item->>'name';
                    
                    BEGIN
                        IF extra_item->>'id' IS NOT NULL THEN
                            v_extra_id := (extra_item->>'id')::UUID;
                        END IF;
                    EXCEPTION WHEN others THEN
                        v_extra_id := NULL;
                    END;

                    PERFORM public.apply_stock_change(
                        v_extra_id, 
                        (item.quantity * (COALESCE((extra_item->>'qty')::INTEGER, 1))), 
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
