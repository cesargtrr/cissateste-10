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
}

export async function getOrderTracking(id: string) {
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, status, source, total_amount, delivery_fee, created_at, updated_at, customer_name, table_number, mesa_session, delivery_address, delivery_reference, customer_phone, payment_method, delivery_driver_id, delivery_status, status_financeiro"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) return null;
  return order;
}

export async function getMesaSessionOrders(mesa_session: string) {
  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      "id, status, source, total_amount, created_at, updated_at, customer_name, table_number, mesa_session",
    )
    .eq("mesa_session", mesa_session)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const ids = (orders ?? []).map((o) => o.id);
  let items: any[] = [];
  if (ids.length > 0) {
    const { data: itemRows, error: iErr } = await supabase
      .from("order_items")
      .select("id, order_id, quantity, unit_price, notes, extras, menu_item_id")
      .in("order_id", ids);
    if (iErr) throw new Error(iErr.message);
    items = itemRows ?? [];
  }
  return { orders: orders ?? [], items };
}

export async function findOrderByCode(code_raw: string) {
  const code = code_raw.toLowerCase().replace(/-/g, "");
  if (code.length === 32) {
    const formatted = `${code.slice(0, 8)}-${code.slice(8, 12)}-${code.slice(12, 16)}-${code.slice(16, 20)}-${code.slice(20)}`;
    const { data: order } = await supabase
      .from("orders")
      .select("id")
      .eq("id", formatted)
      .maybeSingle();
    return order?.id ?? null;
  }
  if (!/^[a-f0-9]+$/.test(code) || code.length > 32) return null;
  const pad = (ch: string) => code + ch.repeat(32 - code.length);
  const toUuid = (hex: string) =>
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  const min = toUuid(pad("0"));
  const max = toUuid(pad("f"));
  const { data: rows } = await supabase
    .from("orders")
    .select("id, created_at")
    .gte("id", min)
    .lte("id", max)
    .order("created_at", { ascending: false })
    .limit(1);
  return rows?.[0]?.id ?? null;
}

export async function updateOrderStatus(data: {
  id: string;
  status: "pending" | "preparing" | "ready" | "delivered" | "cancelled" | "completed";
  payment_method?: "pix" | "card" | "cash";
}) {
  await assertAdmin();

  const { data: oldOrder, error: fetchErr } = await supabase
    .from("orders")
    .select("status, source, prepared_at")
    .eq("id", data.id)
    .single();
  
  if (fetchErr) throw new Error(fetchErr.message);

  const FLOW = ["pending", "preparing", "ready", "delivered", "completed"];
  const oldIdx = FLOW.indexOf(oldOrder.status);
  const newIdx = FLOW.indexOf(data.status);
  const isCancellation = data.status === "cancelled";
  const wasTerminal = oldOrder.status === "completed" || oldOrder.status === "cancelled";
  if (!isCancellation && oldIdx >= 0 && newIdx >= 0 && newIdx < oldIdx) {
    throw new Error("Não é permitido regredir o status do pedido.");
  }
  if (wasTerminal && data.status !== oldOrder.status) {
    throw new Error("Pedido finalizado não pode ter o status alterado.");
  }
  if ((data.status === "delivered" || data.status === "ready") && oldOrder.source === "mesa") {
    if (data.status === "delivered") {
      throw new Error("Status 'Rota de Entrega' não se aplica a pedidos de mesa.");
    }
  }
  if (oldOrder.source === "mesa" && data.status === "completed") {
    throw new Error(
      "Pedidos de mesa só podem ser finalizados pelo Gestor de Comandas, ao receber o pagamento.",
    );
  }

  const patch: Record<string, any> = {
    status: data.status,
    updated_at: new Date().toISOString(),
  };
  if (data.status === "ready" && !oldOrder.prepared_at) {
    patch.prepared_at = new Date().toISOString();
  }
  if (data.payment_method) patch.payment_method = data.payment_method;

  const { error } = await supabase
    .from("orders")
    .update(patch as any)
    .eq("id", data.id);
  if (error) throw new Error(error.message);

  return { ok: true };
}

export async function createAdminOrder(data: {
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  payment_method?: "pix" | "card" | "cash";
  total_amount: number;
  items: Array<{
    menu_item_id: string;
    menu_item_name: string;
    quantity: number;
    unit_price: number;
    notes?: string;
    extras?: any[];
  }>;
}) {
  await assertAdmin();

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      customer_id: data.customer_id,
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      payment_method: data.payment_method ?? "pix",
      total_amount: data.total_amount,
      status: "pending",
      source: "pos",
    })
    .select("id")
    .single();

  if (orderErr) throw new Error(orderErr.message);

  const orderItems = data.items.map(it => ({
    order_id: order.id,
    menu_item_id: it.menu_item_id,
    quantity: it.quantity,
    unit_price: it.unit_price,
    notes: it.notes,
    extras: it.extras,
  }));

  const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
  if (itemsErr) throw new Error(itemsErr.message);

  return { id: order.id };
}
