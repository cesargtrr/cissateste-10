DROP TRIGGER IF EXISTS trigger_handle_order_stock_movement ON public.orders;
DROP TRIGGER IF EXISTS trg_orders_stock_movement_ins ON public.orders;
DROP TRIGGER IF EXISTS trg_orders_stock_movement_upd ON public.orders;
DROP TRIGGER IF EXISTS on_order_completed_stock ON public.orders;

CREATE OR REPLACE FUNCTION public.apply_stock_change(
    p_id uuid,
    p_qty integer,
    p_type text,
    p_order_id uuid,
    p_name text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_controlar boolean;
    v_is_extra boolean := false;
    v_final_id uuid := p_id;
BEGIN
    IF v_final_id IS NULL AND p_name IS NOT NULL THEN
        SELECT id INTO v_final_id
        FROM public.adicionais
        WHERE lower(trim(nome)) = lower(trim(p_name))
           OR lower(trim(nome)) = lower(trim(ltrim(p_name, '+ ')))
           OR lower(trim(nome)) = lower(trim(regexp_replace(p_name, '^\+?\s*\d+x\s*', '')))
        ORDER BY updated_at DESC
        LIMIT 1;
    END IF;

    IF v_final_id IS NULL THEN
        RETURN;
    END IF;

    SELECT controlar_estoque
      INTO v_controlar
      FROM public.menu_items
     WHERE id = v_final_id;

    IF v_controlar IS NULL THEN
        SELECT controlar_estoque
          INTO v_controlar
          FROM public.adicionais
         WHERE id = v_final_id;

        IF v_controlar IS NOT NULL THEN
            v_is_extra := true;
        END IF;
    END IF;

    IF COALESCE(v_controlar, false) IS NOT TRUE THEN
        RETURN;
    END IF;

    IF v_is_extra THEN
        UPDATE public.adicionais
           SET quantidade_estoque = GREATEST(0, quantidade_estoque + p_qty),
               updated_at = now()
         WHERE id = v_final_id;
    ELSE
        UPDATE public.menu_items
           SET quantidade_estoque = GREATEST(0, quantidade_estoque + p_qty),
               updated_at = now()
         WHERE id = v_final_id;
    END IF;

    INSERT INTO public.historico_estoque (
        produto_id,
        quantidade,
        tipo_movimentacao,
        order_id
    )
    VALUES (
        v_final_id,
        p_qty,
        p_type,
        p_order_id
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.deduct_stock_for_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    item record;
    extra_item jsonb;
    v_extra_id uuid;
    v_extra_name text;
    v_extra_qty integer;
BEGIN
    FOR item IN
        SELECT menu_item_id, quantity, extras
        FROM public.order_items
        WHERE order_id = p_order_id
    LOOP
        IF item.menu_item_id IS NOT NULL THEN
            PERFORM public.apply_stock_change(item.menu_item_id, -item.quantity, 'venda', p_order_id);
        END IF;

        IF item.extras IS NOT NULL AND jsonb_typeof(item.extras) = 'array' AND jsonb_array_length(item.extras) > 0 THEN
            FOR extra_item IN SELECT * FROM jsonb_array_elements(item.extras) LOOP
                v_extra_id := NULL;
                v_extra_name := extra_item->>'name';
                v_extra_qty := GREATEST(1, COALESCE(NULLIF(extra_item->>'qty', '')::integer, 1));

                BEGIN
                    IF extra_item->>'id' IS NOT NULL AND extra_item->>'id' <> '' THEN
                        v_extra_id := (extra_item->>'id')::uuid;
                    END IF;
                EXCEPTION WHEN others THEN
                    v_extra_id := NULL;
                END;

                PERFORM public.apply_stock_change(
                    v_extra_id,
                    -(item.quantity * v_extra_qty),
                    'venda',
                    p_order_id,
                    v_extra_name
                );
            END LOOP;
        END IF;
    END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_stock_for_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    item record;
    extra_item jsonb;
    v_extra_id uuid;
    v_extra_name text;
    v_extra_qty integer;
BEGIN
    FOR item IN
        SELECT menu_item_id, quantity, extras
        FROM public.order_items
        WHERE order_id = p_order_id
    LOOP
        IF item.menu_item_id IS NOT NULL THEN
            PERFORM public.apply_stock_change(item.menu_item_id, item.quantity, 'cancelamento', p_order_id);
        END IF;

        IF item.extras IS NOT NULL AND jsonb_typeof(item.extras) = 'array' AND jsonb_array_length(item.extras) > 0 THEN
            FOR extra_item IN SELECT * FROM jsonb_array_elements(item.extras) LOOP
                v_extra_id := NULL;
                v_extra_name := extra_item->>'name';
                v_extra_qty := GREATEST(1, COALESCE(NULLIF(extra_item->>'qty', '')::integer, 1));

                BEGIN
                    IF extra_item->>'id' IS NOT NULL AND extra_item->>'id' <> '' THEN
                        v_extra_id := (extra_item->>'id')::uuid;
                    END IF;
                EXCEPTION WHEN others THEN
                    v_extra_id := NULL;
                END;

                PERFORM public.apply_stock_change(
                    v_extra_id,
                    item.quantity * v_extra_qty,
                    'cancelamento',
                    p_order_id,
                    v_extra_name
                );
            END LOOP;
        END IF;
    END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_order_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.status NOT IN ('pending', 'cancelled') AND NEW.stock_deducted = false) THEN
        NEW.stock_deducted := true;
        RETURN NEW;
    END IF;

    IF (TG_OP = 'UPDATE' AND OLD.status IN ('pending', 'cancelled') AND NEW.status NOT IN ('pending', 'cancelled') AND OLD.stock_deducted = false) THEN
        PERFORM public.deduct_stock_for_order(NEW.id);
        NEW.stock_deducted := true;
    ELSIF (TG_OP = 'UPDATE' AND OLD.status NOT IN ('pending', 'cancelled') AND NEW.status = 'cancelled' AND OLD.stock_deducted = true) THEN
        PERFORM public.restore_stock_for_order(NEW.id);
        NEW.stock_deducted := false;
    END IF;

    RETURN NEW;
END;
$function$;

CREATE TRIGGER trigger_handle_order_stock_movement
BEFORE INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_order_stock_movement();

REVOKE EXECUTE ON FUNCTION public.apply_stock_change(uuid, integer, text, uuid, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deduct_stock_for_order(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restore_stock_for_order(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_order_stock_movement() FROM public, anon, authenticated;