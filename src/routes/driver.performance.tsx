import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Bike, ArrowLeft, LogOut, Loader2, Play, Square, Trophy, Target, Clock, Package, DollarSign, Calendar, TrendingUp, Flame } from "lucide-react";
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid } from "recharts";
import { GamificationPanel } from "@/components/driver/GamificationPanel";

export const Route = createFileRoute("/driver/performance")({
  component: DriverPerformance,
});

type Order = {
  id: string;
  customer_name: string | null;
  delivery_address: string | null;
  total_amount: number | null;
  delivery_fee: number | null;
  delivery_status: string | null;
  delivery_driver_id: string | null;
  created_at: string;
  updated_at: string | null;
};

type Shift = {
  id: string;
  driver_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
};

type Goal = { id: string; period: "day" | "week" | "month"; target: number };

const STATUS_LABEL: Record<string, string> = {
  aguardando_entregador: "Aguardando",
  em_entrega: "Em Entrega",
  entregue: "Entregue",
  saiu_para_entrega: "Saiu p/ Entrega",
  pronto_para_entrega: "Pronto",
  pedido_recebido: "Recebido",
  em_preparo: "Em Preparo",
};

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function startOfWeek(d: Date) { const x = startOfDay(d); const dow = x.getDay(); x.setDate(x.getDate() - dow); return x; }
function startOfMonth(d: Date) { const x = startOfDay(d); x.setDate(1); return x; }
function fmtMoney(n: number) { return `R$ ${n.toFixed(2)}`; }
function fmtHours(sec: number) {
  const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`;
}

function DriverPerformance() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [driverName, setDriverName] = useState("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [historyFilter, setHistoryFilter] = useState<"hoje" | "semana" | "mes" | "custom">("semana");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { navigate({ to: "/driver", replace: true }); return; }
      const { data: acc } = await supabase
        .from("delivery_driver_users" as any)
        .select("driver_id, restaurant_id, active")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!acc || !(acc as any).active) { navigate({ to: "/driver", replace: true }); return; }
      if (!mounted) return;
      setDriverId((acc as any).driver_id);
      setRestaurantId((acc as any).restaurant_id);
      const { data: d } = await supabase
        .from("delivery_drivers" as any)
        .select("name")
        .eq("id", (acc as any).driver_id)
        .maybeSingle();
      if (mounted) {
        setDriverName((d as any)?.name || "");
        setLoading(false);
      }
      } catch (error) {
        console.error("Driver performance bootstrap failed:", error);
        if (mounted) navigate({ to: "/driver", replace: true });
      }
    })();
    return () => { mounted = false; };
  }, [navigate]);

  // Orders
  const { data: orders = [] } = useQuery({
    queryKey: ["driver-perf-orders", driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, customer_name, delivery_address, total_amount, delivery_fee, delivery_status, delivery_driver_id, created_at, updated_at")
        .eq("delivery_driver_id", driverId as string)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data || []) as Order[];
    },
  });

  // Shifts
  const { data: shifts = [] } = useQuery({
    queryKey: ["driver-perf-shifts", driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_shifts" as any)
        .select("id, driver_id, started_at, ended_at, duration_seconds")
        .eq("driver_id", driverId as string)
        .order("started_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as unknown as Shift[];
    },
  });

  // Goals
  const { data: goals = [] } = useQuery({
    queryKey: ["driver-perf-goals", driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_goals" as any)
        .select("id, period, target")
        .eq("driver_id", driverId as string);
      if (error) throw error;
      return (data || []) as unknown as Goal[];
    },
  });

  // Ranking (all drivers in restaurant)
  const { data: ranking = [] } = useQuery({
    queryKey: ["driver-perf-ranking", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const since = startOfMonth(new Date()).toISOString();
      const { data: drivers } = await supabase
        .from("delivery_drivers" as any)
        .select("id, name, restaurant_id")
        .eq("restaurant_id", restaurantId as string)
        .eq("active", true);
      const list = ((drivers as any) || []) as Array<{ id: string; name: string }>;
      const out: Array<{ id: string; name: string; deliveries: number; avgMin: number; revenue: number }> = [];
      for (const d of list) {
        const { data: os } = await supabase
          .from("orders")
          .select("id, total_amount, delivery_fee, created_at, updated_at, delivery_status")
          .eq("delivery_driver_id", d.id)
          .eq("delivery_status", "entregue")
          .gte("created_at", since)
          .limit(500);
        const arr = (os || []) as Order[];
        const deliveries = arr.length;
        const revenue = arr.reduce((acc, o) => acc + Number(o.delivery_fee || 0), 0);
        const withTime = arr.filter((o) => o.updated_at);
        const avgMin = withTime.length
          ? Math.round(withTime.reduce((acc, o) => acc + (new Date(o.updated_at as string).getTime() - new Date(o.created_at).getTime()), 0) / withTime.length / 60000)
          : 0;
        out.push({ id: d.id, name: d.name, deliveries, avgMin, revenue });
      }
      return out;
    },
    staleTime: 60_000,
  });

  // Derived metrics
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);

  const delivered = useMemo(() => orders.filter((o) => o.delivery_status === "entregue"), [orders]);
  const inRange = (o: Order, from: Date) => new Date(o.updated_at || o.created_at) >= from;

  const stats = useMemo(() => {
    const dayList = delivered.filter((o) => inRange(o, todayStart));
    const weekList = delivered.filter((o) => inRange(o, weekStart));
    const monthList = delivered.filter((o) => inRange(o, monthStart));
    const sum = (arr: Order[]) => arr.reduce((acc, o) => acc + Number(o.delivery_fee || 0), 0);
    const avg = (arr: Order[]) => {
      const wt = arr.filter((o) => o.updated_at);
      if (!wt.length) return 0;
      return Math.round(wt.reduce((acc, o) => acc + (new Date(o.updated_at as string).getTime() - new Date(o.created_at).getTime()), 0) / wt.length / 60000);
    };
    return {
      dayCount: dayList.length, weekCount: weekList.length, monthCount: monthList.length,
      dayMoney: sum(dayList), weekMoney: sum(weekList), monthMoney: sum(monthList),
      avgMin: avg(weekList),
    };
  }, [delivered, todayStart.getTime(), weekStart.getTime(), monthStart.getTime()]);

  // Active shift
  const activeShift = useMemo(() => shifts.find((s) => !s.ended_at) || null, [shifts]);
  const todayShiftSeconds = useMemo(() => {
    return shifts
      .filter((s) => new Date(s.started_at) >= todayStart)
      .reduce((acc, s) => {
        const end = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
        return acc + Math.max(0, Math.round((end - new Date(s.started_at).getTime()) / 1000));
      }, 0);
  }, [shifts, todayStart.getTime()]);

  const startShift = async () => {
    if (!driverId || !restaurantId) return;
    if (activeShift) return toast.error("Turno já iniciado");
    const { error } = await supabase.from("driver_shifts" as any).insert({
      driver_id: driverId,
      restaurant_id: restaurantId,
      started_at: new Date().toISOString(),
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Turno iniciado");
    qc.invalidateQueries({ queryKey: ["driver-perf-shifts"] });
  };

  const endShift = async () => {
    if (!activeShift) return;
    const dur = Math.max(1, Math.round((Date.now() - new Date(activeShift.started_at).getTime()) / 1000));
    const { error } = await supabase
      .from("driver_shifts" as any)
      .update({ ended_at: new Date().toISOString(), duration_seconds: dur } as any)
      .eq("id", activeShift.id);
    if (error) return toast.error(error.message);
    toast.success("Turno encerrado");
    qc.invalidateQueries({ queryKey: ["driver-perf-shifts"] });
  };

  const saveGoal = async (period: "day" | "week" | "month", target: number) => {
    if (!driverId || !restaurantId || !target) return;
    const existing = goals.find((g) => g.period === period);
    if (existing) {
      const { error } = await supabase.from("driver_goals" as any).update({ target } as any).eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("driver_goals" as any).insert({
        driver_id: driverId, restaurant_id: restaurantId, period, target,
      } as any);
      if (error) return toast.error(error.message);
    }
    toast.success("Meta salva");
    qc.invalidateQueries({ queryKey: ["driver-perf-goals"] });
  };

  // History filtering
  const historyOrders = useMemo(() => {
    let from: Date | null = null;
    let to: Date | null = null;
    if (historyFilter === "hoje") from = todayStart;
    else if (historyFilter === "semana") from = weekStart;
    else if (historyFilter === "mes") from = monthStart;
    else if (historyFilter === "custom") {
      if (customFrom) from = new Date(customFrom);
      if (customTo) { to = new Date(customTo); to.setHours(23,59,59,999); }
    }
    return orders.filter((o) => {
      const d = new Date(o.created_at);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [orders, historyFilter, customFrom, customTo, todayStart.getTime(), weekStart.getTime(), monthStart.getTime()]);

  // Charts: last 14 days
  const chartData = useMemo(() => {
    const days: { date: string; entregas: number; ganhos: number; tempo: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = startOfDay(new Date()); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const arr = delivered.filter((o) => {
        const at = new Date(o.updated_at || o.created_at);
        return at >= d && at < next;
      });
      const ganhos = arr.reduce((acc, o) => acc + Number(o.delivery_fee || 0), 0);
      const wt = arr.filter((o) => o.updated_at);
      const tempo = wt.length
        ? Math.round(wt.reduce((acc, o) => acc + (new Date(o.updated_at as string).getTime() - new Date(o.created_at).getTime()), 0) / wt.length / 60000)
        : 0;
      days.push({ date: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), entregas: arr.length, ganhos, tempo });
    }
    return days;
  }, [delivered]);

  // Goal progress
  const goalProgress = useMemo(() => {
    const find = (p: "day" | "week" | "month") => goals.find((g) => g.period === p)?.target || 0;
    return [
      { period: "Diária", target: find("day"), current: stats.dayCount },
      { period: "Semanal", target: find("week"), current: stats.weekCount },
      { period: "Mensal", target: find("month"), current: stats.monthCount },
    ];
  }, [goals, stats]);

  const myRank = useMemo(() => {
    const sorted = [...ranking].sort((a, b) => b.deliveries - a.deliveries);
    const idx = sorted.findIndex((r) => r.id === driverId);
    return idx >= 0 ? idx + 1 : null;
  }, [ranking, driverId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/driver", replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-[#E7D3B1] flex items-center justify-center">
        <Flame className="w-8 h-8 text-[#FF7A00] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-[#E7D3B1]">
      <header className="border-b border-[#3A2414] bg-[#0d0907]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Bike className="w-5 h-5 text-[#FF7A00] shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base font-bold truncate">Performance</h1>
              <p className="text-xs text-[#A3A3A3] truncate">{driverName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/driver">
              <Button variant="ghost" size="sm" className="text-[#D4A15A] hover:text-[#FF7A00]">
                <ArrowLeft className="w-4 h-4 mr-1" /> Entregas
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-[#D4A15A] hover:text-[#FF7A00]">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* MÓDULO 1 — Resumo */}
        <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatCard icon={<Package className="w-4 h-4" />} label="Entregas Hoje" value={stats.dayCount} />
          <StatCard icon={<Package className="w-4 h-4" />} label="Entregas Semana" value={stats.weekCount} />
          <StatCard icon={<Package className="w-4 h-4" />} label="Entregas Mês" value={stats.monthCount} />
          <StatCard icon={<DollarSign className="w-4 h-4" />} label="Ganhos Hoje" value={fmtMoney(stats.dayMoney)} />
          <StatCard icon={<DollarSign className="w-4 h-4" />} label="Ganhos Semana" value={fmtMoney(stats.weekMoney)} />
          <StatCard icon={<DollarSign className="w-4 h-4" />} label="Ganhos Mês" value={fmtMoney(stats.monthMoney)} />
          <StatCard icon={<Clock className="w-4 h-4" />} label="Tempo Médio" value={stats.avgMin ? `${stats.avgMin} min` : "—"} />
        </section>

        {/* MÓDULO 3 — Jornada */}
        <section className="border border-[#3A2414] bg-[#0d0907] rounded-xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[#D4A15A] flex items-center gap-2"><Clock className="w-4 h-4" /> Controle de Jornada</h2>
              <p className="text-xs text-[#A3A3A3] mt-1">
                {activeShift
                  ? <>Turno ativo desde {new Date(activeShift.started_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</>
                  : "Nenhum turno ativo"}
              </p>
              <p className="text-xs text-[#A3A3A3]">Horas hoje: <span className="text-[#E7D3B1] font-semibold">{fmtHours(todayShiftSeconds)}</span></p>
            </div>
            <div className="flex gap-2">
              <Button onClick={startShift} disabled={!!activeShift} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Play className="w-4 h-4 mr-1" /> Iniciar Turno
              </Button>
              <Button onClick={endShift} disabled={!activeShift} size="sm" variant="destructive">
                <Square className="w-4 h-4 mr-1" /> Encerrar Turno
              </Button>
            </div>
          </div>
        </section>

        <Tabs defaultValue="history" className="w-full">
          <TabsList className="bg-[#0d0907] border border-[#3A2414]">
            <TabsTrigger value="history">Histórico</TabsTrigger>
            <TabsTrigger value="goals">Metas</TabsTrigger>
            <TabsTrigger value="ranking">Ranking</TabsTrigger>
            <TabsTrigger value="charts">Estatísticas</TabsTrigger>
            <TabsTrigger value="gamification">Gamificação</TabsTrigger>
          </TabsList>

          {/* MÓDULO 2 — Histórico */}
          <TabsContent value="history" className="space-y-3">
            <div className="flex flex-wrap gap-2 items-end">
              {(["hoje", "semana", "mes", "custom"] as const).map((k) => (
                <button key={k} onClick={() => setHistoryFilter(k)}
                  className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${historyFilter === k ? "bg-[#FF7A00] text-black border-[#FF7A00] font-semibold" : "bg-[#0d0907] border-[#3A2414] text-[#D4A15A] hover:border-[#FF7A00]/50"}`}>
                  {k === "hoje" ? "Hoje" : k === "semana" ? "Semana" : k === "mes" ? "Mês" : "Personalizado"}
                </button>
              ))}
              {historyFilter === "custom" && (
                <div className="flex gap-2">
                  <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="bg-[#1a1a1a] border-[#3A2414] h-8 text-xs" />
                  <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="bg-[#1a1a1a] border-[#3A2414] h-8 text-xs" />
                </div>
              )}
            </div>

            <div className="border border-[#3A2414] bg-[#0d0907] rounded-xl overflow-hidden">
              {historyOrders.length === 0 ? (
                <div className="p-6 text-center text-sm text-[#A3A3A3]">Nenhum pedido no período.</div>
              ) : (
                <>
                  <div className="md:hidden divide-y divide-[#3A2414]/60">
                    {historyOrders.map((o) => {
                      const min = o.updated_at ? Math.round((new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / 60000) : null;
                      return (
                        <div key={o.id} className="p-3 text-sm">
                          <div className="flex justify-between gap-2">
                            <span className="font-bold text-[#FF7A00]">#{o.id.slice(0, 8)}</span>
                            <span>{fmtMoney(Number(o.delivery_fee || 0))}</span>
                          </div>
                          <div className="text-xs mt-1">{o.customer_name || "—"}</div>
                          {o.delivery_address && <div className="text-[11px] text-[#A3A3A3] truncate">{o.delivery_address}</div>}
                          <div className="flex items-center justify-between mt-1 text-[11px]">
                            <span className="text-[#A3A3A3]">{new Date(o.created_at).toLocaleString("pt-BR")}</span>
                            <Badge className="bg-[#3A2414]/60 text-[#D4A15A] border-[#3A2414] text-[10px]">{STATUS_LABEL[o.delivery_status || ""] || "—"}</Badge>
                          </div>
                          {min !== null && <div className="text-[11px] text-[#A3A3A3] mt-0.5">Tempo: {min} min</div>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-[#A3A3A3] border-b border-[#3A2414]">
                        <tr>
                          <th className="text-left px-4 py-2">Pedido</th>
                          <th className="text-left px-4 py-2">Cliente</th>
                          <th className="text-left px-4 py-2">Endereço</th>
                          <th className="text-left px-4 py-2">Data/Hora</th>
                          <th className="text-left px-4 py-2">Tempo</th>
                          <th className="text-left px-4 py-2">Status</th>
                          <th className="text-right px-4 py-2">Taxa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#3A2414]/60">
                        {historyOrders.map((o) => {
                          const min = o.updated_at ? Math.round((new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / 60000) : null;
                          return (
                            <tr key={o.id}>
                              <td className="px-4 py-2 font-bold text-[#FF7A00]">#{o.id.slice(0, 8)}</td>
                              <td className="px-4 py-2">{o.customer_name || "—"}</td>
                              <td className="px-4 py-2 text-xs text-[#A3A3A3] max-w-[260px] truncate">{o.delivery_address || "—"}</td>
                              <td className="px-4 py-2 text-xs text-[#A3A3A3]">{new Date(o.created_at).toLocaleString("pt-BR")}</td>
                              <td className="px-4 py-2 text-xs">{min !== null ? `${min} min` : "—"}</td>
                              <td className="px-4 py-2"><Badge className="bg-[#3A2414]/60 text-[#D4A15A] border-[#3A2414] text-[10px]">{STATUS_LABEL[o.delivery_status || ""] || "—"}</Badge></td>
                              <td className="px-4 py-2 text-right">{fmtMoney(Number(o.delivery_fee || 0))}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* MÓDULO 5 — Metas */}
          <TabsContent value="goals" className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {goalProgress.map((g) => {
                const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
                const remaining = Math.max(0, g.target - g.current);
                return (
                  <div key={g.period} className="border border-[#3A2414] bg-[#0d0907] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-[#D4A15A] flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Meta {g.period}</span>
                      <span className="text-xs text-[#A3A3A3]">{g.current}/{g.target || "—"}</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                    <div className="text-xs text-[#A3A3A3] mt-2">
                      {g.target > 0 ? <>{pct}% • Faltam {remaining} entregas</> : "Sem meta definida"}
                    </div>
                    <GoalForm period={g.period === "Diária" ? "day" : g.period === "Semanal" ? "week" : "month"} initial={g.target} onSave={saveGoal} />
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* MÓDULO 4 — Ranking */}
          <TabsContent value="ranking" className="space-y-3">
            <div className="border border-[#3A2414] bg-[#0d0907] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#3A2414] flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#D4A15A] flex items-center gap-2"><Trophy className="w-4 h-4" /> Ranking do Mês</h2>
                {myRank && <Badge className="bg-[#FF7A00]/20 text-[#FF7A00] border-[#FF7A00]/40">Sua posição: {myRank}º</Badge>}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-[#A3A3A3] border-b border-[#3A2414]">
                    <tr>
                      <th className="text-left px-4 py-2">Pos.</th>
                      <th className="text-left px-4 py-2">Entregador</th>
                      <th className="text-right px-4 py-2">Entregas</th>
                      <th className="text-right px-4 py-2">Tempo Médio</th>
                      <th className="text-right px-4 py-2">Faturamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3A2414]/60">
                    {[...ranking].sort((a, b) => b.deliveries - a.deliveries).map((r, i) => (
                      <tr key={r.id} className={r.id === driverId ? "bg-[#FF7A00]/5" : ""}>
                        <td className="px-4 py-2 font-bold text-[#FF7A00]">{i + 1}º</td>
                        <td className="px-4 py-2">{r.name}{r.id === driverId && <span className="text-[10px] text-[#FF7A00] ml-1">(você)</span>}</td>
                        <td className="px-4 py-2 text-right">{r.deliveries}</td>
                        <td className="px-4 py-2 text-right">{r.avgMin ? `${r.avgMin} min` : "—"}</td>
                        <td className="px-4 py-2 text-right">{fmtMoney(r.revenue)}</td>
                      </tr>
                    ))}
                    {ranking.length === 0 && (
                      <tr><td colSpan={5} className="text-center text-[#A3A3A3] py-6 text-sm">Sem dados de ranking ainda.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* MÓDULO 6 — Estatísticas */}
          <TabsContent value="charts" className="space-y-4">
            <ChartCard title="Entregas por dia (últimos 14 dias)" icon={<Package className="w-4 h-4" />}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3A2414" />
                <XAxis dataKey="date" stroke="#A3A3A3" fontSize={11} />
                <YAxis stroke="#A3A3A3" fontSize={11} allowDecimals={false} />
                <RTooltip contentStyle={{ background: "#0d0907", border: "1px solid #3A2414", borderRadius: 8, color: "#E7D3B1" }} cursor={{ fill: "rgba(255,122,0,0.08)" }} />
                <Bar dataKey="entregas" fill="#FF7A00" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>
            <ChartCard title="Ganhos por dia (R$)" icon={<DollarSign className="w-4 h-4" />}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3A2414" />
                <XAxis dataKey="date" stroke="#A3A3A3" fontSize={11} />
                <YAxis stroke="#A3A3A3" fontSize={11} />
                <RTooltip contentStyle={{ background: "#0d0907", border: "1px solid #3A2414", borderRadius: 8, color: "#E7D3B1" }} />
                <Line type="monotone" dataKey="ganhos" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartCard>
            <ChartCard title="Tempo médio de entrega (min)" icon={<TrendingUp className="w-4 h-4" />}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3A2414" />
                <XAxis dataKey="date" stroke="#A3A3A3" fontSize={11} />
                <YAxis stroke="#A3A3A3" fontSize={11} />
                <RTooltip contentStyle={{ background: "#0d0907", border: "1px solid #3A2414", borderRadius: 8, color: "#E7D3B1" }} />
                <Line type="monotone" dataKey="tempo" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartCard>
          </TabsContent>

          <TabsContent value="gamification" className="space-y-3">
            {driverId && restaurantId ? (
              <GamificationPanel driverId={driverId} restaurantId={restaurantId} />
            ) : (
              <div className="text-xs text-[#A3A3A3]">Carregando...</div>
            )}
          </TabsContent>
        </Tabs>

        {/* Histórico de Turnos */}
        <section className="border border-[#3A2414] bg-[#0d0907] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#3A2414]">
            <h2 className="text-sm font-bold text-[#D4A15A] flex items-center gap-2"><Calendar className="w-4 h-4" /> Últimos Turnos</h2>
          </div>
          {shifts.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#A3A3A3]">Nenhum turno registrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-[#A3A3A3] border-b border-[#3A2414]">
                  <tr>
                    <th className="text-left px-4 py-2">Início</th>
                    <th className="text-left px-4 py-2">Fim</th>
                    <th className="text-right px-4 py-2">Duração</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3A2414]/60">
                  {shifts.slice(0, 20).map((s) => {
                    const dur = s.duration_seconds ?? (s.ended_at ? Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000) : null);
                    return (
                      <tr key={s.id}>
                        <td className="px-4 py-2 text-xs">{new Date(s.started_at).toLocaleString("pt-BR")}</td>
                        <td className="px-4 py-2 text-xs">{s.ended_at ? new Date(s.ended_at).toLocaleString("pt-BR") : <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/40 text-[10px]">Em andamento</Badge>}</td>
                        <td className="px-4 py-2 text-right text-xs">{dur !== null ? fmtHours(dur) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="border border-[#3A2414] bg-[#0d0907] rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#A3A3A3]">
        {icon}<span>{label}</span>
      </div>
      <div className="text-lg font-bold text-[#E7D3B1] mt-1">{value}</div>
    </div>
  );
}

function ChartCard({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactElement }) {
  return (
    <section className="border border-[#3A2414] bg-[#0d0907] rounded-xl p-4 sm:p-5">
      <h3 className="text-sm font-bold text-[#D4A15A] mb-3 flex items-center gap-2">{icon}{title}</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </section>
  );
}

function GoalForm({ period, initial, onSave }: { period: "day" | "week" | "month"; initial: number; onSave: (p: "day" | "week" | "month", t: number) => void }) {
  const [v, setV] = useState(initial ? String(initial) : "");
  useEffect(() => { setV(initial ? String(initial) : ""); }, [initial]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); const n = parseInt(v, 10); if (n > 0) onSave(period, n); }} className="flex gap-2 mt-3">
      <Input type="number" min={1} value={v} onChange={(e) => setV(e.target.value)} placeholder="Ex: 20" className="h-8 bg-[#1a1a1a] border-[#3A2414] text-xs" />
      <Button type="submit" size="sm" className="h-8 bg-[#FF7A00] hover:bg-[#FF7A00]/90 text-black font-semibold text-xs">Salvar</Button>
    </form>
  );
}