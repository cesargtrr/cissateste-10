-- Add stock control columns to adicionais
ALTER TABLE public.adicionais
ADD COLUMN controlar_estoque BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN quantidade_estoque INTEGER NOT NULL DEFAULT 0,
ADD COLUMN estoque_minimo INTEGER NOT NULL DEFAULT 0;

-- Update the stock application function to handle both products and extras
CREATE OR REPLACE FUNCTION public.apply_stock_change(p_id UUID, p_qty INTEGER, p_type TEXT, p_order_id UUID DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
    v_controlar BOOLEAN;
    v_is_extra BOOLEAN := false;
BEGIN
    -- Check if it's a main menu item
    SELECT controlar_estoque INTO v_controlar FROM public.menu_items WHERE id = p_id;
    
    -- If not found in menu_items, check in adicionais
    IF v_controlar IS NULL THEN
        SELECT controlar_estoque INTO v_controlar FROM public.adicionais WHERE id = p_id;
        IF v_controlar IS NOT NULL THEN
            v_is_extra := true;
        END IF;
    END IF;

    -- Only proceed if tracking is enabled
    IF v_controlar = true THEN
        IF v_is_extra THEN
            UPDATE public.adicionais
            SET quantidade_estoque = quantidade_estoque + p_qty
            WHERE id = p_id;
            
            INSERT INTO public.historico_estoque (produto_id, quantidade, tipo_movimentacao, order_id)
            VALUES (p_id, p_qty, p_type, p_order_id);
        ELSE
            UPDATE public.menu_items
            SET quantidade_estoque = quantidade_estoque + p_qty
            WHERE id = p_id;
            
            INSERT INTO public.historico_estoque (produto_id, quantidade, tipo_movimentacao, order_id)
            VALUES (p_id, p_qty, p_type, p_order_id);
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update order trigger to also deduct stock for extras
CREATE OR REPLACE FUNCTION public.handle_order_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    extra_item JSONB;
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
                        -- We assume the 'id' in extras JSON corresponds to adicionais table ID
                        -- item.quantity is the count of the main product, so we multiply
                        IF extra_item->>'id' IS NOT NULL THEN
                           PERFORM public.apply_stock_change((extra_item->>'id')::UUID, -(item.quantity * (COALESCE((extra_item->>'qty')::INTEGER, 1))), 'venda', NEW.id);
                        END IF;
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
                    IF extra_item->>'id' IS NOT NULL THEN
                       PERFORM public.apply_stock_change((extra_item->>'id')::UUID, (item.quantity * (COALESCE((extra_item->>'qty')::INTEGER, 1))), 'cancelamento', NEW.id);
                    END IF;
                END LOOP;
            END IF;
        END LOOP;
        
        NEW.stock_deducted := false;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-grant access (adicionais table likely already has grants, but ensure columns are visible)
GRANT SELECT ON public.adicionais TO anon, authenticated;
GRANT ALL ON public.adicionais TO service_role;
