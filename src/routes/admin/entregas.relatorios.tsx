import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Flame, Loader2, Truck, CheckCircle2, Clock, Trophy, Percent, Bike, BarChart3,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { checkIsAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/entregas/relatorios")({
  component: RelatoriosPage,
});

type Preset = "hoje" | "ontem" | "7d" | "30d" | "custom";

type DeliveryStatus = "aguardando_entregador" | "em_entrega" | "entregue";

type OrderRow = {
  id: string;
  customer_name: string | null;
  total_amount: number;
  status: string;
  created_at: string;
  delivery_driver_id: string | null;
  delivery_status: DeliveryStatus | null;
  delivery_started_at: string | null;
  delivery_completed_at: string | null;
};

type Driver = { id: string; name: string };

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseLocalInput(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function fmtMinutes(min: number | null) {
  if (min == null || !isFinite(min)) return "—";
  if (min < 1) return "<1 min";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}
function fmtBRL(n: number) {
  return `R$ ${Number(n || 0).toFixed(2).replace(".", ",")}`;
}
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function presetRange(p: Preset, customFrom?: string, customTo?: string): { from: Date; to: Date } {
  const now = new Date();
  if (p === "hoje") return { from: startOfDay(now), to: endOfDay(now) };
  if (p === "ontem") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { from: startOfDay(y), to: endOfDay(y) };
  }
  if (p === "7d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    return { from: startOfDay(from), to: endOfDay(now) };
  }
  if (p === "30d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 29);
    return { from: startOfDay(from), to: endOfDay(now) };
  }
  const f = customFrom ? parseLocalInput(customFrom) : startOfDay(now);
  const t = customTo ? parseLocalInput(customTo) : now;
  return { from: startOfDay(f), to: endOfDay(t) };
}

function RelatoriosPage() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [preset, setPreset] = useState<Preset>("hoje");
  const [customFrom, setCustomFrom] = useState<string>(toLocalInput(new Date()));
  const [customTo, setCustomTo] = useState<string>(toLocalInput(new Date()));
  const [driverFilter, setDriverFilter] = useState<string>("all");

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

  const range = useMemo(
    () => presetRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  const { data: drivers = [] } = useQuery({
    queryKey: ["delivery_drivers_all"],
    enabled: authChecked,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_drivers" as any)
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Driver[];
    },
  });

  // All delivery orders in the range (by created_at) for ranking/history.
  const { data: rangeOrders = [], isLoading } = useQuery({
    queryKey: ["delivery_reports_range", range.from.toISOString(), range.to.toISOString()],
    enabled: authChecked,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, customer_name, total_amount, status, created_at, delivery_driver_id, delivery_status, delivery_started_at, delivery_completed_at",
        )
        .eq("source", "online")
        .not("delivery_address", "is", null)
        .gte("created_at", range.from.toISOString())
        .lte("created_at", range.to.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as OrderRow[];
    },
  });

  // Live indicators (today + currently in-transit) — independent of the range.
  const { data: liveIndicators } = useQuery({
    queryKey: ["delivery_live_indicators"],
    enabled: authChecked,
    refetchInterval: 30_000,
    queryFn: async () => {
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();
      const [delivered, inTransit] = await Promise.all([
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("delivery_status", "entregue")
          .gte("delivery_completed_at", todayStart)
          .lte("delivery_completed_at", todayEnd),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("delivery_status", "em_entrega"),
      ]);
      return {
        deliveredToday: delivered.count || 0,
        inTransit: inTransit.count || 0,
      };
    },
  });

  const filteredOrders = useMemo(() => {
    if (driverFilter === "all") return rangeOrders;
    return rangeOrders.filter((o) => o.delivery_driver_id === driverFilter);
  }, [rangeOrders, driverFilter]);

  const metrics = useMemo(() => {
    const totalAssigned = filteredOrders.filter((o) => o.delivery_driver_id).length;
    const delivered = filteredOrders.filter((o) => o.delivery_status === "entregue");
    const cancelled = filteredOrders.filter((o) => o.status === "cancelled");
    const durations = delivered
      .map((o) => {
        const start = o.delivery_started_at ? new Date(o.delivery_started_at).getTime() : null;
        const end = o.delivery_completed_at ? new Date(o.delivery_completed_at).getTime() : null;
        if (!start || !end || end < start) return null;
        return (end - start) / 60000;
      })
      .filter((x): x is number => x != null);
    const avgMin =
      durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

    const byDriver = new Map<
      string,
      { id: string; name: string; total: number; delivered: number; cancelled: number; durations: number[] }
    >();
    for (const o of filteredOrders) {
      if (!o.delivery_driver_id) continue;
      const driver = drivers.find((d) => d.id === o.delivery_driver_id);
      const key = o.delivery_driver_id;
      const cur =
        byDriver.get(key) ??
        {
          id: key,
          name: driver?.name || "—",
          total: 0,
          delivered: 0,
          cancelled: 0,
          durations: [] as number[],
        };
      cur.total += 1;
      if (o.delivery_status === "entregue") cur.delivered += 1;
      if (o.status === "cancelled") cur.cancelled += 1;
      if (o.delivery_started_at && o.delivery_completed_at) {
        const dur =
          (new Date(o.delivery_completed_at).getTime() -
            new Date(o.delivery_started_at).getTime()) /
          60000;
        if (dur >= 0) cur.durations.push(dur);
      }
      byDriver.set(key, cur);
    }
    const ranking = Array.from(byDriver.values())
      .map((d) => ({
        ...d,
        avg: d.durations.length > 0 ? d.durations.reduce((a, b) => a + b, 0) / d.durations.length : null,
      }))
      .sort((a, b) => b.delivered - a.delivered);

    const topDriver = ranking[0] || null;
    const completionRate =
      totalAssigned > 0 ? (delivered.length / totalAssigned) * 100 : null;

    return {
      totalAssigned,
      delivered: delivered.length,
      cancelled: cancelled.length,
      avgMin,
      topDriver,
      completionRate,
      ranking,
    };
  }, [filteredOrders, drivers]);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-black text-[#E7D3B1] flex items-center justify-center">
        <Flame className="w-8 h-8 text-[#FF7A00] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-[#E7D3B1]">
      <header className="border-b border-[#3A2414] bg-[#0d0907]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/admin"
              className="flex items-center gap-1.5 text-xs text-[#D4A15A] hover:text-[#FF7A00]"
            >
              <ArrowLeft className="w-4 h-4" /> Admin
            </Link>
            <div className="h-5 w-px bg-[#3A2414]" />
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#FF7A00]" />
              <h1 className="text-lg md:text-xl font-bold text-[#E7D3B1]">
                Relatórios de Entrega
              </h1>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 md:px-8 pb-3 flex gap-2 flex-wrap">
          <Link
            to="/admin/entregas"
            className="px-3 py-1.5 rounded-md text-xs font-semibold border border-[#3A2414] text-[#D4A15A] hover:text-[#FF7A00] hover:border-[#FF7A00]/50"
          >
            Entregadores
          </Link>
          <Link
            to="/admin/entregas/pedidos"
            className="px-3 py-1.5 rounded-md text-xs font-semibold border border-[#3A2414] text-[#D4A15A] hover:text-[#FF7A00] hover:border-[#FF7A00]/50"
          >
            Pedidos de Entrega
          </Link>
          <Link
            to="/admin/entregas/relatorios"
            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-[#FF7A00] text-black"
          >
            Relatórios
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-6">
        {/* Indicadores ao vivo */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <IndicatorCard
            icon={<CheckCircle2 className="w-4 h-4" />}
            label="Entregues Hoje"
            value={String(liveIndicators?.deliveredToday ?? "—")}
            tint="emerald"
          />
          <IndicatorCard
            icon={<Truck className="w-4 h-4" />}
            label="Em Entrega"
            value={String(liveIndicators?.inTransit ?? "—")}
            tint="blue"
          />
          <IndicatorCard
            icon={<Clock className="w-4 h-4" />}
            label="Tempo Médio"
            value={fmtMinutes(metrics.avgMin)}
            tint="amber"
          />
          <IndicatorCard
            icon={<Trophy className="w-4 h-4" />}
            label="Top Entregador"
            value={metrics.topDriver ? `${metrics.topDriver.name}` : "—"}
            sub={metrics.topDriver ? `${metrics.topDriver.delivered} entregas` : undefined}
            tint="orange"
          />
          <IndicatorCard
            icon={<Percent className="w-4 h-4" />}
            label="Taxa de Conclusão"
            value={
              metrics.completionRate == null
                ? "—"
                : `${metrics.completionRate.toFixed(0)}%`
            }
            tint="emerald"
          />
        </section>

        {/* Filtros */}
        <section className="rounded-xl border border-[#3A2414] bg-[#0d0907] p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {([
              ["hoje", "Hoje"],
              ["ontem", "Ontem"],
              ["7d", "7 dias"],
              ["30d", "30 dias"],
              ["custom", "Personalizado"],
            ] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setPreset(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                  preset === v
                    ? "bg-[#FF7A00] border-[#FF7A00] text-black"
                    : "border-[#3A2414] text-[#D4A15A] hover:text-[#FF7A00]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {preset === "custom" && (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-[#A3A3A3] mb-1">
                  De
                </label>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="bg-[#1a1a1a] border-[#3A2414] text-[#E7D3B1] w-[160px]"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-[#A3A3A3] mb-1">
                  Até
                </label>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="bg-[#1a1a1a] border-[#3A2414] text-[#E7D3B1] w-[160px]"
                />
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[10px] uppercase tracking-wide text-[#A3A3A3]">
              Entregador
            </span>
            <button
              onClick={() => setDriverFilter("all")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
                driverFilter === "all"
                  ? "bg-[#FF7A00] border-[#FF7A00] text-black"
                  : "border-[#3A2414] text-[#D4A15A] hover:text-[#FF7A00]"
              }`}
            >
              Todos
            </button>
            {drivers.map((d) => (
              <button
                key={d.id}
                onClick={() => setDriverFilter(d.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
                  driverFilter === d.id
                    ? "bg-[#FF7A00] border-[#FF7A00] text-black"
                    : "border-[#3A2414] text-[#D4A15A] hover:text-[#FF7A00]"
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>
        </section>

        {/* Ranking Operacional */}
        <section className="rounded-xl border border-[#3A2414] bg-[#0d0907] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#3A2414] flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#FF7A00]" />
            <h2 className="text-sm font-bold text-[#E7D3B1]">Ranking Operacional</h2>
          </div>
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-[#FF7A00]" />
            </div>
          ) : metrics.ranking.length === 0 ? (
            <div className="p-8 text-center text-[#A3A3A3] text-sm">
              Sem dados de entregas no período.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#1a1a1a]/60 text-[#A3A3A3] text-[11px] uppercase">
                  <tr>
                    <th className="text-left px-4 py-2">Entregador</th>
                    <th className="text-right px-4 py-2">Entregas</th>
                    <th className="text-right px-4 py-2">Concluídas</th>
                    <th className="text-right px-4 py-2">Canceladas</th>
                    <th className="text-right px-4 py-2">Tempo Médio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3A2414]/60">
                  {metrics.ranking.map((r, idx) => (
                    <tr key={r.id} className="hover:bg-[#1a1a1a]/60">
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-5 text-[#FF7A00] font-bold text-xs">
                            {idx + 1}º
                          </span>
                          <Bike className="w-3.5 h-3.5 text-[#D4A15A]" />
                          {r.name}
                        </span>
                      </td>
                      <td className="text-right px-4 py-2">{r.total}</td>
                      <td className="text-right px-4 py-2 text-emerald-400">
                        {r.delivered}
                      </td>
                      <td className="text-right px-4 py-2 text-red-400">
                        {r.cancelled}
                      </td>
                      <td className="text-right px-4 py-2 text-[#D4A15A]">
                        {fmtMinutes(r.avg)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Histórico */}
        <section className="rounded-xl border border-[#3A2414] bg-[#0d0907] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#3A2414] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#FF7A00]" />
              <h2 className="text-sm font-bold text-[#E7D3B1]">Histórico</h2>
            </div>
            <span className="text-[11px] text-[#A3A3A3]">
              {filteredOrders.length} pedido(s)
            </span>
          </div>
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-[#FF7A00]" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-[#A3A3A3] text-sm">
              Nenhum pedido no período.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#1a1a1a]/60 text-[#A3A3A3] text-[11px] uppercase">
                  <tr>
                    <th className="text-left px-4 py-2">Data</th>
                    <th className="text-left px-4 py-2">Pedido</th>
                    <th className="text-left px-4 py-2">Cliente</th>
                    <th className="text-left px-4 py-2">Entregador</th>
                    <th className="text-right px-4 py-2">Valor</th>
                    <th className="text-right px-4 py-2">Tempo</th>
                    <th className="text-right px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3A2414]/60">
                  {filteredOrders.map((o) => {
                    const driver = drivers.find((d) => d.id === o.delivery_driver_id);
                    const dur =
                      o.delivery_started_at && o.delivery_completed_at
                        ? (new Date(o.delivery_completed_at).getTime() -
                            new Date(o.delivery_started_at).getTime()) /
                          60000
                        : null;
                    const st = o.delivery_status;
                    const stLabel =
                      st === "entregue"
                        ? "Entregue"
                        : st === "em_entrega"
                          ? "Em Entrega"
                          : st === "aguardando_entregador"
                            ? "Aguardando"
                            : o.status === "cancelled"
                              ? "Cancelado"
                              : "—";
                    return (
                      <tr key={o.id} className="hover:bg-[#1a1a1a]/60">
                        <td className="px-4 py-2 text-[#A3A3A3] whitespace-nowrap">
                          {fmtDateTime(o.created_at)}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-[#FF7A00]">
                          #{o.id.slice(0, 8)}
                        </td>
                        <td className="px-4 py-2">{o.customer_name || "—"}</td>
                        <td className="px-4 py-2 text-[#D4A15A]">
                          {driver?.name || "—"}
                        </td>
                        <td className="text-right px-4 py-2">{fmtBRL(o.total_amount)}</td>
                        <td className="text-right px-4 py-2">{fmtMinutes(dur)}</td>
                        <td className="text-right px-4 py-2">
                          <Badge
                            className={
                              st === "entregue"
                                ? "bg-emerald-600/20 text-emerald-400 border-emerald-600/40"
                                : st === "em_entrega"
                                  ? "bg-blue-600/20 text-blue-400 border-blue-600/40"
                                  : o.status === "cancelled"
                                    ? "bg-red-600/20 text-red-400 border-red-600/40"
                                    : "bg-amber-600/20 text-amber-400 border-amber-600/40"
                            }
                          >
                            {stLabel}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Métricas futuras (placeholder estrutural) */}
        <section className="rounded-xl border border-dashed border-[#3A2414] bg-[#0d0907]/40 p-4">
          <div className="text-xs text-[#A3A3A3]">
            <strong className="text-[#D4A15A]">Métricas futuras (preparado):</strong> GPS ·
            Rastreamento em tempo real · App do entregador. Sem implementação nesta fase.
          </div>
        </section>
      </main>
    </div>
  );
}

function IndicatorCard({
  icon,
  label,
  value,
  sub,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tint: "emerald" | "blue" | "amber" | "orange";
}) {
  const tintMap: Record<string, string> = {
    emerald: "text-emerald-400 bg-emerald-600/15 border-emerald-600/30",
    blue: "text-blue-400 bg-blue-600/15 border-blue-600/30",
    amber: "text-amber-400 bg-amber-600/15 border-amber-600/30",
    orange: "text-[#FF7A00] bg-[#FF7A00]/15 border-[#FF7A00]/30",
  };
  return (
    <div className="rounded-xl border border-[#3A2414] bg-[#0d0907] p-3">
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase ${tintMap[tint]}`}
      >
        {icon}
        {label}
      </div>
      <div className="mt-2 text-xl font-bold text-[#E7D3B1] truncate">{value}</div>
      {sub && <div className="text-[11px] text-[#A3A3A3] truncate">{sub}</div>}
    </div>
  );
}