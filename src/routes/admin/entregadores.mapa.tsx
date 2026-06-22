import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bike, Flame, Loader2, MapPin, Navigation, RefreshCw, Route as RouteIcon, Signal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/admin.functions";
import { DriverLocationPoint, formatDistance, isFreshLocation } from "@/lib/geo-tracking";

export const Route = createFileRoute("/admin/entregadores/mapa")({
  component: EntregadoresMapaPage,
});

type LocationRow = DriverLocationPoint & {
  id: string;
  driver_id: string;
  restaurant_id: string;
  current_order_id: string | null;
  delivery_drivers?: { name: string; active: boolean; tipo_veiculo: string | null } | null;
  orders?: { id: string; customer_name: string | null; delivery_address: string | null; delivery_status: string | null } | null;
};

function EntregadoresMapaPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    (async () => {
      const { isAdmin } = await checkIsAdmin();
      if (!isAdmin) {
        navigate({ to: "/admin/login", replace: true });
        return;
      }
      setAuthChecked(true);
    })();
  }, [navigate]);

  const { data: restaurantId } = useQuery({
    queryKey: ["restaurant-id"],
    enabled: authChecked,
    queryFn: async () => {
      const { data } = await supabase.from("restaurant_settings").select("id").limit(1).maybeSingle();
      return (data as any)?.id as string | undefined;
    },
  });

  const { data: locations = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-driver-map", restaurantId],
    enabled: !!restaurantId && authChecked,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_locations" as any)
        .select("*, delivery_drivers(name, active, tipo_veiculo), orders(id, customer_name, delivery_address, delivery_status)")
        .eq("restaurant_id", restaurantId as string)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as LocationRow[];
    },
  });

  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase
      .channel(`admin-driver-locations-${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_locations", filter: `restaurant_id=eq.${restaurantId}` }, () => {
        qc.invalidateQueries({ queryKey: ["admin-driver-map"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc, restaurantId]);

  const bounds = useMemo(() => {
    const live = locations.filter((l) => Number.isFinite(l.latitude) && Number.isFinite(l.longitude));
    if (!live.length) return null;
    const lats = live.map((l) => l.latitude);
    const lngs = live.map((l) => l.longitude);
    return { minLat: Math.min(...lats), maxLat: Math.max(...lats), minLng: Math.min(...lngs), maxLng: Math.max(...lngs) };
  }, [locations]);

  const activeCount = locations.filter((l) => isFreshLocation(l.updated_at) && l.is_online).length;
  const inRouteCount = locations.filter((l) => !!l.current_order_id && isFreshLocation(l.updated_at)).length;

  if (!authChecked) {
    return <div className="min-h-screen bg-black text-[#E7D3B1] flex items-center justify-center"><Flame className="w-8 h-8 text-[#FF7A00] animate-pulse" /></div>;
  }

  return (
    <div className="min-h-screen bg-black text-[#E7D3B1]">
      <header className="border-b border-[#3A2414] bg-[#0d0907]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/admin/entregas" className="flex items-center gap-1.5 text-xs text-[#D4A15A] hover:text-[#FF7A00]"><ArrowLeft className="w-4 h-4" /> Entregas</Link>
            <div className="h-5 w-px bg-[#3A2414]" />
            <div className="flex items-center gap-2"><MapPin className="w-5 h-5 text-[#FF7A00]" /><h1 className="text-lg md:text-xl font-bold">Mapa dos Entregadores</h1></div>
          </div>
          <Button variant="ghost" onClick={() => refetch()} className="text-[#D4A15A] hover:text-[#FF7A00]"><RefreshCw className="w-4 h-4 mr-1" /> Atualizar</Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Online" value={activeCount} icon={<Signal className="w-4 h-4" />} />
          <Stat label="Em rota" value={inRouteCount} icon={<RouteIcon className="w-4 h-4" />} />
          <Stat label="Monitorados" value={locations.length} icon={<Bike className="w-4 h-4" />} />
          <Stat label="Atualização" value="Realtime" icon={<Navigation className="w-4 h-4" />} />
        </div>

        <section className="border border-[#3A2414] bg-[#0d0907] rounded-xl overflow-hidden">
          <div className="relative h-[420px] bg-[#121212]">
            <div className="absolute inset-0 opacity-70 bg-[linear-gradient(90deg,rgba(58,36,20,.35)_1px,transparent_1px),linear-gradient(rgba(58,36,20,.35)_1px,transparent_1px)] bg-[size:42px_42px]" />
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-[#FF7A00]" /></div>
            ) : locations.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-[#A3A3A3] text-center px-6">Nenhuma localização ativa registrada ainda.</div>
            ) : locations.map((loc) => <DriverMarker key={loc.id} location={loc} bounds={bounds} />)}
          </div>
        </section>

        <section className="border border-[#3A2414] bg-[#0d0907] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#3A2414]"><h2 className="text-sm font-bold text-[#D4A15A]">Entregadores em tempo real</h2></div>
          <div className="divide-y divide-[#3A2414]/60">
            {locations.map((loc) => <DriverRow key={loc.id} location={loc} />)}
          </div>
        </section>
      </main>
    </div>
  );
}

function DriverMarker({ location, bounds }: { location: LocationRow; bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null }) {
  const status = markerStatus(location);
  const x = bounds && bounds.maxLng !== bounds.minLng ? ((location.longitude - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 80 + 10 : 50;
  const y = bounds && bounds.maxLat !== bounds.minLat ? (1 - (location.latitude - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 80 + 10 : 50;
  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
      <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shadow-lg ${status.className}`} title={location.delivery_drivers?.name || "Entregador"}>
        <Bike className="w-5 h-5" />
      </div>
      <div className="mt-1 px-2 py-1 rounded bg-[#0a0a0a]/90 border border-[#3A2414] text-[10px] whitespace-nowrap text-center">{location.delivery_drivers?.name || "Entregador"}</div>
    </div>
  );
}

function DriverRow({ location }: { location: LocationRow }) {
  const status = markerStatus(location);
  return (
    <div className="p-4 flex flex-col md:flex-row md:items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold">{location.delivery_drivers?.name || "Entregador"}</span>
          <Badge className={status.badge}>{status.label}</Badge>
          {location.orders?.id && <Badge className="bg-blue-600/20 text-blue-300 border-blue-600/40 text-[10px]">#{location.orders.id.slice(0, 8)}</Badge>}
        </div>
        <p className="text-xs text-[#A3A3A3] mt-1 truncate">{location.orders?.delivery_address || "Sem pedido em rota"}</p>
      </div>
      <div className="text-xs text-[#A3A3A3] md:text-right">
        <p>{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</p>
        <p>{location.updated_at ? new Date(location.updated_at).toLocaleString("pt-BR") : "—"}</p>
      </div>
    </div>
  );
}

function markerStatus(location: LocationRow) {
  const fresh = isFreshLocation(location.updated_at) && location.is_online;
  if (!fresh) return { label: "Offline", className: "bg-zinc-800 text-zinc-300 border-zinc-500", badge: "bg-zinc-700/40 text-zinc-300 border-zinc-600/40 text-[10px]" };
  if (location.orders?.delivery_status === "em_entrega" || location.orders?.delivery_status === "saiu_para_entrega") return { label: "Em entrega", className: "bg-blue-600 text-white border-blue-300", badge: "bg-blue-600/20 text-blue-300 border-blue-600/40 text-[10px]" };
  if (location.current_order_id) return { label: "Indo buscar", className: "bg-orange-500 text-black border-orange-200", badge: "bg-orange-500/20 text-orange-300 border-orange-500/40 text-[10px]" };
  return { label: "Disponível", className: "bg-emerald-600 text-white border-emerald-300", badge: "bg-emerald-600/20 text-emerald-300 border-emerald-600/40 text-[10px]" };
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return <div className="border border-[#3A2414] bg-[#0d0907] rounded-xl p-4"><div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[#A3A3A3]">{icon}{label}</div><div className="mt-1 text-2xl font-bold">{value}</div></div>;
}