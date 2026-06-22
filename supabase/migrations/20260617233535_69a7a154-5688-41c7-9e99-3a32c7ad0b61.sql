CREATE OR REPLACE FUNCTION public.apply_stock_for_order_item(
    p_menu_item_id uuid,
    p_quantity integer,
    p_extras jsonb,
    p_order_id uuid,
    p_multiplier integer,
    p_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    extra_item jsonb;
    v_extra_id uuid;
    v_extra_name text;
    v_extra_qty integer;
    v_qty integer := GREATEST(1, COALESCE(p_quantity, 1));
BEGIN
    IF p_menu_item_id IS NOT NULL THEN
        PERFORM public.apply_stock_change(p_menu_item_id, p_multiplier * v_qty, p_type, p_order_id);
    END IF;

    IF p_extras IS NOT NULL AND jsonb_typeof(p_extras) = 'array' AND jsonb_array_length(p_extras) > 0 THEN
        FOR extra_item IN SELECT * FROM jsonb_array_elements(p_extras) LOOP
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
                p_multiplier * v_qty * v_extra_qty,
                p_type,
                p_order_id,
                v_extra_name
            );
        END LOOP;
    END IF;
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
BEGIN
    FOR item IN
        SELECT menu_item_id, quantity, extras
        FROM public.order_items
        WHERE order_id = p_order_id
    LOOP
        PERFORM public.apply_stock_for_order_item(
            item.menu_item_id,
            item.quantity,
            item.extras,
            p_order_id,
            -1,
            'venda'
        );
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
BEGIN
    FOR item IN
        SELECT menu_item_id, quantity, extras
        FROM public.order_items
        WHERE order_id = p_order_id
    LOOP
        PERFORM public.apply_stock_for_order_item(
            item.menu_item_id,
            item.quantity,
            item.extras,
            p_order_id,
            1,
            'cancelamento'
        );
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
    ELSIF (TG_OP = 'UPDATE' AND OLD.status IN ('pending', 'cancelled') AND NEW.status NOT IN ('pending', 'cancelled') AND OLD.stock_deducted = false) THEN
        PERFORM public.deduct_stock_for_order(NEW.id);
        NEW.stock_deducted := true;
    ELSIF (TG_OP = 'UPDATE' AND OLD.status NOT IN ('pending', 'cancelled') AND NEW.status = 'cancelled' AND OLD.stock_deducted = true) THEN
        PERFORM public.restore_stock_for_order(NEW.id);
        NEW.stock_deducted := false;
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_order_item_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_old_deducted boolean := false;
    v_old_status public.order_status;
    v_new_deducted boolean := false;
    v_new_status public.order_status;
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        SELECT status, stock_deducted
          INTO v_old_status, v_old_deducted
          FROM public.orders
         WHERE id = OLD.order_id;

        IF COALESCE(v_old_deducted, false) = true AND v_old_status NOT IN ('pending', 'cancelled') THEN
            PERFORM public.apply_stock_for_order_item(
                OLD.menu_item_id,
                OLD.quantity,
                OLD.extras,
                OLD.order_id,
                1,
                'ajuste'
            );
        END IF;
    END IF;

    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        SELECT status, stock_deducted
          INTO v_new_status, v_new_deducted
          FROM public.orders
         WHERE id = NEW.order_id;

        IF COALESCE(v_new_deducted, false) = true AND v_new_status NOT IN ('pending', 'cancelled') THEN
            PERFORM public.apply_stock_for_order_item(
                NEW.menu_item_id,
                NEW.quantity,
                NEW.extras,
                NEW.order_id,
                -1,
                'venda'
            );
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_handle_order_item_stock_movement ON public.order_items;
CREATE TRIGGER trigger_handle_order_item_stock_movement
AFTER INSERT OR UPDATE OF order_id, menu_item_id, quantity, extras OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.handle_order_item_stock_movement();

REVOKE EXECUTE ON FUNCTION public.apply_stock_for_order_item(uuid, integer, jsonb, uuid, integer, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deduct_stock_for_order(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restore_stock_for_order(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_order_stock_movement() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_order_item_stock_movement() FROM public, anon, authenticated;