import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const getRestaurantSettings = async () => {
  const { data, error } = await supabase
    .from("restaurant_settings")
    .select("id, total_tables, delivery_fee, default_neighborhood_fee, force_closed, limite_virada_caixa, aviso_titulo, aviso_mensagem, aviso_link, aviso_ativo")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    total_tables: data?.total_tables ?? 10,
    delivery_fee: Number((data as any)?.delivery_fee ?? 5),
    default_neighborhood_fee: Number((data as any)?.default_neighborhood_fee ?? 15),
    force_closed: Boolean((data as any)?.force_closed ?? false),
    limite_virada_caixa: String((data as any)?.limite_virada_caixa ?? "05:00").slice(0, 5),
    aviso_titulo: ((data as any)?.aviso_titulo ?? "") as string,
    aviso_mensagem: ((data as any)?.aviso_mensagem ?? "") as string,
    aviso_link: ((data as any)?.aviso_link ?? "") as string,
    aviso_ativo: Boolean((data as any)?.aviso_ativo ?? false),
    id: data?.id ?? null,
  };
};

export const updateRestaurantSettings = async (data: {
  total_tables: number;
  delivery_fee?: number;
  default_neighborhood_fee?: number;
  force_closed?: boolean;
  limite_virada_caixa?: string;
  aviso_titulo?: string | null;
  aviso_mensagem?: string | null;
  aviso_link?: string | null;
  aviso_ativo?: boolean;
}) => {
  const { data: existing } = await supabase
    .from("restaurant_settings")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const patch: Record<string, any> = {
    total_tables: data.total_tables,
    updated_at: new Date().toISOString(),
  };
  if (data.delivery_fee !== undefined) patch.delivery_fee = data.delivery_fee;
  if (data.default_neighborhood_fee !== undefined)
    patch.default_neighborhood_fee = data.default_neighborhood_fee;
  if (data.force_closed !== undefined) patch.force_closed = data.force_closed;
  if (data.limite_virada_caixa !== undefined) patch.limite_virada_caixa = data.limite_virada_caixa;
  if (data.aviso_titulo !== undefined) patch.aviso_titulo = data.aviso_titulo;
  if (data.aviso_mensagem !== undefined) patch.aviso_mensagem = data.aviso_mensagem;
  if (data.aviso_link !== undefined) patch.aviso_link = data.aviso_link;
  if (data.aviso_ativo !== undefined) patch.aviso_ativo = data.aviso_ativo;

  if (existing) {
    const { error } = await supabase
      .from("restaurant_settings")
      .update(patch as any)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("restaurant_settings")
      .insert(patch as any);
    if (error) throw new Error(error.message);
  }
  return { ok: true };
};

const orderItemSchema = z.object({
  menu_item_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(200),
  quantity: z.number().int().min(1).max(99),
  unit_price: z.number().min(0).max(100000),
  notes: z.string().max(500).nullable().optional(),
  extras: z
    .array(
      z.object({
        id: z.string().uuid().nullable().optional(),
        name: z.string().min(1).max(120),
        price: z.number().min(0).max(10000),
        qty: z.number().int().min(1).max(20),
      }),
    )
    .max(20)
    .optional(),
});

const baseOrderFields = {
  customer_name: z.string().max(120).nullable().optional(),
  customer_whatsapp: z.string().max(20).nullable().optional(),
  payment_method: z.enum(["pix", "card", "cash"]).default("pix"),
  total_amount: z.number().min(0).max(1000000),
  items: z.array(orderItemSchema).min(1).max(50),
};

const createOrderSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("mesa"),
    table_number: z.string().min(1).max(20),
    mesa_session: z.string().min(8).max(64).nullable().optional(),
    ...baseOrderFields,
  }),
  z.object({
    source: z.literal("online"), // retirada / pickup
    ...baseOrderFields,
  }),
  z.object({
    source: z.literal("delivery"),
    delivery_address: z.string().min(5).max(500),
    delivery_reference: z.string().max(300).nullable().optional(),
    delivery_fee: z.number().min(0).max(1000),
    ...baseOrderFields,
  }),
]);

export const createOrder = async (input: z.infer<typeof createOrderSchema> & { 
  payment_details?: any;
  needs_change?: boolean;
  change_for?: number;
  status_financeiro?: string;
}) => {
  const data = createOrderSchema.parse(input);

  let effectiveCustomerName = data.customer_name ?? null;
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      customer_name: effectiveCustomerName,
      customer_whatsapp: data.customer_whatsapp,
      source: data.source,
      table_number: data.source === "mesa" ? data.table_number : null,
      payment_method: data.payment_method,
      total_amount: data.total_amount,
      delivery_address: data.source === "delivery" ? data.delivery_address : null,
      delivery_reference: data.source === "delivery" ? data.delivery_reference ?? null : null,
      delivery_fee: data.source === "delivery" ? data.delivery_fee : 0,
      mesa_session: data.source === "mesa" ? data.mesa_session ?? null : null,
      status: "pending",
      payment_details: input.payment_details ?? {},
      needs_change: input.needs_change ?? false,
      change_for: input.change_for ?? 0,
      status_financeiro: input.status_financeiro ?? 'pendente'
    } as any)
    .select("id")
    .single();

  if (error || !order) throw new Error(error?.message || "Erro ao criar pedido");

  const rows = data.items.map((i) => ({
    order_id: order.id,
    menu_item_id: i.menu_item_id ?? null,
    quantity: i.quantity,
    unit_price: i.unit_price,
    notes: i.notes ?? null,
    extras: (i.extras ?? []) as any,
  }));

  const { error: iErr } = await supabase
    .from("order_items")
    .insert(rows as any);

  if (iErr) {
    await supabase.from("orders").delete().eq("id", order.id);
    throw new Error(iErr.message);
  }

  return { id: order.id };
};

export const listNeighborhoods = async () => {
  const { data, error } = await supabase
    .from("delivery_neighborhoods")
    .select("id, name, fee")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((n: any) => ({
    id: n.id as string,
    name: n.name as string,
    fee: Number(n.fee ?? 0),
  }));
};

export const upsertNeighborhood = async (data: {
  id?: string;
  name: string;
  fee: number;
}) => {
  if (data.id) {
    const { error } = await supabase
      .from("delivery_neighborhoods")
      .update({ name: data.name, fee: data.fee, updated_at: new Date().toISOString() } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("delivery_neighborhoods")
      .insert({ name: data.name, fee: data.fee } as any);
    if (error) throw new Error(error.message);
  }
  return { ok: true };
};

export const deleteNeighborhood = async (id: string) => {
  const { error } = await supabase
    .from("delivery_neighborhoods")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
};
