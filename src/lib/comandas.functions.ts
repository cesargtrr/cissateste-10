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

const OPEN_STATUSES = ["pending", "preparing", "ready", "delivered"] as const;

export async function getTablesOverview() {
  await assertAdmin();

  const { data: settings } = await supabase
    .from("restaurant_settings")
    .select("total_tables")
    .limit(1)
    .maybeSingle();
  const totalTables = settings?.total_tables ?? 10;

  const { data: openOrders, error } = await supabase
    .from("orders")
    .select("id, table_number, mesa_session, total_amount, status, created_at, updated_at, customer_name, status_comanda")
    .eq("source", "mesa")
    .in("status", OPEN_STATUSES)
    .eq("status_comanda", "aberta")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const byTable = new Map<string, {
    table_number: string;
    orders_count: number;
    total: number;
    last_update: string;
    customer_name: string | null;
    mesa_sessions: string[];
  }>();
  for (const o of openOrders ?? []) {
    const raw = String(o.table_number ?? "").trim();
    const key = /^\d+$/.test(raw) ? raw.padStart(2, "0") : raw;
    if (!key) continue;
    const acc = byTable.get(key) ?? {
      table_number: key,
      orders_count: 0,
      total: 0,
      last_update: o.updated_at ?? o.created_at,
      customer_name: o.customer_name ?? null,
      mesa_sessions: [],
    };
    acc.orders_count += 1;
    acc.total += Number(o.total_amount ?? 0);
    const upd = o.updated_at ?? o.created_at;
    if (upd && upd > acc.last_update) acc.last_update = upd;
    if (o.mesa_session && !acc.mesa_sessions.includes(o.mesa_session)) {
      acc.mesa_sessions.push(o.mesa_session);
    }
    byTable.set(key, acc);
  }

  return {
    total_tables: totalTables,
    occupied: Array.from(byTable.values()),
  };
}

export async function getMesaComanda(table_number: string) {
  await assertAdmin();

  const tn = table_number.trim();
  const variants = /^\d+$/.test(tn)
    ? Array.from(new Set([tn, tn.padStart(2, "0"), String(parseInt(tn, 10))]))
    : [tn];

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, table_number, mesa_session, total_amount, status, created_at, updated_at, customer_name, payment_method, status_comanda")
    .eq("source", "mesa")
    .in("table_number", variants)
    .in("status", OPEN_STATUSES)
    .eq("status_comanda", "aberta")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const orderIds = (orders ?? []).map((o) => o.id);
  let items: any[] = [];
  if (orderIds.length > 0) {
    const { data: itemRows, error: iErr } = await supabase
      .from("order_items")
      .select("id, order_id, menu_item_id, quantity, unit_price, notes, extras, created_at")
      .in("order_id", orderIds)
      .order("created_at", { ascending: true });
    if (iErr) throw new Error(iErr.message);
    items = itemRows ?? [];
  }

  const menuIds = Array.from(
    new Set(items.map((it) => it.menu_item_id).filter(Boolean)),
  ) as string[];
  let menuMap = new Map<string, string>();
  if (menuIds.length > 0) {
    const { data: menu } = await supabase
      .from("menu_items")
      .select("id, name")
      .in("id", menuIds);
    for (const m of menu ?? []) menuMap.set(m.id, m.name);
  }

  const enrichedItems = items.map((it) => {
    const extrasTotal = Array.isArray(it.extras)
      ? it.extras.reduce(
          (a: number, e: any) => a + Number(e.price ?? 0) * Number(e.qty ?? 0),
          0,
        )
      : 0;
    const lineTotal = (Number(it.unit_price) + extrasTotal) * Number(it.quantity);
    return {
      ...it,
      name: menuMap.get(it.menu_item_id) ?? "Item",
      line_total: lineTotal,
    };
  });

  const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();
  const { data: recentCarts } = await supabase
    .from("abandoned_carts")
    .select("id, updated_at")
    .gte("updated_at", tenSecondsAgo)
    .limit(1);

  let lastActivity = orders?.[0]?.updated_at ?? orders?.[0]?.created_at ?? null;
  for (const o of orders ?? []) {
    const t = o.updated_at ?? o.created_at;
    if (t && (!lastActivity || t > lastActivity)) lastActivity = t;
  }
  for (const it of items) {
    if (it.created_at && (!lastActivity || it.created_at > lastActivity)) {
      lastActivity = it.created_at;
    }
  }

  const totalAll = enrichedItems.reduce((s, it) => s + Number(it.line_total), 0);

  return {
    table_number: table_number,
    orders: orders ?? [],
    items: enrichedItems,
    total: totalAll,
    last_activity: lastActivity,
    cart_active: (recentCarts?.length ?? 0) > 0,
  };
}

export async function removeComandaItem(item_id: string) {
  await assertAdmin();

  const { data: item, error: ie } = await supabase
    .from("order_items")
    .select("id, order_id, unit_price, quantity, extras")
    .eq("id", item_id)
    .maybeSingle();
  if (ie) throw new Error(ie.message);
  if (!item) throw new Error("Item não encontrado");

  const { error: delErr } = await supabase
    .from("order_items")
    .delete()
    .eq("id", item_id);
  if (delErr) throw new Error(delErr.message);

  const { data: remaining } = await supabase
    .from("order_items")
    .select("unit_price, quantity, extras")
    .eq("order_id", item.order_id);
  const newTotal = (remaining ?? []).reduce((s, it: any) => {
    const extras = Array.isArray(it.extras)
      ? it.extras.reduce(
          (a: number, e: any) => a + Number(e.price ?? 0) * Number(e.qty ?? 0),
          0,
        )
      : 0;
    return s + (Number(it.unit_price) + extras) * Number(it.quantity);
  }, 0);

  await supabase
    .from("orders")
    .update({ total_amount: newTotal, updated_at: new Date().toISOString() })
    .eq("id", item.order_id);

  return { ok: true };
}

export async function finalizeMesaPayment(data: {
  table_number: string;
  selected_item_ids: string[];
  payment_method: "pix" | "card" | "cash";
  customer_id?: string | null;
  discount_amount?: number;
  discount_type?: "fixed" | "percentage";
  service_fee?: number;
}) {
  await assertAdmin();

  const tn = data.table_number.trim();
  const variants = /^\d+$/.test(tn)
    ? Array.from(new Set([tn, tn.padStart(2, "0"), String(parseInt(tn, 10))]))
    : [tn];

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, total_amount, status, customer_name, mesa_session")
    .eq("source", "mesa")
    .in("table_number", variants)
    .in("status", OPEN_STATUSES);
  if (error) throw new Error(error.message);
  if (!orders || orders.length === 0) {
    throw new Error("Nenhuma comanda aberta para esta mesa.");
  }

  let totalCharged = 0;

  if (data.selected_item_ids.length === 0) {
    const subtotal = orders.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
    let finalTotal = subtotal;
    if (data.discount_type === 'percentage') {
      finalTotal -= (subtotal * ((data.discount_amount || 0) / 100));
    } else {
      finalTotal -= (data.discount_amount || 0);
    }
    finalTotal += (data.service_fee || 0);
    finalTotal = Math.max(0, finalTotal);

    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      const isLast = i === orders.length - 1;
      const updatePayload: any = {
        status: "completed",
        status_comanda: "paga",
        payment_method: data.payment_method,
        customer_id: data.customer_id || null,
        updated_at: new Date().toISOString(),
      };
      if (isLast) {
        updatePayload.discount_amount = data.discount_amount || 0;
        updatePayload.discount_type = data.discount_type || 'fixed';
        updatePayload.service_fee = data.service_fee || 0;
      }
      await supabase.from("orders").update(updatePayload).eq("id", o.id);
    }
    totalCharged = finalTotal;
  } else {
    const { data: selectedItems, error: iErr } = await supabase
      .from("order_items")
      .select("id, order_id, menu_item_id, quantity, unit_price, notes, extras")
      .in("id", data.selected_item_ids);
    if (iErr) throw new Error(iErr.message);
    if (!selectedItems || selectedItems.length === 0) {
      throw new Error("Itens selecionados não encontrados.");
    }

    const splitSubtotal = selectedItems.reduce((s, it: any) => {
      const ex = Array.isArray(it.extras)
        ? it.extras.reduce(
            (a: number, e: any) =>
              a + Number(e.price ?? 0) * Number(e.qty ?? 0),
            0,
          )
        : 0;
      return s + (Number(it.unit_price) + ex) * Number(it.quantity);
    }, 0);

    let finalSplitTotal = splitSubtotal;
    if (data.discount_type === 'percentage') {
      finalSplitTotal -= (splitSubtotal * ((data.discount_amount || 0) / 100));
    } else {
      finalSplitTotal -= (data.discount_amount || 0);
    }
    finalSplitTotal += (data.service_fee || 0);
    finalSplitTotal = Math.max(0, finalSplitTotal);

    const baseOrder = orders[0];
    const { data: split, error: sErr } = await supabase
      .from("orders")
      .insert({
        customer_name: baseOrder.customer_name ?? `Mesa ${data.table_number}`,
        customer_id: data.customer_id || null,
        source: "mesa",
        table_number: data.table_number,
        payment_method: data.payment_method,
        status: "completed",
        status_comanda: "paga",
        total_amount: finalSplitTotal,
        discount_amount: data.discount_amount || 0,
        discount_type: data.discount_type || 'fixed',
        service_fee: data.service_fee || 0,
      })
      .select("id")
      .single();
    if (sErr) throw new Error(sErr.message);

    await supabase.from("order_items").update({ order_id: split.id }).in("id", data.selected_item_ids);

    const sourceOrderIds = Array.from(new Set(selectedItems.map((i) => i.order_id)));
    for (const oid of sourceOrderIds) {
      const { data: remaining } = await supabase.from("order_items").select("unit_price, quantity, extras").eq("order_id", oid);
      if (!remaining || remaining.length === 0) {
        await supabase.from("orders").delete().eq("id", oid);
      } else {
        const newTotal = remaining.reduce((s, it: any) => {
          const ex = Array.isArray(it.extras)
            ? it.extras.reduce(
                (a: number, e: any) => a + Number(e.price ?? 0) * Number(e.qty ?? 0),
                0,
              )
            : 0;
          return s + (Number(it.unit_price) + ex) * Number(it.quantity);
        }, 0);
        await supabase.from("orders").update({ total_amount: newTotal, updated_at: new Date().toISOString() }).eq("id", oid);
      }
    }
    totalCharged = finalSplitTotal;
  }

  if (totalCharged > 0) {
    const { data: openRegister } = await supabase.from("cash_registers").select("id, expected_balance").eq("status", "open").maybeSingle();
    if (openRegister) {
      await supabase.from("cash_registers").update({
        expected_balance: Number(openRegister.expected_balance) + Number(totalCharged),
      }).eq("id", openRegister.id);
    }
  }

  return { ok: true, total_charged: totalCharged };
}
