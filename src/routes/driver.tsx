import { createFileRoute, Link, Outlet, useMatchRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bike, Flame, LogOut, Loader2, MapPin, Phone, CheckCircle2, Truck, BarChart3, Navigation, Signal, HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DriverLocationPoint, distanceMeters } from "@/lib/geo-tracking";
import { useDriverLocationTracker } from "@/hooks/useDriverLocationTracker";
import { useStoreOpenStatus } from "@/components/oxente/OpeningStatusBanner";

export const Route = createFileRoute("/driver")({
  component: DriverPortalRoute,
});

type Order = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  total_amount: number | null;
  delivery_fee: number | null;
  status: string | null;
  delivery_status: string | null;
  delivery_driver_id: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  aguardando_entregador: "Aguardando",
  em_entrega: "Em Entrega",
  entregue: "Entregue",
  pedido_recebido: "Pedido Recebido",
  em_preparo: "Em Preparo",
  pronto_para_entrega: "Pronto p/ Entrega",
  saiu_para_entrega: "Saiu p/ Entrega",
};

function DriverPortalRoute() {
  const matchRoute = useMatchRoute();
  const isNestedDriverRoute = Boolean(matchRoute({ to: "/driver/dashboard", fuzzy: true }));

  if (isNestedDriverRoute) {
    return <Outlet />;
  }

  return <DriverPortal />;
}

function DriverPortal() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const openStatus = useStoreOpenStatus();
  const storeIsOpen = openStatus?.isOpen ?? true;
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [driverName, setDriverName] = useState<string>("");
  const [authMode, setAuthMode] = useState<"login" | "newpass">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [accessNotice, setAccessNotice] = useState<string | null>(null);
  const routeStartRef = useRef<{ point: DriverLocationPoint; at: number; orderId: string } | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) loadDriver(s.user.id);
    });
    // Handle password recovery hash from invite
    if (window.location.hash.includes("type=recovery")) {
      setAuthMode("newpass");
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadDriver(data.session.user.id);
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadDriver = async (userId: string) => {
    setLoading(true);
    // Primary source of truth (Phase 15 unified auth): delivery_drivers.user_id
    let driverRow: any = null;
    const { data: byUserId } = await supabase
      .from("delivery_drivers" as any)
      .select("id, restaurant_id, name, active, user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (byUserId) driverRow = byUserId;

    // Legacy mirror fallback
    if (!driverRow) {
      const { data: acc } = await supabase
        .from("delivery_driver_users" as any)
        .select("id, restaurant_id, driver_id, user_id, active")
        .eq("user_id", userId)
        .maybeSingle();
      if (acc) {
        const { data: d } = await supabase
          .from("delivery_drivers" as any)
          .select("id, restaurant_id, name, active, user_id")
          .eq("id", (acc as any).driver_id)
          .maybeSingle();
        if (d) driverRow = { ...(d as any), active: (acc as any).active ?? (d as any).active };
      }
    }

    // Last resort: link by email
    if (!driverRow) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const { data: byEmail } = await supabase
          .from("delivery_driver_users" as any)
          .select("id, restaurant_id, driver_id, active")
          .eq("email", user.email.toLowerCase())
          .maybeSingle();
        if (byEmail) {
          await supabase
            .from("delivery_driver_users" as any)
            .update({ user_id: userId })
            .eq("id", (byEmail as any).id);
          const { data: d } = await supabase
            .from("delivery_drivers" as any)
            .select("id, restaurant_id, name, active, user_id")
            .eq("id", (byEmail as any).driver_id)
            .maybeSingle();
          if (d) {
            // also backfill delivery_drivers.user_id when missing
            if (!(d as any).user_id) {
              await supabase
                .from("delivery_drivers" as any)
                .update({ user_id: userId } as any)
                .eq("id", (d as any).id);
            }
            driverRow = { ...(d as any), active: (byEmail as any).active ?? (d as any).active };
          }
        }
      }
    }

    if (!driverRow || driverRow.active === false) {
      setAccessNotice("Acesso de entregador não encontrado ou inativo.");
      setDriverId(null);
      setRestaurantId(null);
      setDriverName("");
      setLoading(false);
      return;
    }
    setAccessNotice(null);
    setDriverId(driverRow.id);
    setRestaurantId(driverRow.restaurant_id);
    setDriverName(driverRow.name || "");
    setLoading(false);
    // Audit log: driver login (server-side via SECURITY DEFINER RPC)
    void supabase.rpc("log_driver_event" as never, {
      _event: "login",
      _metadata: {
        timestamp: new Date().toISOString(),
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      } as never,
    } as never);
  };

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["driver-orders", driverId],
    enabled: !!driverId,
    refetchInterval: 15_000,
    queryFn: async () => {
      // Driver sees:
      //  (a) orders assigned to themselves, AND
      //  (b) unassigned delivery orders still available to claim.
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, customer_name, customer_phone, delivery_address, total_amount, delivery_fee, status, delivery_status, delivery_driver_id, created_at",
        )
        .or(
          `delivery_driver_id.eq.${driverId},` +
            `and(delivery_driver_id.is.null,or(delivery_status.in.(pedido_recebido,em_preparo,pronto_para_entrega),status.in.(preparing,ready)))`,
        )
        .not("delivery_address", "is", null)
        .not("status", "in", "(cancelled,completed)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Order[];
    },
  });

  // Realtime: any change on orders refreshes the driver's lists immediately.
  useEffect(() => {
    if (!driverId) return;
    const ch = supabase
      .channel(`driver-orders-${driverId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          qc.invalidateQueries({ queryKey: ["driver-orders"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [driverId, qc]);

  const acceptDelivery = async (orderId: string): Promise<void> => {
    if (!driverId) return;
    const { data, error } = await supabase
      .from("orders")
      .update({ delivery_driver_id: driverId, delivery_status: "aguardando_entregador" } as never)
      .eq("id", orderId)
      .is("delivery_driver_id", null)
      .select("id");
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data || data.length === 0) {
      toast.error("Este pedido já foi aceito por outro entregador.");
      qc.invalidateQueries({ queryKey: ["driver-orders"] });
      return;
    }
    toast.success("Entrega aceita!");
    void supabase.rpc("log_driver_event" as never, {
      _event: "delivery_accepted",
      _metadata: { order_id: orderId, claimed: true } as never,
    } as never);
    qc.invalidateQueries({ queryKey: ["driver-orders"] });
  };

  const updateStatus = async (orderId: string, status: string) => {
    // Turno automático: vinculado aos horários de funcionamento da loja.
    if (status === "saiu_para_entrega" && !storeIsOpen) {
      toast.error("A loja está fechada no momento. Os turnos de entrega estão encerrados.");
      return;
    }
    if (status === "entregue") await saveRouteHistory(orderId);
    const { error } = await supabase
      .from("orders")
      .update({ delivery_status: status } as any)
      .eq("id", orderId);
    if (error) {
      if (status === "saiu_para_entrega") {
        void supabase.rpc("log_driver_event" as never, { _event: "delivery_rejected", _metadata: { order_id: orderId, error: error.message } as never } as never);
      }
      return toast.error(error.message);
    }
    if (status === "saiu_para_entrega") {
      void supabase.rpc("log_driver_event" as never, { _event: "delivery_accepted", _metadata: { order_id: orderId } as never } as never);
    }
    toast.success("Status atualizado");
    qc.invalidateQueries({ queryKey: ["driver-orders"] });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setBusy(false);
    if (error) toast.error(error.message);
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Senha deve ter pelo menos 6 caracteres");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Senha definida! Bem-vindo.");
    setAuthMode("login");
    window.location.hash = "";
  };

  const handleLogout = async () => {
    if (driverId) {
      await supabase.from("driver_locations" as any).update({ is_online: false, current_order_id: null } as any).eq("driver_id", driverId);
    }
    await supabase.auth.signOut();
    setSession(null);
    setDriverId(null);
    setRestaurantId(null);
    navigate({ to: "/driver", replace: true });
  };

  // Any order currently assigned to this driver that isn't done yet keeps the GPS active.
  const activeDelivery = useMemo(
    () =>
      orders.find(
        (o) =>
          o.delivery_driver_id === driverId &&
          o.delivery_status !== "entregue" &&
          o.status !== "completed" &&
          o.status !== "cancelled",
      ) || null,
    [orders, driverId],
  );

  const saveRouteHistory = async (orderId: string) => {
    if (!driverId || !restaurantId) return;
    const start = routeStartRef.current;
    const destination = lastLocation;
    if (!start || !destination) return;
    await supabase.from("driver_route_history" as any).insert({
      driver_id: driverId,
      restaurant_id: restaurantId,
      order_id: orderId,
      origin: { latitude: start.point.latitude, longitude: start.point.longitude, at: new Date(start.at).toISOString() },
      destination: { latitude: destination.latitude, longitude: destination.longitude, at: new Date().toISOString() },
      duration_seconds: Math.max(1, Math.round((Date.now() - start.at) / 1000)),
      distance_meters: Math.round(distanceMeters(start.point, destination)),
      route_date: new Date().toISOString().slice(0, 10),
    } as any);
  };

  const tracker = useDriverLocationTracker({
    driverId,
    restaurantId,
    activeOrderId: activeDelivery?.id ?? null,
    enabled: !!activeDelivery,
  });
  const lastLocation = tracker.last;
  const trackingState: "idle" | "active" | "blocked" | "error" =
    tracker.state === "active" ? "active"
    : tracker.state === "denied" || tracker.state === "blocked" ? "blocked"
    : tracker.state === "error" ? "error"
    : "idle";

  useEffect(() => {
    if (!activeDelivery) { routeStartRef.current = null; return; }
    if (lastLocation && (!routeStartRef.current || routeStartRef.current.orderId !== activeDelivery.id)) {
      routeStartRef.current = { point: lastLocation, at: Date.now(), orderId: activeDelivery.id };
    }
  }, [activeDelivery, lastLocation]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-[#E7D3B1] flex items-center justify-center">
        <Flame className="w-8 h-8 text-[#FF7A00] animate-pulse" />
      </div>
    );
  }

  if (!session?.user || !driverId) {
    return (
      <div className="min-h-screen bg-black text-[#E7D3B1] flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-[#0d0907] border border-[#3A2414] rounded-xl p-6">
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 rounded-full bg-[#FF7A00]/15 border border-[#FF7A00]/30 flex items-center justify-center mb-3">
              <Bike className="w-6 h-6 text-[#FF7A00]" />
            </div>
            <h1 className="text-xl font-bold">Portal do Entregador</h1>
            <p className="text-xs text-[#A3A3A3] mt-1">
              {authMode === "newpass" ? "Defina sua senha" : "Entre com seu email e senha"}
            </p>
          </div>
          {accessNotice && (
            <div className="mb-4 rounded-lg border border-red-600/40 bg-red-950/30 px-3 py-2 text-xs text-red-200">
              {accessNotice}
            </div>
          )}
          {authMode === "newpass" ? (
            <form onSubmit={handleSetPassword} className="space-y-3">
              <div>
                <Label className="text-xs text-[#D4A15A]">Nova Senha</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-[#1a1a1a] border-[#3A2414]" />
              </div>
              <Button type="submit" disabled={busy} className="w-full bg-[#FF7A00] hover:bg-[#FF7A00]/90 text-black font-semibold">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Definir Senha"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <Label className="text-xs text-[#D4A15A]">Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-[#1a1a1a] border-[#3A2414]" />
              </div>
              <div>
                <Label className="text-xs text-[#D4A15A]">Senha</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-[#1a1a1a] border-[#3A2414]" />
              </div>
              <Button type="submit" disabled={busy} className="w-full bg-[#FF7A00] hover:bg-[#FF7A00]/90 text-black font-semibold">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Entrar"}
              </Button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const mine = orders.filter((o) => o.delivery_driver_id === driverId);
  const available = orders.filter((o) => !o.delivery_driver_id);
  const pending = mine.filter((o) => o.delivery_status !== "entregue");
  const done = mine.filter((o) => o.delivery_status === "entregue");

  return (
    <div className="min-h-screen bg-black text-[#E7D3B1]">
      <header className="border-b border-[#3A2414] bg-[#0d0907]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bike className="w-5 h-5 text-[#FF7A00]" />
            <div>
              <h1 className="text-base font-bold">Minhas Entregas</h1>
              <p className="text-xs text-[#A3A3A3]">{driverName}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link to="/driver/dashboard">
              <Button variant="ghost" size="sm" className="text-[#D4A15A] hover:text-[#FF7A00]">
                <BarChart3 className="w-4 h-4 mr-1" /> Dashboard
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-[#D4A15A] hover:text-[#FF7A00]">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <LocationSharingStatus state={trackingState} activeOrderId={activeDelivery?.id ?? null} lastLocation={lastLocation} />

        {/* Available orders awaiting a driver to accept */}
        <section className="border border-[#3A2414] rounded-xl bg-[#0d0907] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#3A2414] flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#D4A15A] flex items-center gap-2">
              <HandCoins className="w-4 h-4" /> Pedidos de Entrega
            </h2>
            <span className="text-[11px] text-[#A3A3A3]">{available.length} disponível(is)</span>
          </div>
          {ordersLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#FF7A00]" /></div>
          ) : available.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-[#A3A3A3]">
              Nenhum pedido aguardando entregador no momento.
            </div>
          ) : (
            <div className="divide-y divide-[#3A2414]/60">
              {available.map((o) => <AvailableCard key={o.id} order={o} onAccept={acceptDelivery} />)}
            </div>
          )}
        </section>

        {ordersLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[#FF7A00]" /></div>
        ) : pending.length === 0 ? (
          <div className="text-center text-sm text-[#A3A3A3] py-10 border border-[#3A2414] rounded-xl bg-[#0d0907]">
            Nenhuma entrega pendente no momento.
          </div>
        ) : (
          pending.map((o) => (
            <OrderCard key={o.id} order={o} onUpdate={updateStatus} />
          ))
        )}

        {done.length > 0 && (
          <details className="border border-[#3A2414] rounded-xl bg-[#0d0907]">
            <summary className="px-4 py-3 cursor-pointer text-sm text-[#D4A15A]">
              Entregas concluídas ({done.length})
            </summary>
            <div className="divide-y divide-[#3A2414]/60">
              {done.map((o) => <OrderCard key={o.id} order={o} onUpdate={updateStatus} compact />)}
            </div>
          </details>
        )}
      </main>
    </div>
  );
}

function AvailableCard({ order, onAccept }: { order: Order; onAccept: (id: string) => void | Promise<void> }) {
  return (
    <div className="p-4 hover:bg-[#1a1a1a]/40">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#FF7A00]">#{order.id.slice(0, 8)}</span>
          <Badge className="bg-amber-600/20 text-amber-400 border-amber-600/40 text-[10px]">
            Disponível
          </Badge>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold">R$ {Number(order.total_amount || 0).toFixed(2)}</div>
          {Number(order.delivery_fee || 0) > 0 && (
            <div className="text-[10px] text-[#A3A3A3]">Taxa: R$ {Number(order.delivery_fee).toFixed(2)}</div>
          )}
        </div>
      </div>
      <div className="text-sm space-y-0.5">
        <div className="font-semibold">{order.customer_name || "—"}</div>
        {order.delivery_address && (
          <div className="flex items-start gap-1.5 text-xs text-[#A3A3A3]">
            <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" /> <span>{order.delivery_address}</span>
          </div>
        )}
      </div>
      <Button
        size="sm"
        onClick={() => void onAccept(order.id)}
        className="mt-3 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
      >
        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aceitar entrega
      </Button>
    </div>
  );
}

function OrderCard({ order, onUpdate, compact }: { order: Order; onUpdate: (id: string, status: string) => void; compact?: boolean }) {
  const status = order.delivery_status || "aguardando_entregador";
  return (
    <div className={`p-4 ${compact ? "" : "border border-[#3A2414] rounded-xl bg-[#0d0907]"}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#FF7A00]">#{order.id.slice(0, 8)}</span>
          <Badge className={
            status === "entregue"
              ? "bg-emerald-600/20 text-emerald-400 border-emerald-600/40"
              : status === "em_entrega"
              ? "bg-blue-600/20 text-blue-400 border-blue-600/40"
              : "bg-amber-600/20 text-amber-400 border-amber-600/40"
          }>
            {STATUS_LABEL[status] || status}
          </Badge>
        </div>
        <span className="text-sm font-bold">R$ {Number(order.total_amount || 0).toFixed(2)}</span>
      </div>
      <div className="text-sm space-y-1">
        <div className="font-semibold">{order.customer_name || "—"}</div>
        {order.customer_phone && (
          <a href={`tel:${order.customer_phone}`} className="flex items-center gap-1.5 text-xs text-[#D4A15A] hover:text-[#FF7A00]">
            <Phone className="w-3 h-3" /> {order.customer_phone}
          </a>
        )}
        {order.delivery_address && (
          <div className="flex items-start gap-1.5 text-xs text-[#A3A3A3]">
            <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" /> <span>{order.delivery_address}</span>
          </div>
        )}
      </div>
      {!compact && (
        <div className="flex gap-2 mt-3">
          {(status === "aguardando_entregador" || status === "pronto_para_entrega" || status === "pedido_recebido" || status === "em_preparo") && (
            <Button size="sm" onClick={() => onUpdate(order.id, "saiu_para_entrega")} className="bg-[#FF7A00] hover:bg-[#FF7A00]/90 text-black font-semibold flex-1">
              <Truck className="w-3.5 h-3.5 mr-1" /> Saiu para Entrega
            </Button>
          )}
          {(status === "em_entrega" || status === "saiu_para_entrega") && (
            <Button size="sm" onClick={() => onUpdate(order.id, "entregue")} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex-1">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Marcar Entregue
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function LocationSharingStatus({ state, activeOrderId, lastLocation }: { state: "idle" | "active" | "blocked" | "error"; activeOrderId: string | null; lastLocation: DriverLocationPoint | null }) {
  const active = state === "active";
  const blocked = state === "blocked" || state === "error";
  return (
    <div className={`border rounded-xl p-4 bg-[#0d0907] ${active ? "border-emerald-600/40" : blocked ? "border-red-600/40" : "border-[#3A2414]"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${active ? "bg-emerald-600/15 border-emerald-600/40 text-emerald-300" : blocked ? "bg-red-600/15 border-red-600/40 text-red-300" : "bg-[#FF7A00]/15 border-[#FF7A00]/30 text-[#FF7A00]"}`}>
            {active ? <Signal className="w-5 h-5" /> : <Navigation className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#E7D3B1]">
              {active ? "Localização compartilhando" : blocked ? "GPS indisponível" : "GPS em espera"}
            </p>
            <p className="text-xs text-[#A3A3A3] truncate">
              {activeOrderId ? `Pedido #${activeOrderId.slice(0, 8)}` : "Inicia automaticamente durante entrega ativa"}
            </p>
          </div>
        </div>
        {lastLocation?.updated_at && (
          <span className="text-[10px] text-[#D4A15A] whitespace-nowrap">
            {new Date(lastLocation.updated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        )}
      </div>
      {blocked && (
        <p className="mt-2 text-xs text-red-300">Autorize o acesso à localização do navegador para rastrear a entrega.</p>
      )}
    </div>
  );
}