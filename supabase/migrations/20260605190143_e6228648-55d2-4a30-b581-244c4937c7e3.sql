DROP TRIGGER IF EXISTS trigger_handle_order_stock_movement ON public.orders;

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
    v_controlar BOOLEAN;
    v_is_extra BOOLEAN := false;
    v_final_id UUID := p_id;
BEGIN
    IF v_final_id IS NULL AND p_name IS NOT NULL THEN
        SELECT id INTO v_final_id
        FROM public.adicionais
        WHERE nome = p_name
           OR nome = LTRIM(p_name, '+ ')
           OR nome = REGEXP_REPLACE(p_name, '^\+?\s*\d+x\s*', '')
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
           SET quantidade_estoque = quantidade_estoque + p_qty,
               updated_at = NOW()
         WHERE id = v_final_id;
    ELSE
        UPDATE public.menu_items
           SET quantidade_estoque = quantidade_estoque + p_qty,
               updated_at = NOW()
         WHERE id = v_final_id;

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
    END IF;
END;
$function$;