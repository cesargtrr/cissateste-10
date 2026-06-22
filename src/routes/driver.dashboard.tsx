import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Bike, Flame, LogOut, Loader2, MapPin, Phone, Package, Truck, CheckCircle2, Clock, ArrowLeft, ExternalLink, Navigation, Signal, Trophy, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid } from "recharts";
import { formatDistance, formatDuration, isFreshLocation } from "@/lib/geo-tracking";
import { NotificationsBell } from "@/components/driver/NotificationsBell";

export const Route = createFileRoute("/driver/dashboard")({
  component: DriverDashboard,
});

type Order = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  total_amount: number | null;
  delivery_status: string | null;
  delivery_driver_id: string | null;
  created_at: string;
  updated_at: string | null;
};

type Period = "hoje" | "7d" | "30d" | "90d";

const STATUS_LABEL: Record<string, string> = {
  aguardando_entregador: "Aguardando",
  em_entrega: "Em Entrega",
  entregue: "Entregue",
  saiu_para_entrega: "Saiu p/ Entrega",
  pronto_para_entrega: "Pronto p/ Entrega",
  pedido_recebido: "Recebido",
  em_preparo: "Em Preparo",
};

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function daysAgo(n: number) { const x = startOfDay(new Date()); x.setDate(x.getDate() - n); return x; }

function DriverDashboard() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [driverName, setDriverName] = useState("");
  const [period, setPeriod] = useState<Period>("7d");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!alive) return;
        setUser(session?.user ?? null);
        setAuthReady(true);
        if (!session?.user) {
          setLoading(false);
          navigate({ to: "/driver", replace: true });
          return;
        }
      // Primary source: delivery_drivers.user_id (unified auth)
      let resolvedDriverId: string | null = null;
      let resolvedName = "";
      const { data: byUserId } = await supabase
        .from("delivery_drivers" as any)
        .select("id, name, active, user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (byUserId && (byUserId as any).active !== false) {
        resolvedDriverId = (byUserId as any).id;
        resolvedName = (byUserId as any).name || "";
      } else {
        // Legacy fallback: delivery_driver_users mirror
        const { data: acc } = await supabase
          .from("delivery_driver_users" as any)
          .select("driver_id, active")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (acc && (acc as any).active !== false) {
          resolvedDriverId = (acc as any).driver_id;
          const { data: d } = await supabase
            .from("delivery_drivers" as any)
            .select("name")
            .eq("id", (acc as any).driver_id)
            .maybeSingle();
          resolvedName = (d as any)?.name || "";
        }
      }
      if (!resolvedDriverId) {
        if (alive) setLoading(false);
        navigate({ to: "/driver", replace: true });
        return;
      }
      if (!alive) return;
      setDriverId(resolvedDriverId);
      setDriverName(resolvedName);
      setLoading(false);
      } catch (error) {
        console.error("Driver dashboard bootstrap failed:", error);
        if (alive) {
          setLoading(false);
          navigate({ to: "/driver", replace: true });
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [navigate]);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["driver-dashboard-orders", driverId],
    enabled: mounted && authReady && !!user && !!driverId,
    queryFn: async () => {
      if (!driverId) return [] as Order[];
      const { data, error } = await supabase
        .from("orders")
        .select("id, customer_name, customer_phone, delivery_address, total_amount, delivery_status, delivery_driver_id, created_at, updated_at")
        .eq("delivery_driver_id", driverId as string)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as Order[];
    },
  });

  const { data: location } = useQuery({
    queryKey: ["driver-location", driverId],
    enabled: mounted && authReady && !!user && !!driverId,
    queryFn: async () => {
      if (!driverId) return null;
      const { data } = await supabase
        .from("driver_locations" as any)
        .select("latitude, longitude, is_online, updated_at, created_at")
        .eq("driver_id", driverId as string)
        .maybeSingle();
      return data as any;
    },
    refetchInterval: 30_000,
  });

  const { data: routes = [] } = useQuery({
    queryKey: ["driver-route-history", driverId],
    enabled: mounted && authReady && !!user && !!driverId,
    queryFn: async () => {
      if (!driverId) return [] as Array<{ distance_meters: number | null; duration_seconds: number | null }>;
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("driver_route_history" as any)
        .select("distance_meters, duration_seconds, route_date")
        .eq("driver_id", driverId as string)
        .eq("route_date", today);
      return (data || []) as unknown as Array<{ distance_meters: number | null; duration_seconds: number | null }>;
    },
  });

  const periodStart = useMemo(() => {
    if (period === "hoje") return startOfDay(new Date());
    if (period === "7d") return daysAgo(6);
    if (period === "30d") return daysAgo(29);
    return daysAgo(89);
  }, [period]);

  const filtered = useMemo(
    () => orders.filter((o) => new Date(o.created_at) >= periodStart),
    [orders, periodStart],
  );

  const todayStart = startOfDay(new Date());
  const entreguesHoje = useMemo(
    () => orders.filter((o) => o.delivery_status === "entregue" && new Date(o.updated_at || o.created_at) >= todayStart).length,
    [orders],
  );
  const emAndamento = useMemo(
    () => orders.filter((o) => o.delivery_status === "em_entrega" || o.delivery_status === "saiu_para_entrega").length,
    [orders],
  );
  const concluidas = useMemo(
    () => filtered.filter((o) => o.delivery_status === "entregue").length,
    [filtered],
  );
  const tempoMedio = useMemo(() => {
    const done = filtered.filter((o) => o.delivery_status === "entregue" && o.updated_at);
    if (!done.length) return 0;
    const sum = done.reduce((acc, o) => acc + (new Date(o.updated_at as string).getTime() - new Date(o.created_at).getTime()), 0);
    return Math.round(sum / done.length / 60000);
  }, [filtered]);

  const weekly = useMemo(() => {
    const days: { date: string; entregas: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = daysAgo(i);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const count = orders.filter((o) => o.delivery_status === "entregue" && new Date(o.updated_at || o.created_at) >= d && new Date(o.updated_at || o.created_at) < next).length;
      days.push({ date: d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }), entregas: count });
    }
    return days;
  }, [orders]);

  const recent = useMemo(() => filtered.slice(0, 20), [filtered]);

  const stats = useMemo(() => {
    const delivered = orders.filter((o) => o.delivery_status === "entregue").sort((a, b) => new Date(a.updated_at || a.created_at).getTime() - new Date(b.updated_at || b.created_at).getTime());
    if (!delivered.length) return { first: null as Date | null, last: null as Date | null, streak: 0, total: 0 };
    const first = new Date(delivered[0].updated_at || delivered[0].created_at);
    const last = new Date(delivered[delivered.length - 1].updated_at || delivered[delivered.length - 1].created_at);
    const set = new Set(delivered.map((o) => startOfDay(new Date(o.updated_at || o.created_at)).toISOString()));
    const dates = Array.from(set).sort();
    let best = 1, cur = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const now = new Date(dates[i]);
      const diff = Math.round((now.getTime() - prev.getTime()) / 86400000);
      if (diff === 1) { cur++; best = Math.max(best, cur); } else { cur = 1; }
    }
    return { first, last, streak: best, total: delivered.length };
  }, [orders]);

  const ativo = useMemo(() => orders.find((o) => o.delivery_status === "em_entrega" || o.delivery_status === "saiu_para_entrega") || null, [orders]);
  const gpsStats = useMemo(() => {
    const distance = routes.reduce((acc, r) => acc + Number(r.distance_meters || 0), 0);
    const routeSeconds = routes.reduce((acc, r) => acc + Number(r.duration_seconds || 0), 0);
    const onlineSeconds = location?.created_at ? Math.max(0, Math.round((Date.now() - new Date(location.created_at).getTime()) / 1000)) : 0;
    return { distance, routeSeconds, onlineSeconds, fresh: isFreshLocation(location?.updated_at) };
  }, [location, routes]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/driver", replace: true });
  };

  if (!mounted || loading || !authReady) {
    return (
      <div className="min-h-screen bg-black text-white p-4 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Flame className="w-8 h-8 text-[#FF7A00] animate-pulse" />
          <span>Carregando painel...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-[#E7D3B1] overflow-x-hidden max-w-full">
      <header className="border-b border-[#3A2414] bg-[#0d0907]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3 overflow-hidden max-w-full">
          <div className="flex items-center gap-2 min-w-0">
            <Bike className="w-5 h-5 text-[#FF7A00] shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base font-bold truncate">Meu Dashboard</h1>
              <p className="text-xs text-[#A3A3A3] truncate">{driverName}</p>
            </div>
          </div>
          <div className="flex items-center justify-start gap-4 p-2 max-w-full overflow-x-auto whitespace-nowrap scrollbar-none min-w-0">
            <Link to="/driver" className="shrink-0">
              <Button variant="ghost" size="sm" className="text-[#D4A15A] hover:text-[#FF7A00]">
                <ArrowLeft className="w-4 h-4 mr-1" /> Entregas
              </Button>
            </Link>
            <Link to="/driver/performance" className="shrink-0">
              <Button variant="ghost" size="sm" className="text-[#D4A15A] hover:text-[#FF7A00]">
                <Trophy className="w-4 h-4 mr-1" /> Performance
              </Button>
            </Link>
            <Link to="/driver/earnings" className="shrink-0">
              <Button variant="ghost" size="sm" className="text-[#D4A15A] hover:text-[#FF7A00]">
                <Trophy className="w-4 h-4 mr-1" /> Ganhos
              </Button>
            </Link>
            <Link to="/driver/achievements" className="shrink-0">
              <Button variant="ghost" size="sm" className="text-[#D4A15A] hover:text-[#FF7A00]">
                <Trophy className="w-4 h-4 mr-1" /> Conquistas
              </Button>
            </Link>
            <Link to="/driver/jornada" className="shrink-0">
              <Button variant="ghost" size="sm" className="text-[#D4A15A] hover:text-[#FF7A00]">
                <Timer className="w-4 h-4 mr-1" /> Jornada
              </Button>
            </Link>
            <div className="shrink-0">
              <NotificationsBell driverId={driverId} />
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-[#D4A15A] hover:text-[#FF7A00] shrink-0">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>


      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Period filter */}
        <div className="flex flex-wrap gap-2">
          {([
            ["hoje", "Hoje"], ["7d", "7 dias"], ["30d", "30 dias"], ["90d", "90 dias"],
          ] as [Period, string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setPeriod(k)}
              className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${period === k ? "bg-[#FF7A00] text-black border-[#FF7A00] font-semibold" : "bg-[#0d0907] border-[#3A2414] text-[#D4A15A] hover:border-[#FF7A00]/50"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[#FF7A00]" /></div>
        ) : (
          <>
            {/* Active order */}
            {ativo && (
              <div className="border border-[#FF7A00]/40 bg-gradient-to-br from-[#FF7A00]/10 to-transparent rounded-xl p-4 sm:p-5">
                <div className="flex items-center gap-2 text-xs text-[#FF7A00] font-semibold mb-2">
                  <Truck className="w-4 h-4" /> ENTREGA EM ANDAMENTO
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1 text-sm">
                    <div className="font-bold">#{ativo.id.slice(0, 8)} • {ativo.customer_name || "—"}</div>
                    {ativo.customer_phone && (
                      <div className="flex items-center gap-1.5 text-xs text-[#D4A15A]"><Phone className="w-3 h-3" /> {ativo.customer_phone}</div>
                    )}
                    {ativo.delivery_address && (
                      <div className="flex items-start gap-1.5 text-xs text-[#A3A3A3]"><MapPin className="w-3 h-3 mt-0.5" /> {ativo.delivery_address}</div>
                    )}
                    <Badge className="mt-1 bg-blue-600/20 text-blue-400 border-blue-600/40">{STATUS_LABEL[ativo.delivery_status || ""] || ativo.delivery_status}</Badge>
                  </div>
                  <Link to="/pedido/$id" params={{ id: ativo.id }}>
                    <Button size="sm" className="bg-[#FF7A00] hover:bg-[#FF7A00]/90 text-black font-semibold">
                      <ExternalLink className="w-3.5 h-3.5 mr-1" /> Ver Entrega
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon={<Package className="w-4 h-4" />} label="Entregas Hoje" value={entreguesHoje} />
              <StatCard icon={<Truck className="w-4 h-4" />} label="Em Andamento" value={emAndamento} />
              <StatCard icon={<CheckCircle2 className="w-4 h-4" />} label="Concluídas" value={concluidas} />
              <StatCard icon={<Clock className="w-4 h-4" />} label="Tempo Médio" value={tempoMedio ? `${tempoMedio} min` : "—"} />
            </div>

            {/* Weekly chart */}
            <section className="border border-[#3A2414] bg-[#0d0907] rounded-xl p-4 sm:p-5">
              <h2 className="text-sm font-bold mb-3 text-[#D4A15A]">Desempenho — Últimos 7 dias</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3A2414" />
                    <XAxis dataKey="date" stroke="#A3A3A3" fontSize={11} />
                    <YAxis stroke="#A3A3A3" fontSize={11} allowDecimals={false} />
                    <RTooltip
                      contentStyle={{ background: "#0d0907", border: "1px solid #3A2414", borderRadius: 8, color: "#E7D3B1" }}
                      cursor={{ fill: "rgba(255,122,0,0.08)" }}
                    />
                    <Bar dataKey="entregas" fill="#FF7A00" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Personal stats */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="1ª Entrega" value={stats.first ? stats.first.toLocaleDateString("pt-BR") : "—"} />
              <StatCard label="Última Entrega" value={stats.last ? stats.last.toLocaleDateString("pt-BR") : "—"} />
              <StatCard label="Maior Sequência" value={stats.streak ? `${stats.streak} dias` : "—"} />
              <StatCard label="Total Histórico" value={stats.total} />
            </section>

            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon={<Navigation className="w-4 h-4" />} label="Distância Hoje" value={formatDistance(gpsStats.distance)} />
              <StatCard icon={<Clock className="w-4 h-4" />} label="Tempo Online" value={formatDuration(gpsStats.onlineSeconds)} />
              <StatCard icon={<Truck className="w-4 h-4" />} label="Tempo em Rota" value={formatDuration(gpsStats.routeSeconds)} />
              <StatCard icon={<Signal className="w-4 h-4" />} label="Última Localização" value={location?.updated_at ? new Date(location.updated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"} />
            </section>

            {/* Recent history */}
            <section className="border border-[#3A2414] bg-[#0d0907] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#3A2414]">
                <h2 className="text-sm font-bold text-[#D4A15A]">Histórico Recente</h2>
              </div>
              {recent.length === 0 ? (
                <div className="p-6 text-center text-sm text-[#A3A3A3]">Nenhuma entrega no período.</div>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="md:hidden divide-y divide-[#3A2414]/60">
                    {recent.map((o) => (
                      <div key={o.id} className="p-3 text-sm">
                        <div className="flex justify-between gap-2">
                          <span className="font-bold text-[#FF7A00]">#{o.id.slice(0,8)}</span>
                          <span>R$ {Number(o.total_amount || 0).toFixed(2)}</span>
                        </div>
                        <div className="text-xs mt-1">{o.customer_name || "—"}</div>
                        {o.delivery_address && <div className="text-[11px] text-[#A3A3A3] truncate">{o.delivery_address}</div>}
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[11px] text-[#A3A3A3]">{new Date(o.created_at).toLocaleDateString("pt-BR")}</span>
                          <Badge className="bg-[#3A2414]/60 text-[#D4A15A] border-[#3A2414] text-[10px]">{STATUS_LABEL[o.delivery_status || ""] || o.delivery_status || "—"}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-[#A3A3A3] border-b border-[#3A2414]">
                        <tr>
                          <th className="text-left px-4 py-2">Pedido</th>
                          <th className="text-left px-4 py-2">Cliente</th>
                          <th className="text-left px-4 py-2">Data</th>
                          <th className="text-left px-4 py-2">Status</th>
                          <th className="text-left px-4 py-2">Endereço</th>
                          <th className="text-right px-4 py-2">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#3A2414]/60">
                        {recent.map((o) => (
                          <tr key={o.id}>
                            <td className="px-4 py-2 font-bold text-[#FF7A00]">#{o.id.slice(0,8)}</td>
                            <td className="px-4 py-2">{o.customer_name || "—"}</td>
                            <td className="px-4 py-2 text-xs text-[#A3A3A3]">{new Date(o.created_at).toLocaleDateString("pt-BR")}</td>
                            <td className="px-4 py-2"><Badge className="bg-[#3A2414]/60 text-[#D4A15A] border-[#3A2414] text-[10px]">{STATUS_LABEL[o.delivery_status || ""] || o.delivery_status || "—"}</Badge></td>
                            <td className="px-4 py-2 text-xs text-[#A3A3A3] max-w-[280px] truncate">{o.delivery_address || "—"}</td>
                            <td className="px-4 py-2 text-right">R$ {Number(o.total_amount || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="border border-[#3A2414] bg-[#0d0907] rounded-xl p-4">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[#A3A3A3]">
        {icon} {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-[#E7D3B1]">{value}</div>
    </div>
  );
}