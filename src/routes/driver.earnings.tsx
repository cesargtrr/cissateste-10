import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, DollarSign, Loader2, TrendingUp, Package, Wallet, Calendar, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/driver/earnings")({
  component: DriverEarnings,
});

type Earning = {
  id: string;
  restaurant_id: string;
  driver_id: string;
  order_id: string;
  delivery_fee: number;
  bonus_amount: number;
  discount_amount: number;
  total_earned: number;
  status: "pending" | "paid";
  created_at: string;
};

type OrderInfo = {
  id: string;
  customer_name: string | null;
  short: string;
};

type Period = "hoje" | "7d" | "30d" | "custom";

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function daysAgo(n: number) { const x = startOfDay(new Date()); x.setDate(x.getDate() - n); return x; }
function fmtBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
}
function fmtDate(s: string) {
  return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const PAGE_SIZE = 20;

function DriverEarnings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [driverName, setDriverName] = useState("");
  const [period, setPeriod] = useState<Period>("7d");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { navigate({ to: "/driver", replace: true }); return; }
      const { data: acc } = await supabase
        .from("delivery_driver_users" as any)
        .select("driver_id, active")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!acc || !(acc as any).active) { navigate({ to: "/driver", replace: true }); return; }
      if (!mounted) return;
      const dId = (acc as any).driver_id as string;
      setDriverId(dId);
      const { data: d } = await supabase
        .from("delivery_drivers" as any)
        .select("name")
        .eq("id", dId)
        .maybeSingle();
      if (mounted) {
        setDriverName((d as any)?.name || "");
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [navigate]);

  // Realtime: auto-refresh on insert/update
  useEffect(() => {
    if (!driverId) return;
    const channel = supabase
      .channel(`driver_earnings_${driverId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_earnings", filter: `driver_id=eq.${driverId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["driver-earnings"] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [driverId, queryClient]);

  const { data: earnings = [], isLoading } = useQuery({
    queryKey: ["driver-earnings", driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_earnings" as any)
        .select("*")
        .eq("driver_id", driverId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as unknown as Earning[];
    },
  });

  const orderIds = useMemo(() => Array.from(new Set(earnings.map((e) => e.order_id))), [earnings]);

  const { data: ordersById = {} } = useQuery({
    queryKey: ["driver-earnings-orders", orderIds.join(",")],
    enabled: orderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, customer_name")
        .in("id", orderIds);
      if (error) throw error;
      const map: Record<string, OrderInfo> = {};
      (data || []).forEach((o: any) => {
        map[o.id] = { id: o.id, customer_name: o.customer_name, short: String(o.id).slice(0, 8) };
      });
      return map;
    },
  });

  const range = useMemo(() => {
    const now = new Date();
    if (period === "hoje") return { start: startOfDay(now), end: endOfDay(now) };
    if (period === "7d") return { start: daysAgo(6), end: endOfDay(now) };
    if (period === "30d") return { start: daysAgo(29), end: endOfDay(now) };
    const start = from ? startOfDay(new Date(from)) : daysAgo(29);
    const end = to ? endOfDay(new Date(to)) : endOfDay(now);
    return { start, end };
  }, [period, from, to]);

  const filtered = useMemo(() => {
    return earnings.filter((e) => {
      const t = new Date(e.created_at).getTime();
      return t >= range.start.getTime() && t <= range.end.getTime();
    });
  }, [earnings, range]);

  const stats = useMemo(() => {
    const now = new Date();
    const sToday = startOfDay(now).getTime();
    const sWeek = daysAgo(6).getTime();
    const sMonth = daysAgo(29).getTime();

    let todayE = 0, weekE = 0, monthE = 0;
    let todayC = 0, weekC = 0, monthC = 0;
    let pending = 0, paid = 0;

    earnings.forEach((e) => {
      const t = new Date(e.created_at).getTime();
      const v = Number(e.total_earned) || 0;
      if (t >= sToday) { todayE += v; todayC++; }
      if (t >= sWeek) { weekE += v; weekC++; }
      if (t >= sMonth) { monthE += v; monthC++; }
      if (e.status === "pending") pending += v;
      else if (e.status === "paid") paid += v;
    });

    const ticket = monthC > 0 ? monthE / monthC : 0;
    return { todayE, weekE, monthE, todayC, weekC, monthC, ticket, pending, paid, total: pending + paid };
  }, [earnings]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-card border-b sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button asChild size="icon" variant="ghost"><Link to="/driver/dashboard"><ArrowLeft className="h-4 w-4" /></Link></Button>
            <div className="min-w-0">
              <h1 className="font-semibold truncate flex items-center gap-2"><Wallet className="h-4 w-4" /> Meus Ganhos</h1>
              <p className="text-xs text-muted-foreground truncate">{driverName}</p>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            <Button asChild size="sm" variant="ghost"><Link to="/driver">Pedidos</Link></Button>
            <Button asChild size="sm" variant="ghost"><Link to="/driver/dashboard">Dashboard</Link></Button>
            <Button asChild size="sm" variant="ghost"><Link to="/driver/performance">Performance</Link></Button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI icon={<DollarSign className="h-4 w-4" />} label="Ganhos Hoje" value={fmtBRL(stats.todayE)} sub={`${stats.todayC} entregas`} />
          <KPI icon={<DollarSign className="h-4 w-4" />} label="Ganhos 7 dias" value={fmtBRL(stats.weekE)} sub={`${stats.weekC} entregas`} />
          <KPI icon={<DollarSign className="h-4 w-4" />} label="Ganhos 30 dias" value={fmtBRL(stats.monthE)} sub={`${stats.monthC} entregas`} />
          <KPI icon={<TrendingUp className="h-4 w-4" />} label="Ticket Médio" value={fmtBRL(stats.ticket)} sub="últimos 30 dias" />
        </div>

        {/* Financial summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SummaryCard label="Total Pendente" value={fmtBRL(stats.pending)} tone="warn" />
          <SummaryCard label="Total Pago" value={fmtBRL(stats.paid)} tone="ok" />
          <SummaryCard label="Total Geral" value={fmtBRL(stats.total)} tone="default" />
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Filter className="h-4 w-4" /> Filtros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Tabs value={period} onValueChange={(v) => { setPeriod(v as Period); setPage(1); }}>
              <TabsList className="grid grid-cols-4 w-full md:w-auto">
                <TabsTrigger value="hoje">Hoje</TabsTrigger>
                <TabsTrigger value="7d">7 dias</TabsTrigger>
                <TabsTrigger value="30d">30 dias</TabsTrigger>
                <TabsTrigger value="custom">Personalizado</TabsTrigger>
              </TabsList>
            </Tabs>
            {period === "custom" && (
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">De</label>
                  <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Até</label>
                  <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4" /> Histórico de Ganhos
              <span className="ml-auto text-xs text-muted-foreground font-normal">{filtered.length} registros</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando…
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Nenhum ganho no período selecionado.
              </div>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="md:hidden divide-y">
                  {paginated.map((e) => {
                    const o = ordersById[e.order_id];
                    return (
                      <div key={e.id} className="p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(e.created_at)}</span>
                          <StatusBadge status={e.status} />
                        </div>
                        <div className="text-sm font-medium">{o?.customer_name || "Cliente"}</div>
                        <div className="text-xs text-muted-foreground">Pedido #{o?.short || String(e.order_id).slice(0,8)}</div>
                        <div className="flex items-center justify-between pt-1">
                          <div className="text-xs text-muted-foreground">
                            {fmtBRL(e.delivery_fee)} {e.bonus_amount > 0 && <>+ {fmtBRL(e.bonus_amount)}</>} {e.discount_amount > 0 && <>− {fmtBRL(e.discount_amount)}</>}
                          </div>
                          <div className="font-semibold">{fmtBRL(e.total_earned)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Entrega</TableHead>
                        <TableHead className="text-right">Bônus</TableHead>
                        <TableHead className="text-right">Desconto</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated.map((e) => {
                        const o = ordersById[e.order_id];
                        return (
                          <TableRow key={e.id}>
                            <TableCell className="text-xs">{fmtDate(e.created_at)}</TableCell>
                            <TableCell className="text-xs font-mono">#{o?.short || String(e.order_id).slice(0,8)}</TableCell>
                            <TableCell className="text-sm">{o?.customer_name || "—"}</TableCell>
                            <TableCell className="text-right text-sm">{fmtBRL(e.delivery_fee)}</TableCell>
                            <TableCell className="text-right text-sm">{fmtBRL(e.bonus_amount)}</TableCell>
                            <TableCell className="text-right text-sm">{fmtBRL(e.discount_amount)}</TableCell>
                            <TableCell className="text-right font-semibold">{fmtBRL(e.total_earned)}</TableCell>
                            <TableCell><StatusBadge status={e.status} /></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {/* Pagination */}
                <div className="flex items-center justify-between p-3 border-t">
                  <div className="text-xs text-muted-foreground">Página {page} de {totalPages}</div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
                    <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Próxima</Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function KPI({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</div>
        <div className="text-lg font-semibold mt-1">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" | "default" }) {
  const cls =
    tone === "ok" ? "border-emerald-500/30 bg-emerald-500/5" :
    tone === "warn" ? "border-amber-500/30 bg-amber-500/5" :
    "";
  return (
    <Card className={cls}>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: "pending" | "paid" }) {
  if (status === "paid") return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30" variant="outline">Pago</Badge>;
  return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30" variant="outline">Pendente</Badge>;
}