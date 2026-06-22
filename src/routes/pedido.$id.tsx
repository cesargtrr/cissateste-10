import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChefHat, Bike, ShoppingBag, Loader2, XCircle, ArrowLeft, Plus, Utensils, PackageCheck, Truck, Inbox } from "lucide-react";
import { getOrderTracking, getMesaSessionOrders } from "@/lib/orders.functions";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/cart-store";
import { saveOrder, getSavedOrders, setActiveOrderId, clearActiveOrderId } from "@/lib/order-history";
import { setServiceMode } from "@/lib/service-mode-store";
import { LiveDeliveryMap } from "@/components/oxente/LiveDeliveryMap";
import type { DriverLocationPoint, GeoPoint } from "@/lib/geo-tracking";

export const Route = createFileRoute("/pedido/$id")({
  head: () => ({
    meta: [
      { title: "Status do Pedido — Oxente Burguer" },
      { name: "description", content: "Acompanhe o status do seu pedido em tempo real." },
    ],
  }),
  component: TrackingPage,
});

type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled"
  | "completed";

function TrackingPage() {
  const { id } = Route.useParams();
  const [liveStatus, setLiveStatus] = useState<OrderStatus | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["order-tracking", id],
    queryFn: () => getOrderTracking(id),
    refetchOnWindowFocus: true,
    // Polling fallback: Realtime postgres_changes is gated by RLS on the
    // subscriber's role. Anonymous customers don't have a SELECT policy on
    // `orders`, so realtime events may never reach them. Poll every 3s to
    // guarantee the status reflects admin updates within seconds.
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
  });

  const mesaSession = (data as any)?.mesa_session as string | null | undefined;
  const isMesa = data?.source === "mesa" && !!mesaSession;

  // Fetch sibling orders sharing the same mesa_session (only for mesa orders)
  const { data: mesaData, refetch: refetchMesa } = useQuery({
    queryKey: ["mesa-session", mesaSession],
    queryFn: () => getMesaSessionOrders(mesaSession!),
    enabled: !!mesaSession,
    refetchOnWindowFocus: true,
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
  });

  // The order being shown at the top — defaults to the URL one, but the user
  // can switch by clicking another order in the comanda list.
  const activeOrderId = selectedOrderId ?? id;
  const activeOrder = (() => {
    if (activeOrderId === id) return data as any;
    return (mesaData?.orders.find((o: any) => o.id === activeOrderId) ?? null) as any;
  })();

  // Persist on first successful load
  useEffect(() => {
    if (data?.id) {
      const known = getSavedOrders().find((o) => o.id === data.id);
      if (!known) {
        saveOrder({
          id: data.id,
          createdAt: data.created_at as any,
          total: Number(data.total_amount),
        });
      }
      // Track this as the user's active order; clear once it's terminal.
      const st = data.status as string | undefined;
      if (st === "completed" || st === "cancelled") {
        clearActiveOrderId();
      } else {
        setActiveOrderId(data.id);
      }
    }
  }, [data?.id, data?.status]);

  // Supabase Realtime subscription
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`order-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const newStatus = (payload.new as any)?.status as OrderStatus;
          if (newStatus) {
            setLiveStatus(newStatus);
            refetch();
            refetchMesa();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, refetch, refetchMesa]);

  // Realtime subscription on the whole mesa_session so new orders added to the
  // same comanda appear automatically.
  useEffect(() => {
    if (!mesaSession) return;
    const ch = supabase
      .channel(`mesa-${mesaSession}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `mesa_session=eq.${mesaSession}` },
        () => {
          refetchMesa();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [mesaSession, refetchMesa]);

  const status: OrderStatus | null =
    activeOrderId === id
      ? ((liveStatus ?? (data?.status as OrderStatus | undefined)) ?? null)
      : ((activeOrder?.status as OrderStatus | undefined) ?? null);
  const isDelivery =
    (activeOrder?.source ?? data?.source) === "delivery" ||
    ((activeOrder?.source ?? data?.source) === "online" && !!(activeOrder?.delivery_address ?? data?.delivery_address));
  // Treat any order tied to a table/comanda as a mesa order for the stepper,
  // even if `source` is missing or stale.
  const isMesaOrder =
    activeOrder?.source === "mesa" ||
    !!activeOrder?.table_number ||
    !!(activeOrder as any)?.mesa_session ||
    data?.source === "mesa" ||
    !!data?.table_number ||
    !!(data as any)?.mesa_session;

  const steps = isMesaOrder
    ? [
        { key: "pending", label: "Pedido Recebido", Icon: CheckCircle2 },
        { key: "preparing", label: "Em Preparo", Icon: ChefHat },
        { key: "ready", label: "Pronto para Mesa", Icon: Utensils },
        { key: "completed", label: "Concluído", Icon: CheckCircle2 },
      ]
    : [
        { key: "pending", label: "Pedido Recebido", Icon: CheckCircle2 },
        { key: "preparing", label: "Em Preparo", Icon: ChefHat },
        {
          key: "delivered",
          label: isDelivery ? "Saiu para Entrega" : "Pronto para Retirada",
          Icon: isDelivery ? Bike : ShoppingBag,
        },
        { key: "completed", label: "Concluído", Icon: CheckCircle2 },
      ];

  const stepIndex = (() => {
    if (!status) return -1;
    if (status === "cancelled") return -1;
    const idx = steps.findIndex((s) => s.key === status);
    if (idx >= 0) return idx;
    // Fallback: map unknown statuses to nearest known step
    if (status === "ready" && !isMesaOrder) return 2;
    if (status === "delivered" && isMesaOrder) return 2;
    return -1;
  })();

  const supportingMessage =
    isMesaOrder && status === "ready"
      ? "Seu pedido já está pronto e a caminho da sua mesa! Bom apetite!"
      : isMesaOrder && status === "delivered"
        ? "Entregue na mesa. Bom apetite!"
        : "Esta página atualiza automaticamente quando o status muda.";

  // Detect when the whole comanda is finished. For mesa orders, all sibling
  // orders must be completed (or cancelled). For non-mesa, just this order.
  const allFinished = useMemo(() => {
    const isFinal = (s: string | undefined | null) =>
      s === "completed" || s === "cancelled";
    if (isMesa && mesaData?.orders?.length) {
      const anyCompleted = mesaData.orders.some((o: any) => o.status === "completed");
      return anyCompleted && mesaData.orders.every((o: any) => isFinal(o.status));
    }
    return isFinal(status) && status === "completed";
  }, [isMesa, mesaData, status]);

  // 60s countdown → wipe client storage and redirect home.
  useEffect(() => {
    if (!allFinished) {
      setSecondsLeft(null);
      return;
    }
    setSecondsLeft(60);
    const interval = setInterval(() => {
      setSecondsLeft((s) => (s === null ? null : Math.max(0, s - 1)));
    }, 1000);
    const timeout = setTimeout(() => {
      try {
        clearActiveOrderId();
        setServiceMode(null);
        if (typeof window !== "undefined") {
          try { localStorage.removeItem("oxente-cart-v1"); } catch {}
          try { localStorage.removeItem("oxente-orders-v1"); } catch {}
          try { sessionStorage.clear(); } catch {}
          // Best-effort cookie wipe for current path
          try {
            document.cookie.split(";").forEach((c) => {
              const name = c.split("=")[0].trim();
              if (name) {
                document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
              }
            });
          } catch {}
        }
      } finally {
        if (typeof window !== "undefined") {
          window.location.replace("/");
        }
      }
    }, 60_000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [allFinished]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-[#E7D3B1]">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF7A00]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#E7D3B1] flex items-center justify-center px-4">
        <div className="max-w-md text-center bg-[#121212] border border-[#3A2414] rounded-2xl p-8">
          <XCircle className="w-12 h-12 text-[#FF7A00] mx-auto" />
          <h1 className="text-xl font-bold mt-4">Pedido não encontrado</h1>
          <p className="text-sm text-[#A3A3A3] mt-2">
            Verifique o link e tente novamente.
          </p>
          <Link
            to="/cardapio"
            className="inline-flex items-center gap-2 mt-6 bg-[#FF7A00] text-[#0a0a0a] font-bold px-4 py-2 rounded-full text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Ir ao cardápio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#E7D3B1]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link
          to="/cardapio"
          className="inline-flex items-center gap-1 text-sm text-[#FF7A00] hover:text-[#D4A15A] mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao cardápio
        </Link>

        <div className="bg-[#121212] border border-[#3A2414] rounded-2xl p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-[#A3A3A3]">
                Pedido
              </p>
              <h1 className="text-2xl font-bold text-[#E7D3B1] mt-1">
                #{(activeOrder?.id ?? data.id).slice(0, 8).toUpperCase()}
              </h1>
              {(activeOrder?.customer_name ?? data.customer_name) && (
                <p className="text-sm text-[#A3A3A3] mt-1">
                  Cliente: <span className="text-[#E7D3B1]">{activeOrder?.customer_name ?? data.customer_name}</span>
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-[#A3A3A3]">Total</p>
              <p className="text-2xl font-bold text-[#FF7A00]">
                {formatBRL(Number(activeOrder?.total_amount ?? data.total_amount))}
              </p>
            </div>
          </div>

          {status === "cancelled" && (
            <div className="mt-6 bg-red-500/10 border border-red-500/40 rounded-xl p-5 text-center">
              <XCircle className="w-10 h-10 text-red-500 mx-auto" />
              <p className="font-bold mt-2 text-red-300">Pedido cancelado</p>
              <p className="text-xs text-[#A3A3A3] mt-1">
                Entre em contato com o restaurante para mais informações.
              </p>
            </div>
          )}

          {(activeOrder?.status_financeiro ?? (data as any)?.status_financeiro) === "aguardando_pagamento" && status !== "cancelled" && (
            <div className="mt-6 bg-amber-500/10 border border-amber-500/40 rounded-xl p-4">
              <p className="text-sm text-amber-200">
                🟡 Pagamento sendo confirmado pela loja.
              </p>
            </div>
          )}

          {(activeOrder?.status_financeiro ?? (data as any)?.status_financeiro) === "pagamento_rejeitado" && status !== "cancelled" && (
            <div className="mt-6 bg-red-500/10 border border-red-500/40 rounded-xl p-5">
              <p className="font-bold text-red-300 text-lg">⚠️ Pagamento não localizado</p>
              <p className="text-sm text-[#D4A15A] mt-2">
                Seu pagamento não foi localizado. Caso já tenha efetuado, entre em contato conosco.
              </p>
            </div>
          )}

          {!isDelivery && status !== "cancelled" && (
            <div className="mt-6">
              {/* Stepper */}
              <div className="relative">
                <div className="absolute top-5 left-5 right-5 h-0.5 bg-[#3A2414]" />
                <div
                  className="absolute top-5 left-5 h-0.5 bg-[#FF7A00] transition-all duration-700"
                  style={{
                    width:
                      stepIndex <= 0
                        ? "0%"
                        : `calc(${(stepIndex / (steps.length - 1)) * 100}% - ${(stepIndex / (steps.length - 1)) * 40}px)`,
                  }}
                />
                <ol className="relative grid grid-cols-4 gap-2">
                  {steps.map((s, i) => {
                    const reached = stepIndex >= i;
                    const current = stepIndex === i;
                    return (
                      <li key={s.key} className="flex flex-col items-center text-center">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                            reached
                              ? "bg-[#FF7A00] border-[#FF7A00] text-[#0a0a0a]"
                              : "bg-[#0a0a0a] border-[#3A2414] text-[#5a5a5a]"
                          } ${current ? "ring-4 ring-[#FF7A00]/30 animate-pulse" : ""}`}
                        >
                          <s.Icon className="w-5 h-5" />
                        </div>
                        <p
                          className={`mt-2 text-[10px] md:text-xs uppercase tracking-wider font-bold ${
                            reached ? "text-[#E7D3B1]" : "text-[#5a5a5a]"
                          }`}
                        >
                          {s.label}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {allFinished ? (
                <div className="mt-6 bg-[#0a0a0a] border border-[#FF7A00]/40 rounded-xl p-6 text-center">
                  <CheckCircle2 className="w-10 h-10 text-[#FF7A00] mx-auto" />
                  <p className="text-xl font-bold text-[#FF7A00] mt-2">
                    Atendimento Finalizado!
                  </p>
                  <p className="text-sm text-[#E7D3B1] mt-2">
                    Obrigado pela preferência
                    {data?.customer_name ? `, ${data.customer_name}` : ""}! Volte sempre.
                  </p>
                  {secondsLeft !== null && (
                    <p className="text-xs text-[#A3A3A3] mt-3">
                      Esta página será fechada automaticamente em
                      {" "}
                      <span className="font-mono text-[#FF7A00]">
                        00:{String(secondsLeft).padStart(2, "0")}
                      </span>
                      ...
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-6 bg-[#0a0a0a] border border-[#3A2414] rounded-xl p-5 text-center">
                  <p className="text-xs uppercase tracking-wider text-[#A3A3A3]">
                    Status atual
                  </p>
                  <p className="text-xl font-bold text-[#FF7A00] mt-1">
                    {steps[Math.max(0, stepIndex)].label}
                  </p>
                  <p className="text-xs text-[#A3A3A3] mt-2">
                    {supportingMessage}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 text-[10px] text-[#5a5a5a] text-center">
            Salve este link para acompanhar seu pedido a qualquer momento.
          </div>
        </div>

        {isDelivery && (
          <DeliveryTracking
            orderId={data.id}
            order={data as any}
          />
        )}

        {isMesa && mesaData && mesaData.orders.length > 0 && (
          <div className="mt-6 bg-[#121212] border border-[#3A2414] rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Utensils className="w-5 h-5 text-[#FF7A00]" />
              <h2 className="text-lg font-bold">
                Comanda da Mesa {data?.table_number ?? ""}
              </h2>
            </div>
            <ul className="divide-y divide-[#3A2414]">
              {mesaData.orders.map((o: any) => {
                const orderItems = mesaData.items.filter((it: any) => it.order_id === o.id);
                const isCurrent = o.id === activeOrderId;
                const st = String(o.status);
                const tag =
                  st === "pending"
                    ? { label: "Na fila", cls: "bg-yellow-500/15 text-yellow-300 border-yellow-500/40" }
                    : st === "preparing"
                      ? { label: "Em Preparo", cls: "bg-[#FF7A00]/15 text-[#FF7A00] border-[#FF7A00]/40" }
                      : st === "ready"
                        ? { label: "Pronto para a Mesa", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" }
                        : st === "delivered"
                          ? { label: "Entregue", cls: "bg-blue-500/15 text-blue-300 border-blue-500/40" }
                          : st === "completed"
                            ? { label: "Concluído", cls: "bg-[#3A2414] text-[#A3A3A3] border-[#3A2414]" }
                            : st === "cancelled"
                              ? { label: "Cancelado", cls: "bg-red-500/15 text-red-300 border-red-500/40" }
                              : { label: st.toUpperCase(), cls: "bg-[#3A2414] text-[#A3A3A3] border-[#3A2414]" };
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedOrderId(o.id)}
                      aria-pressed={isCurrent}
                      className={`w-full text-left py-3 px-2 -mx-2 rounded-lg flex items-start justify-between gap-3 transition-colors ${
                        isCurrent
                          ? "bg-[#FF7A00]/10 ring-1 ring-[#FF7A00]/40"
                          : "hover:bg-[#1a1a1a]"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold flex items-center flex-wrap gap-2">
                          <span>Pedido #{o.id.slice(0, 8).toUpperCase()}</span>
                          {isCurrent && (
                            <span className="text-[10px] uppercase tracking-wider text-[#FF7A00]">
                              (atual)
                            </span>
                          )}
                          <span
                            className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${tag.cls}`}
                          >
                            {tag.label}
                          </span>
                        </p>
                        <p className="text-[11px] text-[#A3A3A3] mt-1">
                          {orderItems.length} {orderItems.length === 1 ? "item" : "itens"}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-[#E7D3B1] whitespace-nowrap">
                        {formatBRL(Number(o.total_amount))}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 pt-4 border-t border-[#3A2414] flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-[#A3A3A3]">
                Total da mesa
              </span>
              <span className="text-2xl font-bold text-[#FF7A00]">
                {formatBRL(
                  mesaData.orders.reduce(
                    (acc: number, o: any) => acc + Number(o.total_amount),
                    0,
                  ),
                )}
              </span>
            </div>
            <Link
              to="/cardapio"
              className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-[#D97706] hover:bg-[#FF7A00] text-white py-3 rounded-full font-bold text-sm uppercase tracking-wide transition-colors"
            >
              <Plus className="w-4 h-4" /> Adicionar mais itens
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

const DELIVERY_STEPS = [
  { key: "pedido_recebido", label: "Pedido Recebido", Icon: CheckCircle2 },
  { key: "em_preparo", label: "Em Preparo", Icon: ChefHat },
  { key: "pronto_para_entrega", label: "Pronto para Entrega", Icon: PackageCheck },
  { key: "saiu_para_entrega", label: "Saiu para Entrega", Icon: Bike },
  { key: "entregue", label: "Entregue", Icon: CheckCircle2 },
] as const;

function normalizeDeliveryStatus(order: any): string {
  const ds = order?.delivery_status as string | null | undefined;
  if (ds) {
    // Map legacy values to new vocabulary
    if (ds === "aguardando_entregador") return "pronto_para_entrega";
    if (ds === "em_entrega") return "saiu_para_entrega";
    return ds;
  }
  // Derive from base status
  const st = order?.status as string | undefined;
  switch (st) {
    case "pending": return "pedido_recebido";
    case "preparing": return "em_preparo";
    case "ready": return "pronto_para_entrega";
    case "delivered": return "saiu_para_entrega";
    case "completed": return "entregue";
    default: return "pedido_recebido";
  }
}

function DeliveryTracking({ orderId, order }: { orderId: string; order: any }) {
  const [driver, setDriver] = useState<{ name: string; phone: string | null } | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; status: string; created_at: string }>>([]);
  const [items, setItems] = useState<Array<{ id: string; quantity: number; unit_price: number; menu_item_id: string | null; name?: string | null }>>([]);
  const [driverLocation, setDriverLocation] = useState<DriverLocationPoint | null>(null);
  const [customerPoint, setCustomerPoint] = useState<GeoPoint | null>(null);

  const currentStatus = normalizeDeliveryStatus(order);
  const stepIndex = DELIVERY_STEPS.findIndex((s) => s.key === currentStatus);

  useEffect(() => {
    let active = true;
    const driverId = order?.delivery_driver_id as string | null | undefined;
    if (driverId) {
      supabase
        .from("delivery_drivers" as any)
        .select("name, phone")
        .eq("id", driverId)
        .maybeSingle()
        .then(({ data }) => {
          if (active && data) setDriver(data as any);
        });
    } else {
      setDriver(null);
    }
    return () => { active = false; };
  }, [order?.delivery_driver_id]);

  const loadHistory = async () => {
    const { data } = await supabase
      .from("order_status_history" as any)
      .select("id, status, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
    if (data) setHistory(data as any);
  };

  useEffect(() => {
    loadHistory();
    const ch = supabase
      .channel(`osh-${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_status_history", filter: `order_id=eq.${orderId}` },
        () => loadHistory(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const loadDriverLocation = async () => {
    const { data } = await supabase.rpc("get_driver_location_for_order" as any, { _order_id: orderId } as any);
    const row = Array.isArray(data) ? data[0] : null;
    setDriverLocation(row ? (row as DriverLocationPoint) : null);
  };

  useEffect(() => {
    loadDriverLocation();
    const ch = supabase
      .channel(`driver-location-${orderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_locations", filter: `current_order_id=eq.${orderId}` },
        (payload) => setDriverLocation((payload.new as DriverLocationPoint) || null),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const requestCustomerPoint = () => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setCustomerPoint({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    });
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: rows } = await supabase
        .from("order_items")
        .select("id, quantity, unit_price, menu_item_id")
        .eq("order_id", orderId);
      if (!active || !rows) return;
      const ids = Array.from(new Set(rows.map((r: any) => r.menu_item_id).filter(Boolean)));
      let nameMap: Record<string, string> = {};
      if (ids.length) {
        const { data: mi } = await supabase
          .from("menu_items")
          .select("id, name")
          .in("id", ids as any);
        (mi ?? []).forEach((m: any) => { nameMap[m.id] = m.name; });
      }
      setItems(rows.map((r: any) => ({ ...r, name: r.menu_item_id ? nameMap[r.menu_item_id] : null })));
    })();
    return () => { active = false; };
  }, [orderId]);

  return (
    <div className="mt-6 bg-[#121212] border border-[#3A2414] rounded-2xl p-6 md:p-8">
      <div className="flex items-center gap-2 mb-5">
        <Truck className="w-5 h-5 text-[#FF7A00]" />
        <h2 className="text-lg font-bold">Acompanhamento da Entrega</h2>
      </div>

      <ol className="space-y-3">
        {DELIVERY_STEPS.map((s, i) => {
          const reached = stepIndex >= i;
          const current = stepIndex === i;
          return (
            <li key={s.key} className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors ${
                  reached
                    ? "bg-[#FF7A00] border-[#FF7A00] text-[#0a0a0a]"
                    : "bg-[#0a0a0a] border-[#3A2414] text-[#5a5a5a]"
                } ${current ? "ring-4 ring-[#FF7A00]/30 animate-pulse" : ""}`}
              >
                <s.Icon className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className={`text-sm font-bold ${reached ? "text-[#E7D3B1]" : "text-[#5a5a5a]"}`}>
                  {reached && i < stepIndex ? "✓ " : ""}{s.label}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="grid md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-[#3A2414] text-sm">
        {order?.customer_name && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#A3A3A3]">Cliente</p>
            <p className="text-[#E7D3B1]">{order.customer_name}</p>
          </div>
        )}
        {order?.customer_phone && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#A3A3A3]">Telefone</p>
            <p className="text-[#E7D3B1]">{order.customer_phone}</p>
          </div>
        )}
        {order?.delivery_address && (
          <div className="md:col-span-2">
            <p className="text-[10px] uppercase tracking-wider text-[#A3A3A3]">Endereço</p>
            <p className="text-[#E7D3B1]">{order.delivery_address}{order.delivery_reference ? ` — ${order.delivery_reference}` : ""}</p>
          </div>
        )}
        {order?.payment_method && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#A3A3A3]">Pagamento</p>
            <p className="text-[#E7D3B1] capitalize">{String(order.payment_method).replace(/_/g, " ")}</p>
          </div>
        )}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[#A3A3A3]">Valor Total</p>
          <p className="text-[#FF7A00] font-bold">{formatBRL(Number(order.total_amount))}</p>
        </div>
      </div>

      {driver && (
        <div className="mt-5 pt-5 border-t border-[#3A2414]">
          <p className="text-[10px] uppercase tracking-wider text-[#A3A3A3] mb-2">Entregador</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FF7A00]/15 border border-[#FF7A00]/30 flex items-center justify-center">
              <Bike className="w-5 h-5 text-[#FF7A00]" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#E7D3B1]">{driver.name}</p>
              {driver.phone && (
                <a href={`tel:${driver.phone}`} className="text-xs text-[#D4A15A] hover:text-[#FF7A00]">
                  {driver.phone}
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <LiveDeliveryMap
        driverLocation={driverLocation}
        customerPoint={customerPoint}
        customerAddress={order?.delivery_address || null}
        status={DELIVERY_STEPS.find((s) => s.key === currentStatus)?.label || currentStatus}
        onRequestCustomerPoint={requestCustomerPoint}
      />

      {history.length > 0 && (
        <details className="mt-5 pt-5 border-t border-[#3A2414]">
          <summary className="cursor-pointer text-xs uppercase tracking-wider text-[#D4A15A] hover:text-[#FF7A00]">
            Histórico ({history.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {history.map((h) => {
              const step = DELIVERY_STEPS.find((s) => s.key === h.status);
              const label = step?.label || h.status;
              return (
                <li key={h.id} className="flex items-center justify-between text-xs">
                  <span className="text-[#E7D3B1]">{label}</span>
                  <span className="text-[#A3A3A3]">
                    {new Date(h.created_at).toLocaleString("pt-BR")}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {items.length > 0 && (
        <div className="mt-5 pt-5 border-t border-[#3A2414]">
          <p className="text-[10px] uppercase tracking-wider text-[#A3A3A3] mb-2">Itens do Pedido</p>
          <ul className="divide-y divide-[#3A2414]">
            {items.map((it) => (
              <li key={it.id} className="py-2 flex items-center justify-between text-sm">
                <span className="text-[#E7D3B1]">
                  {it.quantity}× {it.name ?? "Item"}
                </span>
                <span className="text-[#A3A3A3]">
                  {formatBRL(Number(it.unit_price) * Number(it.quantity))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}