import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

async function assertAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: isAdmin, error } = await supabase.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });
  if (error) throw error;
  if (isAdmin !== true) throw new Error("Forbidden");
  return user.id;
}

export async function checkIsAdmin() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { isAdmin: false, isManager: false, role: null };

    const { data: isAdmin, error: adminError } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (adminError) {
      console.error("Admin role check failed:", adminError);
      return { isAdmin: false, isManager: false, role: null };
    }
    if (isAdmin === true) {
      return { isAdmin: true, isManager: true, role: "admin" };
    }

    // Some databases do not include a `manager` value in the app_role enum.
    // Manager checks must not make confirmed admins fail or crash protected pages.
    const { data: isManager, error: managerError } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "manager" as any,
    });
    if (managerError) {
      console.warn("Manager role check skipped:", managerError);
    }

    const manager = !managerError && isManager === true;
    return { 
      isAdmin: false,
      isManager: manager,
      role: manager ? "manager" : null,
    };
  } catch (error) {
    console.error("Admin permission check failed:", error);
    return { isAdmin: false, isManager: false, role: null };
  }
}


export async function adminListAll() {
  await assertAdmin();
  const [
    ordersRes,
    productsRes,
    categoriesRes,
    extrasRes,
    statsRes,
  ] = await Promise.all([
    supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: false }).limit(500),
    supabase.from("menu_items").select("*").order("name"),
    supabase.from("categories").select("*").order("name"),
    supabase.from("menu_extras").select("*").order("name"),
    supabase.from("dashboard_stats").select("*").maybeSingle(),
  ]);
  const errors = [ordersRes.error, productsRes.error, categoriesRes.error, extrasRes.error, statsRes.error].filter(Boolean);
  if (errors.length) throw errors[0];
  const orders = ordersRes.data ?? [];
  const products = productsRes.data ?? [];
  const categories = categoriesRes.data ?? [];
  const extras = extrasRes.data ?? [];
  const stats = (statsRes.data ?? {}) as any;
  return { orders, products, categories, extras, stats, items: products };
}

export async function saveMenuItem(data: any) {
  await assertAdmin();
  const payload = { ...data };
  delete payload.id;
  if (data.id) {
    const { data: res, error } = await supabase.from("menu_items").update(payload).eq("id", data.id).select().single();
    if (error) throw error;
    return res;
  } else {
    const { data: res, error } = await supabase.from("menu_items").insert(payload).select().single();
    if (error) throw error;
    return res;
  }
}

export async function deleteMenuItem(id: string) {
  await assertAdmin();
  const { error } = await supabase.from("menu_items").delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}

export async function toggleAvailable(id: string, is_available: boolean) {
  await assertAdmin();
  const { error } = await supabase.from("menu_items").update({ is_available }).eq("id", id);
  if (error) throw error;
  return { ok: true };
}

export async function saveCategory(data: any) {
  await assertAdmin();
  const payload = { ...data };
  delete payload.id;
  if (data.id) {
    const { data: res, error } = await supabase.from("categories").update(payload).eq("id", data.id).select().single();
    if (error) throw error;
    return res;
  } else {
    const { data: res, error } = await supabase.from("categories").insert(payload).select().single();
    if (error) throw error;
    return res;
  }
}

export async function deleteCategory(id: string) {
  await assertAdmin();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}

export async function listExtras() {
  const { data, error } = await supabase.from("menu_extras").select("*").order("name");
  if (error) throw error;
  return data;
}

export async function listCustomers() {
  await assertAdmin();
  const { data, error } = await supabase.from("customers").select("*").order("name");
  if (error) throw error;
  return data;
}

export async function saveCustomer(data: any) {
  await assertAdmin();
  const payload = { ...data };
  delete payload.id;
  if (data.id) {
    const { data: res, error } = await supabase.from("customers").update(payload).eq("id", data.id).select().single();
    if (error) throw error;
    return res;
  } else {
    const { data: res, error } = await supabase.from("customers").insert(payload).select().single();
    if (error) throw error;
    return res;
  }
}

export async function deleteCustomer(id: string) {
  await assertAdmin();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}

export async function getCustomerHistory(customer_id: string) {
  await assertAdmin();
  const { data: orders, error } = await supabase.from("orders").select("*").eq("customer_id", customer_id).order("created_at", { ascending: false });
  if (error) throw error;
  return orders;
}

export async function listStockOverview() {
  await assertAdmin();
  const [{ data: products }, { data: adicionais }] = await Promise.all([
    supabase.from("menu_items").select("id, name, controlar_estoque, quantidade_estoque, estoque_minimo").order("name"),
    supabase.from("adicionais").select("id, nome, controlar_estoque, quantidade_estoque, estoque_minimo").order("nome"),
  ]);
  return { products, adicionais };
}

export async function adjustStock(data: { id: string, type: 'product' | 'addition', delta: number, reason?: string }) {
  const userId = await assertAdmin();
  if (data.type === 'product') {
    const { data: item } = await supabase.from("menu_items").select("quantidade_estoque").eq("id", data.id).single();
    const newVal = (item?.quantidade_estoque || 0) + data.delta;
    await supabase.from("menu_items").update({ quantidade_estoque: newVal }).eq("id", data.id);
    await supabase.from("historico_estoque").insert({
      produto_id: data.id,
      quantidade: data.delta,
      tipo_movimentacao: data.delta > 0 ? 'entrada' : 'saida',
      responsavel_id: userId,
      motivo: data.reason
    });
  } else {
    const { data: item } = await supabase.from("adicionais").select("quantidade_estoque").eq("id", data.id).single();
    const newVal = (item?.quantidade_estoque || 0) + data.delta;
    await supabase.from("adicionais").update({ quantidade_estoque: newVal }).eq("id", data.id);
  }
  return { ok: true };
}

export async function toggleStockControl(data: { kind: 'menu' | 'adicional', id: string, enabled: boolean }) {
  await assertAdmin();
  if (data.kind === 'menu') {
    await supabase.from("menu_items").update({ controlar_estoque: data.enabled }).eq("id", data.id);
  } else {
    await supabase.from("adicionais").update({ controlar_estoque: data.enabled }).eq("id", data.id);
  }
  return { ok: true };
}

export async function updateStockSettings(data: { kind: 'menu' | 'adicional', id: string, estoque_minimo: number }) {
  await assertAdmin();
  if (data.kind === 'menu') {
    await supabase.from("menu_items").update({ estoque_minimo: data.estoque_minimo }).eq("id", data.id);
  } else {
    await supabase.from("adicionais").update({ estoque_minimo: data.estoque_minimo }).eq("id", data.id);
  }
  return { ok: true };
}

export async function listStockHistory() {
  await assertAdmin();
  const { data, error } = await supabase.from("historico_estoque").select("*, menu_items(name)").order("criado_em", { ascending: false }).limit(200);
  if (error) throw error;
  return data.map((d: any) => ({ ...d, item_name: d.menu_items?.name || 'Insumo' }));
}

export async function listAllAdicionais() {
  const { data, error } = await supabase.from("adicionais").select("*").order("nome");
  if (error) throw error;
  return data;
}

export async function getProductAdicionais(produto_id: string) {
  const { data: res, error } = await supabase.from("produto_adicionais").select("*, adicionais(*)").eq("produto_id", produto_id);
  if (error) throw error;
  return res;
}

export async function replaceProductAdicionais(produto_id: string, items: any[]) {
  await assertAdmin();
  await supabase.from("produto_adicionais").delete().eq("produto_id", produto_id);
  if (items.length > 0) {
    const rows = items.map(it => ({ produto_id, adicional_id: it.adicional_id }));
    await supabase.from("produto_adicionais").insert(rows);
  }
  return { ok: true };
}

export async function getCategoryAdicionais(category_id: string) {
  const { data: res, error } = await supabase.from("categoria_adicionais").select("adicional_id").eq("category_id", category_id);
  if (error) throw error;
  return res.map((d: any) => d.adicional_id);
}

export async function saveCategoryAdicionais(category_id: string, additional_ids: string[]) {
  await assertAdmin();
  await supabase.from("categoria_adicionais").delete().eq("category_id", category_id);
  if (additional_ids.length > 0) {
    const rows = additional_ids.map(id => ({ category_id, adicional_id: id }));
    await supabase.from("categoria_adicionais").insert(rows);
  }
  return { ok: true };
}

export async function listAdicionaisByCategory(category_id?: string) {
  let query = supabase.from("adicionais").select("*");
  if (category_id) query = query.eq("category_id", category_id);
  const { data: res, error } = await query.order("nome");
  if (error) throw error;
  return res;
}

export async function saveAdicional(data: any) {
  await assertAdmin();
  const payload = { ...data };
  delete payload.id;
  if (data.id) {
    const { data: res, error } = await supabase.from("adicionais").update(payload).eq("id", data.id).select().single();
    if (error) throw error;
    return res;
  } else {
    const { data: res, error } = await supabase.from("adicionais").insert(payload).select().single();
    if (error) throw error;
    return res;
  }
}

export async function deleteAdicional(id: string) {
  await assertAdmin();
  const { error } = await supabase.from("adicionais").delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}

export async function listHistoryOrders(filters: any) {
  await assertAdmin();
  let query = supabase.from("orders").select("*", { count: "exact" });
  if (filters.startDate) query = query.gte("created_at", filters.startDate);
  if (filters.endDate) query = query.lte("created_at", filters.endDate + 'T23:59:59');
  if (filters.search) query = query.or(`customer_name.ilike.%${filters.search}%,id.ilike.%${filters.search}%`);
  if (filters.type && filters.type !== 'all') query = query.eq("source", filters.type);
  if (filters.tableNumber && filters.tableNumber !== 'all') query = query.eq("table_number", filters.tableNumber);
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  const { data, count, error } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) throw error;
  const { data: revenueData } = await query.select("total_amount");
  const totalFilteredRevenue = (revenueData || []).reduce((sum, o) => sum + Number(o.total_amount), 0);
  return { orders: data || [], totalCount: count || 0, count: count || 0, totalFilteredRevenue, totalFilteredCount: count || 0 };
}

export async function getAdminReports() {
  await assertAdmin();
  const { data, error } = await supabase.from("dashboard_stats").select("*").maybeSingle();
  if (error) throw error;
  return data;
}

export async function listReviews() {
  await assertAdmin();
  const { data, error } = await supabase.from("reviews").select("*, orders(customer_name)").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listLoyaltyPoints() {
  await assertAdmin();
  const { data, error } = await supabase.from("loyalty_points").select("*, customers(name)").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listExpenses() {
  await assertAdmin();
  const { data, error } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false });
  if (error) throw error;
  return data;
}

export async function saveExpense(data: any) {
  await assertAdmin();
  const payload = { ...data };
  delete payload.id;
  if (data.id) {
    const { data: res, error } = await supabase.from("expenses").update(payload).eq("id", data.id).select().single();
    if (error) throw error;
    return res;
  } else {
    const { data: res, error } = await supabase.from("expenses").insert(payload).select().single();
    if (error) throw error;
    return res;
  }
}

export async function deleteExpense(id: string) {
  await assertAdmin();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}

export async function listStockItems() {
  await assertAdmin();
  const { data, error } = await supabase.from("stock_items").select("*").order("name");
  if (error) throw error;
  return data;
}

export async function saveStockItem(data: any) {
  await assertAdmin();
  const payload = { ...data };
  delete payload.id;
  if (data.id) {
    const { data: res, error } = await supabase.from("stock_items").update(payload).eq("id", data.id).select().single();
    if (error) throw error;
    return res;
  } else {
    const { data: res, error } = await supabase.from("stock_items").insert(payload).select().single();
    if (error) throw error;
    return res;
  }
}

export async function deleteStockItem(id: string) {
  await assertAdmin();
  const { error } = await supabase.from("stock_items").delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}

export async function getProductGrupos(produto_id: string) {
  const { data: res, error } = await supabase.from("produto_grupos_adicionais").select("*").eq("produto_id", produto_id);
  if (error) throw error;
  return res.map((r: any) => r.category_id);
}

export async function saveProductGrupos(produto_id: string, category_ids: string[]) {
  await assertAdmin();
  await supabase.from("produto_grupos_adicionais").delete().eq("produto_id", produto_id);
  if (category_ids.length > 0) {
    const rows = category_ids.map(id => ({ produto_id, category_id: id }));
    await supabase.from("produto_grupos_adicionais").insert(rows);
  }
  return { ok: true };
}
