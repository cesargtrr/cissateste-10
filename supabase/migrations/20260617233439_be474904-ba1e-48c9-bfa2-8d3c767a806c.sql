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

REVOKE EXECUTE ON FUNCTION public.apply_stock_change(uuid, integer, text, uuid, text) FROM public, anon, authenticated;