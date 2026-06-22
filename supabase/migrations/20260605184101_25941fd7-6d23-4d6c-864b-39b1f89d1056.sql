-- 1. Remover gatilhos antigos e duplicados para limpar a lógica de estoque
DROP TRIGGER IF EXISTS trg_orders_stock_movement_ins ON public.orders;
DROP TRIGGER IF EXISTS trg_orders_stock_movement_upd ON public.orders;
DROP TRIGGER IF EXISTS on_order_completed_stock ON public.orders;
DROP TRIGGER IF EXISTS trigger_handle_order_stock_movement ON public.orders;

-- 2. Recriar a função handle_order_stock_movement com lógica robusta e universal
CREATE OR REPLACE FUNCTION public.handle_order_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    extra_item JSONB;
    v_extra_id UUID;
    v_extra_name TEXT;
    v_extra_qty INTEGER;
BEGIN
    -- Configura o search_path para segurança
    SET search_path = public;

    -- BAIXA DE ESTOQUE: Quando o pedido sai de 'pending'/'cancelled' para um estado de produção
    -- Isso cobre Delivery, Mesa e Retirada.
    IF (TG_OP = 'INSERT' AND NEW.status NOT IN ('pending', 'cancelled')) OR
       (TG_OP = 'UPDATE' AND OLD.status IN ('pending', 'cancelled') AND NEW.status NOT IN ('pending', 'cancelled'))
    THEN
        -- Só baixa se ainda não foi baixado
        IF NEW.stock_deducted = false THEN
            -- Percorre os itens do pedido
            FOR item IN SELECT menu_item_id, quantity, extras FROM public.order_items WHERE order_id = NEW.id LOOP
                -- Baixa o item principal
                IF item.menu_item_id IS NOT NULL THEN
                    PERFORM public.apply_stock_change(item.menu_item_id, -item.quantity, 'venda', NEW.id);
                END IF;

                -- Baixa os Adicionais/Ingredientes extras
                IF item.extras IS NOT NULL AND jsonb_array_length(item.extras) > 0 THEN
                    FOR extra_item IN SELECT * FROM jsonb_array_elements(item.extras) LOOP
                        v_extra_id := NULL;
                        v_extra_name := extra_item->>'name';
                        v_extra_qty := COALESCE((extra_item->>'qty')::INTEGER, 1);

                        -- Tenta extrair o ID do adicional
                        BEGIN
                            IF extra_item->>'id' IS NOT NULL THEN
                                v_extra_id := (extra_item->>'id')::UUID;
                            END IF;
                        EXCEPTION WHEN others THEN
                            v_extra_id := NULL;
                        END;

                        -- Aplica a baixa (quantidade do item * quantidade do adicional)
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
            
            -- Marca como baixado para evitar duplicidade
            NEW.stock_deducted := true;
        END IF;
    END IF;

    -- REPOSIÇÃO: Quando o pedido é cancelado e o estoque já tinha sido baixado
    IF (TG_OP = 'UPDATE' AND OLD.status NOT IN ('pending', 'cancelled') AND NEW.status = 'cancelled' AND OLD.stock_deducted = true) THEN
        FOR item IN SELECT menu_item_id, quantity, extras FROM public.order_items WHERE order_id = NEW.id LOOP
            -- Repõe item principal
            IF item.menu_item_id IS NOT NULL THEN
                PERFORM public.apply_stock_change(item.menu_item_id, item.quantity, 'cancelamento', NEW.id);
            END IF;

            -- Repõe Adicionais
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
        
        -- Marca como não baixado (repoto)
        NEW.stock_deducted := false;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Recriar o gatilho unificado
CREATE TRIGGER trigger_handle_order_stock_movement
BEFORE INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_order_stock_movement();

-- 4. Revogar permissões públicas da função de trigger para segurança
REVOKE EXECUTE ON FUNCTION public.handle_order_stock_movement() FROM public;
REVOKE EXECUTE ON FUNCTION public.handle_order_stock_movement() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_order_stock_movement() FROM authenticated;
