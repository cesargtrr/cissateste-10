import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const getMenuData = async () => {
  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase.from("categories").select("*").eq("tipo", "produto").order("name"),
    supabase.from("menu_items").select("*, categories(name, tipo)").eq("is_available", true).order("name"),
  ]);

  return {
    categories: categories || [],
    items: items || [],
  };
};

export const getFeaturedItems = async () => {
  const { data: items } = await supabase
    .from("menu_items")
    .select("*, categories!inner(name)")
    .eq("is_available", true)
    .eq("categories.name", "Hambúrgueres")
    .order("rating", { ascending: false })
    .limit(3);

  return items || [];
};

export const getMenuItemExtras = async (data: { menu_item_id: string }) => {
  const { data: grupoLinks } = await supabase
    .from("produto_grupos_adicionais")
    .select("category_id")
    .eq("produto_id", data.menu_item_id);
    
  const grupoIds = (grupoLinks ?? []).map((g: any) => g.category_id as string);
  
  if (grupoIds.length > 0) {
    const { data: items } = await supabase
      .from("adicionais")
      .select("id, nome, preco, controlar_estoque, quantidade_estoque, estoque_minimo")
      .in("category_id", grupoIds)
      .order("nome");
    if (items && items.length > 0) {
      return items.map((a: any) => ({
        id: a.id,
        name: a.nome,
        price: a.preco,
        controlar_estoque: !!a.controlar_estoque,
        quantidade_estoque: Number(a.quantidade_estoque ?? 0),
        estoque_minimo: Number(a.estoque_minimo ?? 0),
        sort_order: 0,
      }));
    }
  }

  const { data: prod } = await supabase
    .from("menu_items")
    .select("category_id")
    .eq("id", data.menu_item_id)
    .maybeSingle();

  if (prod?.category_id) {
    const { data: catRows } = await supabase
      .from("categoria_adicionais")
      .select("adicionais(id, nome, preco, controlar_estoque, quantidade_estoque, estoque_minimo)")
      .eq("category_id", prod.category_id);

    if (catRows && catRows.length > 0) {
      return catRows
        .map((r: any) => r.adicionais)
        .filter(Boolean)
        .map((a: any) => ({
          id: a.id,
          name: a.nome,
          price: a.preco,
          controlar_estoque: !!a.controlar_estoque,
          quantidade_estoque: Number(a.quantidade_estoque ?? 0),
          estoque_minimo: Number(a.estoque_minimo ?? 0),
          sort_order: 0,
        }));
    }
  }

  const { data: rows, error } = await supabase
    .from("menu_extras")
    .select("id, name, price, sort_order")
    .eq("menu_item_id", data.menu_item_id)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return rows || [];
};
