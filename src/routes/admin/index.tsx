import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Fragment, useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie
} from "recharts";
import {
  adminListAll, saveMenuItem, deleteMenuItem, toggleAvailable,
  saveCategory, deleteCategory, checkIsAdmin,
  listExtras,
  getProductAdicionais, replaceProductAdicionais,
  listAllAdicionais, getCategoryAdicionais, saveCategoryAdicionais,
  listAdicionaisByCategory, saveAdicional, deleteAdicional,
  getProductGrupos, saveProductGrupos,
  listStockItems, saveStockItem, deleteStockItem,
  listExpenses, saveExpense, deleteExpense,
  listLoyaltyPoints, listReviews, getAdminReports,
  listCustomers, saveCustomer, listHistoryOrders, getCustomerHistory,
  deleteCustomer,
} from "@/lib/admin.functions";
import {
  getRestaurantSettings,
  updateRestaurantSettings,
  listNeighborhoods,
  upsertNeighborhood,
  deleteNeighborhood,
} from "@/lib/settings.functions";
import { listOpeningHours, updateOpeningHours } from "@/lib/opening-hours.functions";
import { computeOpenStatus } from "@/lib/opening-hours-status";
const oxenteLogo = "https://shrydnbjxoblnglbexzd.supabase.co/storage/v1/object/public/product-images/branding/cissaburger-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Pencil, Trash2, Plus, LogOut, Upload, Settings2,
  LayoutDashboard, Package, FolderTree, ExternalLink, Flame,
  ShoppingBag, CreditCard, Banknote, Smartphone, Monitor, Settings, Bike, MapPin,
  Printer, FileText, History, TrendingUp, TrendingDown, PlusCircle, MinusCircle,
  Calculator, FileSpreadsheet, AlertCircle, CheckCircle2,
  Boxes, Star, Heart, BarChart3, Receipt, Wallet, Utensils, Users, ShoppingCart, UserPlus,
  Calendar, User, Globe, Search, Filter, ArrowLeft, ArrowRight, Info, Loader2, X, Check,
} from "lucide-react";

import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";

import { updateOrderStatus, createAdminOrder } from "@/lib/orders.functions";
import { 
  getCashStatus, openCash, closeCash, addCashMovement, 
  getCashHistory, getDailyPaidOrders, isRegisterExpired,
  forceCloseByManager 
} from "@/lib/cash.functions";
import { ComandasTab } from "@/components/admin/ComandasTab";
import { StockTab } from "@/components/admin/StockTab";

export const Route = createFileRoute("/admin/")({
  component: AdminPage,
});


// Solicita a senha do admin atual e a valida via Supabase antes de
// permitir uma ação destrutiva (exclusão).
async function confirmAdminPassword(): Promise<boolean> {
  const { data: u } = await supabase.auth.getUser();
  const email = u.user?.email;
  if (!email) {
    toast.error("Sessão inválida. Faça login novamente.");
    return false;
  }
  const pwd = window.prompt("Digite a senha do administrador para confirmar a exclusão:");
  if (!pwd) return false;
  const { error } = await supabase.auth.signInWithPassword({ email, password: pwd });
  if (error) {
    toast.error("Senha incorreta. Exclusão cancelada.");
    return false;
  }
  return true;
}

function AdminPage() {
  return <AdminDashboard />;
}

function AdminDashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: userRole } = useQuery({
    queryKey: ["admin", "role"],
    queryFn: () => checkIsAdmin(),
  });
  const [section, setSection] = useState<"overview" | "products" | "orders" | "finance" | "marketing" | "settings" | "customers" | "pos" | "stock">("overview");
  const [pendingEditId, setPendingEditId] = useState<string | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const printedOrders = useRef<Set<string>>(new Set());
  const [ordersView, setOrdersView] = useState<"today" | "all">("today");
  
  // History filters
  const [historySearch, setHistorySearch] = useState("");
  const [historyType, setHistoryType] = useState<"all" | "mesa" | "delivery" | "online">("all");
  const [historyTable, setHistoryTable] = useState("all");
  const [historyStartDate, setHistoryStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [historyEndDate, setHistoryEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 20;

  const { data: historyData, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["admin", "history", historyStartDate, historyEndDate, historySearch, historyType, historyTable, historyPage],
    queryFn: () => listHistoryOrders({
      startDate: historyStartDate,
      endDate: historyEndDate,
      search: historySearch,
      type: historyType,
      tableNumber: historyTable,
      page: historyPage,
      pageSize: HISTORY_PAGE_SIZE,
    }),
    enabled: section === "orders" && ordersView === "all",
  });


  const { data, isLoading, error: adminDataError } = useQuery({
    queryKey: ["admin", "all"],
    queryFn: () => adminListAll(),
  });

  // Realtime: refetch orders when any change occurs
  useEffect(() => {
    const channel = supabase
      .channel("orders-dashboard")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        // Play notification sound if possible
        try {
          const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
          audio.play().catch(() => {});
        } catch (e) {}
        if (!cashIsOpenRef.current) {
          setCashClosedAlert(true);
          try { toast.warning("Aviso: Novo pedido recebido, mas o caixa atual encontra-se fechado."); } catch {}
        }
        qc.invalidateQueries({ queryKey: ["admin", "all"] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["admin", "all"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  useEffect(() => {
    if (!selectedOrder?.id || !data?.orders) return;
    const freshOrder = data.orders.find((o: any) => o.id === selectedOrder.id);
    if (freshOrder && freshOrder.updated_at !== selectedOrder.updated_at) {
      setSelectedOrder(freshOrder);
    }
  }, [data?.orders, selectedOrder?.id, selectedOrder?.updated_at]);

  // Realtime: cash register changes (auto-close / manual close) invalidate
  // both query keys used across the admin so the lockout modal reacts instantly.
  useEffect(() => {
    const channel = supabase
      .channel("admin-cash-register")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cash_registers" },
        () => {
          qc.invalidateQueries({ queryKey: ["cash"] });
          qc.invalidateQueries({ queryKey: ["cash", "status"] });
          qc.invalidateQueries({ queryKey: ["cash", "history"] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  // Auto-print effect — só imprime após confirmação do pagamento (status 'preparing')
  useEffect(() => {
    if (data?.orders) {
      const paidPreparing = data.orders.filter((o: any) => o.status === 'preparing');
      paidPreparing.forEach((order: any) => {
        if (!printedOrders.current.has(order.id)) {
          console.log("Auto-printing paid order:", order.id);
          printedOrders.current.add(order.id);
          // Wait a bit for the component to render before printing
          setTimeout(() => {
            const printBtn = document.getElementById(`print-btn-${order.id}`);
            if (printBtn) printBtn.click();
          }, 1000);
        }
      });
    }
  }, [data?.orders]);


  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Limpa qualquer cache local sensível antes de sair da área administrativa.
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("sb-") || k.startsWith("supabase."))
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
    navigate({ to: "/admin/login" });
  };

  const { data: cashStatus } = useQuery({
    queryKey: ["cash"],
    queryFn: () => getCashStatus(),
    refetchInterval: 30000, // Check every 30s
  });

  // Restaurant settings — needed for `limite_virada_caixa` auto-close threshold.
  const { data: restaurantSettings } = useQuery({
    queryKey: ["restaurant-settings"],
    queryFn: () => getRestaurantSettings(),
  });

  const [showExpiredCashModal, setShowExpiredCashModal] = useState(false);
  const [cashClosedAlert, setCashClosedAlert] = useState(false);
  const cashIsOpen = cashStatus?.status === "open";
  const cashIsOpenRef = useRef(cashIsOpen);
  useEffect(() => { cashIsOpenRef.current = cashIsOpen; }, [cashIsOpen]);

  // Aviso crítico: dentro do horário de funcionamento mas com caixa fechado.
  const { data: openingHoursList } = useQuery({
    queryKey: ["opening-hours"],
    queryFn: () => listOpeningHours(),
    staleTime: 60_000,
  });
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const storeWithinHours = (() => {
    void nowTick;
    if (!openingHoursList || openingHoursList.length === 0) return false;
    if (restaurantSettings?.force_closed) return false;
    const now = new Date();
    const today = now.getDay();
    const todayHrs = openingHoursList.find((h) => h.day_of_week === today);
    if (!todayHrs || todayHrs.is_closed) return false;
    const toMin = (t: string | null | undefined) => {
      if (!t || typeof t !== "string") return null;
      const [h, m] = t.slice(0, 5).split(":").map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return null;
      return h * 60 + m;
    };
    const open = toMin(todayHrs.open_time);
    const close = toMin(todayHrs.close_time);
    if (open == null || close == null) return false;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    // Suporta horário que cruza meia-noite (ex.: 18:00 às 02:00)
    if (close <= open) return nowMin >= open || nowMin < close;
    return nowMin >= open && nowMin < close;
  })();
  const showCashClosedDuringHoursAlert = storeWithinHours && !cashIsOpen;

  useEffect(() => {
    const checkExpiration = () => {
      if (!cashStatus || cashStatus.status !== "open") {
        setShowExpiredCashModal(false);
        return;
      }
      const limite = restaurantSettings?.limite_virada_caixa || "05:00";
      const expired = isRegisterExpired(cashStatus, limite);
      setShowExpiredCashModal(expired);
    };

    checkExpiration();
    const id = setInterval(checkExpiration, 60_000);
    return () => clearInterval(id);
  }, [cashStatus, restaurantSettings?.limite_virada_caixa]);

  const updateStatusMut = useMutation({
    mutationFn: (v: { id: string; status: any }) => updateOrderStatus(v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "all"] });
      toast.success("Status atualizado");
    },
  });

  if (adminDataError) {
    return (
      <div className="p-6">
        <h1>Erro ao carregar o painel</h1>
        <pre>{String(adminDataError)}</pre>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#E7D3B1] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[#D4A15A]">
          <Flame className="w-5 h-5 animate-pulse" /> Carregando dados…
        </div>
      </div>
    );
  }

  const nav = [
    { id: "overview", label: "Dashboard", icon: BarChart3 },
    { id: "pos", label: "Comandas (Mesas)", icon: Utensils },
    { id: "orders", label: "Pedidos", icon: ShoppingBag },
    { id: "products", label: "Produtos e Itens", icon: Package },
    { id: "stock", label: "Controle de Estoque", icon: Boxes },
    { id: "customers", label: "Clientes", icon: Users },
    { id: "entregas", label: "Entregas", icon: Bike, href: "/admin/entregas" },
    { id: "finance", label: "Financeiro", icon: Wallet },
    { id: "marketing", label: "Fidelidade", icon: Heart },
    { id: "settings", label: "Configurações", icon: Settings },
  ] as const;



  const orders = (data as any).orders || [];
  const hasOrders = orders.length > 0;

  // Only count today's PAID orders for daily sales.
  // Pedidos com status 'pending' (aguardando pagamento) e 'cancelled' não entram nas estatísticas financeiras.
  const PAID_STATUSES = ["preparing", "delivered", "completed"];
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayOrders = orders.filter(
    (o: any) => new Date(o.created_at) >= startOfToday && PAID_STATUSES.includes(o.status)
  );

  const salesMesa = todayOrders
    .filter((o: any) => o.source === "mesa")
    .reduce((sum: number, o: any) => sum + Number(o.total_amount), 0);

  const salesOnline = todayOrders
    .filter((o: any) => o.source === "online")
    .reduce((sum: number, o: any) => sum + Number(o.total_amount), 0);

  const salesDelivery = todayOrders
    .filter((o: any) => o.source === "delivery")
    .reduce((sum: number, o: any) => sum + Number(o.total_amount), 0);

  const totalSales = salesMesa + salesOnline + salesDelivery;

  const ticketMedio = todayOrders.length
    ? (totalSales / todayOrders.length).toFixed(2)
    : "0.00";

  const paymentStats = {
    pix: todayOrders.filter((o: any) => o.payment_method === "pix").reduce((sum: number, o: any) => sum + Number(o.total_amount), 0),
    card: todayOrders.filter((o: any) => o.payment_method === "card").reduce((sum: number, o: any) => sum + Number(o.total_amount), 0),
    cash: todayOrders.filter((o: any) => o.payment_method === "cash").reduce((sum: number, o: any) => sum + Number(o.total_amount), 0),
  };

  const openEdit = (id: string) => {
    setPendingEditId(id);
    setSection("products");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#121212] to-[#1a0e08] text-[#E7D3B1] flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-[#3A2414]/60 bg-[#0d0907]/80 backdrop-blur sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-[#3A2414]/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF7A00] to-[#D97706] flex items-center justify-center">
            <Flame className="w-5 h-5 text-[#121212]" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#E7D3B1] leading-tight">CISSABURGER</p>
            <p className="text-[10px] uppercase tracking-widest text-[#D4A15A]">Admin</p>
          </div>
        </div>
        <p className="px-5 pt-5 pb-2 text-[10px] uppercase tracking-widest text-[#A3A3A3]">Gestão</p>
        <nav className="flex-1 px-3 space-y-1">
          {nav.map((n) => {
            const Icon = n.icon;
            if ("href" in n && n.href) {
              return (
                <Link
                  key={n.id}
                  to={n.href}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-[#E7D3B1]/80 hover:bg-[#1a1a1a] hover:text-[#E7D3B1] border border-transparent"
                >
                  <Icon className="w-4 h-4" />
                  {n.label}
                </Link>
              );
            }
            const active = section === (n.id as any);
            return (
              <button
                key={n.id}
                onClick={() => setSection(n.id as any)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-[#FF7A00]/15 text-[#FF7A00] border border-[#FF7A00]/30"
                    : "text-[#E7D3B1]/80 hover:bg-[#1a1a1a] hover:text-[#E7D3B1] border border-transparent"
                }`}
              >
                <Icon className="w-4 h-4" />
                {n.label}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-[#3A2414]/60 space-y-1">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#D4A15A] hover:bg-[#1a1a1a]"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Ver site
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#E7D3B1]/80 hover:bg-[#1a1a1a]"
          >
            <LogOut className="w-3.5 h-3.5" /> Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0">
        {/* Topbar (mobile) */}
        <header className="md:hidden border-b border-[#3A2414] px-5 py-4 flex items-center justify-between bg-[#0d0907]/80 backdrop-blur sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-[#FF7A00]" />
            <span className="font-bold text-[#D4A15A]">Admin CISSABURGER</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-[#E7D3B1]">
            <LogOut className="w-4 h-4" />
          </Button>
        </header>

        {/* Mobile nav pills */}
        <div className="md:hidden flex gap-2 px-5 py-3 overflow-x-auto scrollbar-hide border-b border-[#3A2414]/60">
          {nav.map((n) => {
            if ("href" in n && n.href) {
              return (
                <Link
                  key={n.id}
                  to={n.href}
                  className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#1a1a1a] text-[#E7D3B1]/80 border border-[#3A2414]"
                >
                  {n.label}
                </Link>
              );
            }
            const active = section === (n.id as any);
            return (
              <button
                key={n.id}
                onClick={() => setSection(n.id as any)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${
                  active ? "bg-[#FF7A00] text-[#121212]" : "bg-[#1a1a1a] text-[#E7D3B1]/80 border border-[#3A2414]"
                }`}
              >
                {n.label}
              </button>
            );
          })}
        </div>

        <main className="w-full max-w-6xl mx-auto px-4 py-6 md:p-8 overflow-x-hidden">
          {cashClosedAlert && !cashIsOpen && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-600/40 bg-amber-950/40 px-4 py-3 text-amber-200">
              <div className="flex-1 text-sm">
                <strong className="block font-bold">Aviso</strong>
                Novo pedido recebido, mas o caixa atual encontra-se fechado.
              </div>
              <button
                onClick={() => setCashClosedAlert(false)}
                className="text-xs font-bold px-3 py-1 rounded-full border border-amber-600/50 hover:bg-amber-900/40"
                aria-label="Fechar aviso"
              >
                Entendi
              </button>
            </div>
          )}
          {showExpiredCashModal && cashStatus && (
            <ExpiredCashBlockingModal 
              status={cashStatus} 
              restaurantSettings={restaurantSettings}
              userRole={userRole}
              onClose={() => setShowExpiredCashModal(false)} 
              qc={qc} 
            />
          )}

          {section === "overview" && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-[#E7D3B1]">Dashboard</h1>
                  <p className="text-sm text-[#A3A3A3]">Métricas essenciais do seu negócio</p>
                </div>
                <div className="flex items-center gap-2">
                   <Button variant="outline" size="sm" className="border-[#3A2414] text-[#E7D3B1]">
                     <History className="w-4 h-4 mr-2" /> Exportar Relatório
                   </Button>
                </div>
              </div>

              {showCashClosedDuringHoursAlert && (
                <div className="flex items-start gap-3 rounded-xl border-2 border-[#FF7A00] bg-[#121212] px-4 py-4 text-[#F5C97A] shadow-[0_0_24px_-6px_rgba(255,122,0,0.6)]">
                  <AlertCircle className="w-6 h-6 text-[#FF7A00] flex-shrink-0 mt-0.5" />
                  <div className="flex-1 text-sm">
                    <strong className="block font-bold text-[#FFD78A] mb-1 uppercase tracking-wide text-xs">
                      Atenção: Caixa fechado em horário de atendimento
                    </strong>
                    O estabelecimento está em horário de atendimento, mas o fluxo de caixa consta como FECHADO.
                    Abra o caixa para iniciar as movimentações financeiras do dia.
                  </div>
                  <Button
                    size="sm"
                    className="bg-[#FF7A00] hover:bg-[#ff8a1a] text-[#121212] font-bold"
                    onClick={() => setSection("finance")}
                  >
                    Abrir caixa
                  </Button>
                </div>
              )}

              {/* Financeiros Comparativos (Cards no Topo) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                  label="Faturamento do Dia" 
                  value={`R$ ${Number(data.stats?.revenue_today || 0).toFixed(2)}`} 
                  accent
                  comparison={(data.stats?.revenue_last_week_same_day !== undefined && data.stats?.revenue_last_week_same_day !== null) ? {
                    value: Number(data.stats.revenue_last_week_same_day) > 0 
                      ? (((Number(data.stats.revenue_today) || 0) - (Number(data.stats.revenue_last_week_same_day) || 0)) / (Number(data.stats.revenue_last_week_same_day) || 1) * 100).toFixed(0)
                      : "0",
                    label: "que na última terça-feira"
                  } : undefined}
                />
                <StatCard 
                  label="Faturamento Mensal" 
                  value={`R$ ${Number(data.stats?.revenue_month || 0).toFixed(2)}`}
                  subtitle="Meta: R$ 50.000,00"
                  progress={Math.min(((Number(data.stats?.revenue_month || 0)) / 50000) * 100, 100)}
                />
                <StatCard 
                  label="Ticket Médio" 
                  value={`R$ ${Number(data.stats?.ticket_medio || 0).toFixed(2)}`} 
                />
                <StatCard 
                  label="Tempo Médio de Preparo" 
                  value={`${Math.round(Number(data.stats?.avg_prep_time_mins || 0))} min`} 
                />
                <StatCard
                  label="Lucro Real (Mês)"
                  value={`R$ ${Number((data.stats as any)?.lucro_mes || 0).toFixed(2)}`}
                  subtitle={`Custo: R$ ${Number((data.stats as any)?.custo_mes || 0).toFixed(2)}`}
                />
              </div>

              {/* Inteligência de Vendas & Estoque (Gráficos) */}
              <div className="grid lg:grid-cols-2 gap-8">
                <Panel title="Desempenho Semanal" subtitle="Faturamento dos últimos 7 dias">
                  <div className="h-[250px] mt-4">
                    <RevenueChart data={(data.stats?.weekly_chart as any[]) || []} />
                  </div>
                </Panel>
                
                <Panel title="Produtos Mais Vendidos" subtitle="Top 5 itens nos últimos 30 dias">
                  <div className="mt-4 space-y-4">
                    {(data.stats?.top_products as any[])?.map((prod: any, idx: number) => (
                      <div key={prod.product_id} className="flex items-center gap-4">
                        <span className="text-[#A3A3A3] font-mono text-xs w-4">#{(idx + 1)}</span>
                        <div className="flex-1">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{prod.name}</span>
                            <span className="text-[#FF7A00] font-bold">{prod.total_qty} un</span>
                          </div>
                          <div className="w-full bg-[#1a1a1a] rounded-full h-1.5 overflow-hidden border border-[#3A2414]">
                            <div 
                              className="bg-[#FF7A00] h-full rounded-full" 
                              style={{ width: `${(prod.total_qty / (data.stats?.top_products as any[])[0].total_qty) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    {!(data.stats?.top_products as any[])?.length && (
                      <p className="text-center py-8 text-[#5a5a5a] text-sm">Aguardando mais vendas...</p>
                    )}
                  </div>
                </Panel>
              </div>

              {/* Monitoramento Operacional (Tempo Real) */}
              <div className="grid lg:grid-cols-2 gap-8">
                <Panel title="Pedidos por Canal" subtitle="Divisão de vendas por origem">
                  <div className="h-[250px] mt-4 flex items-center justify-center">
                    <SourceChart data={(data.stats?.orders_by_source as any[]) || []} />
                  </div>
                </Panel>
                
                <Panel title="Acesso Rápido a Pedidos Recentes" subtitle="Últimas 8 movimentações">
                  <OrdersTable orders={orders.slice(0, 8)} onSelect={setSelectedOrder} setPaymentOrder={setPaymentOrder} />
                </Panel>
              </div>
            </div>
          )}

          {section === "products" && (
            <ProductsSection
              items={data.items}
              categories={data.categories}
              qc={qc}
              pendingEditId={pendingEditId}
              clearPendingEdit={() => setPendingEditId(null)}
            />
          )}

          {section === "orders" && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-[#E7D3B1]">Gestão de Pedidos</h1>
                  <p className="text-sm text-[#A3A3A3]">Controle total das operações</p>
                </div>
                <div className="flex bg-[#1a1a1a] p-1 rounded-xl border border-[#3A2414]">
                  <button
                    onClick={() => setOrdersView("today")}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                      ordersView === "today" ? "bg-[#FF7A00] text-[#121212]" : "text-[#A3A3A3] hover:text-[#E7D3B1]"
                    }`}
                  >
                    Pedidos do Dia
                  </button>
                  <button
                    onClick={() => setOrdersView("all")}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                      ordersView === "all" ? "bg-[#FF7A00] text-[#121212]" : "text-[#A3A3A3] hover:text-[#E7D3B1]"
                    }`}
                  >
                    Histórico Completo
                  </button>
                </div>
              </div>

              {ordersView === "all" && (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-[#1a1a1a] border border-[#3A2414] flex flex-col justify-center">
                      <p className="text-[10px] uppercase tracking-widest text-[#A3A3A3] mb-1">Total Filtrado</p>
                      <p className="text-2xl font-black text-[#FF7A00]">
                        R$ {Number(historyData?.totalFilteredRevenue || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-[#1a1a1a] border border-[#3A2414] flex flex-col justify-center">
                      <p className="text-[10px] uppercase tracking-widest text-[#A3A3A3] mb-1">Qtd Pedidos</p>
                      <p className="text-2xl font-black text-[#E7D3B1]">
                        {historyData?.totalFilteredCount || 0}
                      </p>
                    </div>
                  </div>

                  {/* Filters Bar */}
                  <div className="bg-[#121212] border border-[#3A2414] rounded-xl p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-[#A3A3A3]">Busca</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A3A3A3]" />
                          <Input 
                            placeholder="Nome ou Código..." 
                            className="bg-[#1a1a1a] border-[#3A2414] pl-9"
                            value={historySearch}
                            onChange={(e) => {
                              setHistorySearch(e.target.value);
                              setHistoryPage(1);
                            }}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-[#A3A3A3]">Tipo de Pedido</Label>
                        <Select 
                          value={historyType} 
                          onValueChange={(v: any) => {
                            setHistoryType(v);
                            setHistoryPage(1);
                          }}
                        >
                          <SelectTrigger className="bg-[#1a1a1a] border-[#3A2414]">
                            <SelectValue placeholder="Tipo" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#121212] border-[#3A2414] text-[#E7D3B1]">
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="mesa">Mesa</SelectItem>
                            <SelectItem value="delivery">Delivery</SelectItem>
                            <SelectItem value="online">Retirada</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {historyType === "mesa" && (
                        <div className="space-y-1.5">
                          <Label className="text-xs text-[#A3A3A3]">Número da Mesa</Label>
                          <Select 
                            value={historyTable} 
                            onValueChange={(v) => {
                              setHistoryTable(v);
                              setHistoryPage(1);
                            }}
                          >
                            <SelectTrigger className="bg-[#1a1a1a] border-[#3A2414]">
                              <SelectValue placeholder="Mesa" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#121212] border-[#3A2414] text-[#E7D3B1]">
                              <SelectItem value="all">Todas as Mesas</SelectItem>
                              {Array.from({ length: (data as any).settings?.total_tables || 20 }).map((_, i) => {
                                const n = String(i + 1).padStart(2, "0");
                                return <SelectItem key={n} value={n}>Mesa {n}</SelectItem>;
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 md:col-span-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-[#A3A3A3]">De:</Label>
                          <Input 
                            type="date" 
                            className="bg-[#1a1a1a] border-[#3A2414]"
                            value={historyStartDate}
                            onChange={(e) => {
                              setHistoryStartDate(e.target.value);
                              setHistoryPage(1);
                            }}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-[#A3A3A3]">Até:</Label>
                          <Input 
                            type="date" 
                            className="bg-[#1a1a1a] border-[#3A2414]"
                            value={historyEndDate}
                            onChange={(e) => {
                              setHistoryEndDate(e.target.value);
                              setHistoryPage(1);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isLoadingHistory && ordersView === "all" ? (
                <div className="flex items-center justify-center py-20">
                  <Flame className="w-8 h-8 text-[#FF7A00] animate-pulse" />
                </div>
              ) : (
                <div className="space-y-4">
                  <OrdersList
                    orders={ordersView === "today" ? orders : (historyData?.orders || [])}
                    view={ordersView}
                    historyPage={historyPage}
                    pageSize={HISTORY_PAGE_SIZE}
                    setHistoryPage={setHistoryPage}
                    onSelectOrder={setSelectedOrder}
                    menuItems={data.items}
                    cashRegister={(data as any).cashRegister}
                  />

                  {ordersView === "all" && historyData && historyData.count > HISTORY_PAGE_SIZE && (
                    <div className="flex items-center justify-center gap-4 pt-6">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-[#3A2414] text-[#E7D3B1]"
                        disabled={historyPage === 1}
                        onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" /> Anterior
                      </Button>
                      <span className="text-sm font-bold text-[#D4A15A]">
                        Página {historyPage} de {Math.ceil(historyData.count / HISTORY_PAGE_SIZE)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-[#3A2414] text-[#E7D3B1]"
                        disabled={historyPage >= Math.ceil(historyData.count / HISTORY_PAGE_SIZE)}
                        onClick={() => setHistoryPage(p => p + 1)}
                      >
                        Próxima <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}


          {section === "finance" && <FinanceTab qc={qc} />}
          {section === "marketing" && <MarketingTab qc={qc} />}
          {section === "settings" && <SettingsTab qc={qc} />}
          {section === "customers" && <CustomersTab qc={qc} />}
          {section === "pos" && <ComandasTab />}
          {section === "stock" && <StockTab />}

          {selectedOrder && (
            <OrderDetailsDialog 
              order={selectedOrder} 
              onClose={() => setSelectedOrder(null)} 
              menuItems={data.items}
              qc={qc}
              onStatusChange={(newStatus: string) =>
                setSelectedOrder((prev: any) =>
                  prev ? { ...prev, status: newStatus, updated_at: new Date().toISOString() } : prev
                )
              }
            />
          )}
        </main>

      </div>
    </div>
  );
}

function PaymentDialog({ order, onClose, qc }: any) {
  const [method, setMethod] = useState<"pix" | "card" | "cash">("pix");
  const updateMut = useMutation({
    mutationFn: (v: { id: string; status: any; payment_method: any }) => updateOrderStatus(v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "all"] });
      qc.invalidateQueries({ queryKey: ["cash"] });
      toast.success("Pagamento confirmado!");
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#121212] border-[#3A2414] text-[#E7D3B1] max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Finalizar Pagamento {order.table_number ? `— Mesa ${order.table_number}` : `— ${order.customer_name || "Cliente"}`}
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="flex justify-between items-center bg-[#1a1a1a] p-3 rounded-xl border border-[#3A2414]">
            <span className="text-sm text-[#A3A3A3]">Total a pagar</span>
            <span className="text-xl font-bold text-[#FF7A00]">R$ {Number(order.total_amount).toFixed(2)}</span>
          </div>

          <div className="space-y-2">
            <Label>Forma de Pagamento</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setMethod("pix")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                  method === "pix" 
                    ? "bg-[#FF7A00]/15 border-[#FF7A00] text-[#FF7A00]" 
                    : "bg-[#1a1a1a] border-[#3A2414] text-[#A3A3A3] hover:border-[#555]"
                }`}
              >
                <Smartphone className="w-6 h-6 mb-1" />
                <span className="text-[10px] font-bold">PIX</span>
              </button>
              <button
                onClick={() => setMethod("card")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                  method === "card" 
                    ? "bg-[#D4A15A]/15 border-[#D4A15A] text-[#D4A15A]" 
                    : "bg-[#1a1a1a] border-[#3A2414] text-[#A3A3A3] hover:border-[#555]"
                }`}
              >
                <CreditCard className="w-6 h-6 mb-1" />
                <span className="text-[10px] font-bold">CARTÃO</span>
              </button>
              <button
                onClick={() => setMethod("cash")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                  method === "cash" 
                    ? "bg-green-500/15 border-green-500 text-green-500" 
                    : "bg-[#1a1a1a] border-[#3A2414] text-[#A3A3A3] hover:border-[#555]"
                }`}
              >
                <Banknote className="w-6 h-6 mb-1" />
                <span className="text-[10px] font-bold">DINHEIRO</span>
              </button>
            </div>
          </div>
        </div>
        <DialogFooter className="sm:justify-start">
          <Button 
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-6 rounded-xl text-lg"
            onClick={() => updateMut.mutate({ id: order.id, status: 'preparing', payment_method: method })}
            disabled={updateMut.isPending}
          >
            {updateMut.isPending ? "Processando..." : "Confirmar Pagamento e Enviar p/ Cozinha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ 
  label, value, accent, comparison, progress, subtitle 
}: { 
  label: string; 
  value: string; 
  accent?: boolean;
  comparison?: { value: string; label: string };
  progress?: number;
  subtitle?: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-[#FF7A00]/40 bg-gradient-to-br from-[#FF7A00]/10 to-transparent" : "border-[#3A2414] bg-[#121212]/70"}`}>
      <p className="text-[10px] uppercase tracking-widest text-[#A3A3A3]">{label}</p>
      <div className="flex items-baseline justify-between mt-1">
        <p className={`text-2xl font-bold ${accent ? "text-[#FF7A00]" : "text-[#E7D3B1]"}`}>{value}</p>
        {comparison && (
          <span className={`text-[10px] font-bold ${Number(comparison.value) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
            {Number(comparison.value) >= 0 ? "+" : ""}{comparison.value}%
          </span>
        )}
      </div>
      {comparison && (
        <p className="text-[10px] text-[#A3A3A3] mt-1">{comparison.label}</p>
      )}
      {subtitle && (
        <p className="text-[10px] text-[#A3A3A3] mt-1">{subtitle}</p>
      )}
      {progress !== undefined && (
        <div className="w-full bg-[#1a1a1a] rounded-full h-1 mt-2 overflow-hidden border border-[#3A2414]">
          <div className="bg-[#FF7A00] h-full rounded-full" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

function RevenueChart({ data }: { data: any[] }) {
  const chartData = data?.map(d => ({
    name: new Date(d.day + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }),
    valor: Number(d.revenue)
  })) || [];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#3A2414" vertical={false} />
        <XAxis 
          dataKey="name" 
          stroke="#A3A3A3" 
          fontSize={10} 
          tickLine={false} 
          axisLine={false} 
        />
        <YAxis 
          stroke="#A3A3A3" 
          fontSize={10} 
          tickLine={false} 
          axisLine={false}
          tickFormatter={(v) => `R$${v}`}
        />
        <RechartsTooltip 
          contentStyle={{ backgroundColor: "#121212", border: "1px solid #3A2414", borderRadius: "8px", fontSize: "12px" }}
          itemStyle={{ color: "#FF7A00" }}
          labelStyle={{ color: "#E7D3B1" }}
          formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Faturamento"]}
        />
        <Line 
          type="monotone" 
          dataKey="valor" 
          stroke="#FF7A00" 
          strokeWidth={3} 
          dot={{ fill: "#FF7A00", strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function SourceChart({ data }: { data: any[] }) {
  const COLORS = ["#FF7A00", "#D4A15A", "#8B4513"];
  // Normaliza canais (case-insensitive) e agrupa por categoria
  const grouped = (data || []).reduce<Record<string, number>>((acc, d: any) => {
    const raw = String(d?.source ?? "").trim().toLowerCase();
    const label =
      raw === "mesa" ? "Comandas" :
      raw === "pos" || raw === "balcao" || raw === "balcão" ? "Balcão" :
      raw === "delivery" ? "Delivery" :
      raw === "online" ? "Online" :
      (raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "Outros");
    const n = Number(d?.count) || 0;
    acc[label] = (acc[label] || 0) + n;
    return acc;
  }, {});
  const chartData = Object.entries(grouped)
    .map(([name, value]) => ({ name, value }))
    .filter(d => d.value > 0);

  if (chartData.length === 0) {
    return (
      <div className="text-center text-[#5a5a5a] text-sm">Sem dados de pedidos ainda.</div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          innerRadius={60}
          outerRadius={80}
          paddingAngle={chartData.length > 1 ? 5 : 0}
          dataKey="value"
          nameKey="name"
          isAnimationActive={false}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <RechartsTooltip 
          contentStyle={{ backgroundColor: "#121212", border: "1px solid #3A2414", borderRadius: "8px", fontSize: "12px" }}
          itemStyle={{ color: "#E7D3B1" }}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="#E7D3B1" fontSize="12" fontWeight="bold">
          Canais
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#3A2414] bg-[#121212]/70 p-5">
      <div className="mb-3">
        <h3 className="font-semibold text-[#E7D3B1]">{title}</h3>
        {subtitle && <p className="text-xs text-[#A3A3A3]">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function ProductsTab({ items, categories, qc, pendingEditId, clearPendingEdit }: any) {
  const [editing, setEditing] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  useEffect(() => {
    if (pendingEditId) {
      const target = items.find((i: any) => i.id === pendingEditId);
      if (target) {
        setEditing(target);
        clearPendingEdit?.();
      }
    }
  }, [pendingEditId, items, clearPendingEdit]);

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; is_available: boolean }) => toggleAvailable(v.id, v.is_available),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "all"] }),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => deleteMenuItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "all"] });
      toast.success("Produto removido");
    },
  });

  const filteredCategories = categories.filter((c: any) => (c.tipo ?? "produto") === "produto");
  const filteredItems = activeCategory === "all" 
    ? items 
    : items.filter((it: any) => it.category_id === activeCategory);

  return (
    <div className="w-full max-w-full overflow-x-hidden box-border">
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold">Produtos ({filteredItems.length})</h2>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setEditing({})}
            className="bg-[#FF7A00] hover:bg-[#D97706] text-black">
            <Plus className="w-4 h-4 mr-1" /> Novo produto
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => setActiveCategory("all")}
          className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${
            activeCategory === "all"
              ? "bg-[#FF7A00] text-[#121212] border-[#FF7A00]"
              : "bg-[#1a1a1a] text-[#E7D3B1]/80 border-[#3A2414] hover:border-[#D4A15A]/40"
          }`}
        >
          Todos
        </button>
        {filteredCategories.map((cat: any) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              activeCategory === cat.id
                ? "bg-[#FF7A00] text-[#121212] border-[#FF7A00]"
                : "bg-[#1a1a1a] text-[#E7D3B1]/80 border-[#3A2414] hover:border-[#D4A15A]/40"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="grid gap-3 w-full px-0 sm:px-0">
        {filteredItems.map((it: any) => (
          <div key={it.id} className="bg-[#121212] border border-[#3A2414] rounded-xl p-3 sm:p-4 flex items-start gap-3 w-full max-w-full box-border overflow-hidden">

            <img src={it.image_url || ""} alt={it.name}
              className="w-16 h-16 sm:w-18 sm:h-18 rounded-lg object-cover bg-[#1a1a1a] shrink-0 aspect-square" />
            <div className="flex-1 min-w-0 self-stretch flex flex-col justify-between gap-2 overflow-hidden">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-sm leading-tight break-words overflow-wrap-anywhere">{it.name}</h3>
                  <p className="text-xs text-[#A3A3A3] line-clamp-2 break-words overflow-wrap-anywhere">{it.description}</p>
                  <p className="text-[10px] text-[#666] mt-1 truncate">
                    {categories.find((c: any) => c.id === it.category_id)?.name || "Sem categoria"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-xs text-[#D4A15A] whitespace-nowrap">R$ {it.price}</span>
                  {it.controlar_estoque && (() => {
                    const q = Number(it.quantidade_estoque ?? 0);
                    const min = Number(it.estoque_minimo ?? 0);
                    if (q <= 0) {
                      return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 whitespace-nowrap">Esgotado</span>;
                    }
                    if (q <= min) {
                      return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 whitespace-nowrap">Estoque Baixo · {q} un</span>;
                    }
                    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 whitespace-nowrap">Estoque: {q} un</span>;
                  })()}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <Switch checked={it.is_available !== false}
                    onCheckedChange={(v) => toggleMut.mutate({ id: it.id, is_available: v })} />
                  <span className="text-[11px] text-[#A3A3A3]">{it.is_available !== false ? "Ativo" : "Off"}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(it)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8"
                    onClick={async () => {
                      if (!confirm("Excluir produto?")) return;
                      if (!(await confirmAdminPassword())) return;
                      delMut.mutate(it.id);
                    }}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <ProductDialog product={editing} categories={categories}
          onClose={() => setEditing(null)} qc={qc} />
      )}
    </div>
  );
}

function ProductDialog({ product, categories, onClose, qc }: any) {
  const [name, setName] = useState(product.name || "");
  const [description, setDescription] = useState(product.description || "");
  const [price, setPrice] = useState<string>(product.price?.toString() || "");
  const [costPrice, setCostPrice] = useState<string>(
    product.cost_price != null ? String(product.cost_price) : "0",
  );
  const [imageUrl, setImageUrl] = useState(product.image_url || "");
  const [categoryId, setCategoryId] = useState(product.category_id || categories[0]?.id || "");
  const [uploading, setUploading] = useState(false);
  const [controlarEstoque, setControlarEstoque] = useState<boolean>(!!product.controlar_estoque);
  const [quantidadeEstoque, setQuantidadeEstoque] = useState<string>(
    product.quantidade_estoque != null ? String(product.quantidade_estoque) : "0"
  );
  const [estoqueMinimo, setEstoqueMinimo] = useState<string>(
    product.estoque_minimo != null ? String(product.estoque_minimo) : "0"
  );
  const [permitirObservacao, setPermitirObservacao] = useState<boolean>(
    product.permitir_observacao !== undefined ? !!product.permitir_observacao : true
  );
  const [placeholderObservacao, setPlaceholderObservacao] = useState<string>(
    product.placeholder_observacao ?? 'Alguma observação? (ex: tirar cebola, ponto da carne, etc.)'
  );

  // Linked "Grupos de Adicionais" (categories of type "adicional")
  const grupoCategories = (categories ?? []).filter(
    (c: any) => (c.tipo ?? "produto") === "adicional",
  );
  const [selectedGrupos, setSelectedGrupos] = useState<Set<string>>(new Set());

  const { data: currentGrupos } = useQuery({
    queryKey: ["admin", "product-grupos", product.id],
    queryFn: () => getProductGrupos(product.id),
    enabled: !!product.id,
  });
  useEffect(() => {
    if (currentGrupos) setSelectedGrupos(new Set(currentGrupos as string[]));
  }, [currentGrupos]);

  const toggleGrupo = (id: string) => {
    setSelectedGrupos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const res = await saveMenuItem({
        id: product.id,
        name, description: description || null,
        price: parseFloat(price),
        cost_price: Math.max(0, parseFloat(costPrice || "0") || 0),
        image_url: imageUrl || null,
        category_id: categoryId || null,
        controlar_estoque: controlarEstoque,
        quantidade_estoque: controlarEstoque ? Math.max(0, parseInt(quantidadeEstoque || "0", 10) || 0) : 0,
        estoque_minimo: controlarEstoque ? Math.max(0, parseInt(estoqueMinimo || "0", 10) || 0) : 0,
        permitir_observacao: permitirObservacao,
        placeholder_observacao: permitirObservacao
          ? (placeholderObservacao || 'Alguma observação? (ex: tirar cebola, ponto da carne, etc.)')
          : 'Alguma observação? (ex: tirar cebola, ponto da carne, etc.)',
      });

      await saveProductGrupos(res.id, Array.from(selectedGrupos));
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "all"] });
      qc.invalidateQueries({ queryKey: ["menuData"] });
      qc.invalidateQueries({ queryKey: ["featuredItems"] });
      qc.invalidateQueries({ queryKey: ["admin", "product-grupos"] });
      qc.invalidateQueries({ queryKey: ["menu-extras"] });
      toast.success("Salvo!");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false
      });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
      setImageUrl(urlData.publicUrl);
      toast.success("Imagem enviada");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#121212] border-[#3A2414] text-[#E7D3B1] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product.id ? "Editar produto" : "Novo produto"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120}
              className="bg-[#1a1a1a] border-[#3A2414]" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500}
              className="bg-[#1a1a1a] border-[#3A2414]" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Preço (R$)</Label>
              <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)}
                className="bg-[#1a1a1a] border-[#3A2414]" />
            </div>
            <div>
              <Label>Custo Padrão (R$)</Label>
              <Input type="number" step="0.01" min="0" value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="bg-[#1a1a1a] border-[#3A2414]" />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="bg-[#1a1a1a] border-[#3A2414]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 p-3 border border-[#3A2414] rounded-lg bg-[#1a1a1a]">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Label className="text-sm">Controlar estoque deste produto?</Label>
                <p className="text-[10px] text-[#A3A3A3] mt-0.5">
                  Quando ligado, o produto aparecerá na aba "Controle de Estoque" para gerenciar quantidades.
                </p>
              </div>
              <Switch checked={controlarEstoque} onCheckedChange={setControlarEstoque} />
            </div>
          </div>

          <div className="space-y-3 p-3 border border-[#3A2414] rounded-lg bg-[#1a1a1a]">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Label className="text-sm">Permitir observações neste produto?</Label>
                <p className="text-[10px] text-[#A3A3A3] mt-0.5">
                  Quando desligado, o campo de observação fica oculto no cardápio digital (ex: bebidas).
                </p>
              </div>
              <Switch checked={permitirObservacao} onCheckedChange={setPermitirObservacao} />
            </div>
            {permitirObservacao && (
              <div>
                <Label className="text-xs">Texto de exemplo (placeholder)</Label>
                <Input
                  value={placeholderObservacao}
                  onChange={(e) => setPlaceholderObservacao(e.target.value)}
                  maxLength={200}
                  placeholder="Alguma observação? (ex: tirar cebola, ponto da carne, etc.)"
                  className="bg-[#121212] border-[#3A2414] mt-1"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-[#FF7A00]" /> Vincular Grupos de Adicionais
            </Label>
            <div className="space-y-2 p-3 border border-[#3A2414] rounded-lg bg-[#1a1a1a]">
              {grupoCategories.length === 0 ? (
                <p className="text-xs text-[#A3A3A3]">
                  Nenhum Grupo de Adicionais cadastrado. Crie uma categoria do tipo "Grupo de Adicionais" na aba Categorias.
                </p>
              ) : (
                grupoCategories.map((g: any) => {
                  const checked = selectedGrupos.has(g.id);
                  return (
                    <label
                      key={g.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[#3A2414]/30"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleGrupo(g.id)}
                        className="accent-[#FF7A00] w-4 h-4"
                      />
                      <span className="text-sm">{g.name}</span>
                    </label>
                  );
                })
              )}
            </div>
            <p className="text-[10px] text-[#666]">
              Marque os grupos cujos itens ficarão disponíveis como opcionais para este produto.
            </p>
          </div>

          <div>
            <Label>Imagem</Label>
            <div className="flex gap-2 mt-1">
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
                placeholder="URL ou faça upload" className="bg-[#1a1a1a] border-[#3A2414]" />
              <label className="cursor-pointer inline-flex items-center gap-1 px-3 py-2 bg-[#1a1a1a] border border-[#3A2414] rounded-md text-xs hover:bg-[#222]">
                <Upload className="w-4 h-4" />
                {uploading ? "..." : "Upload"}
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
              </label>
            </div>
            {imageUrl && (
              <img src={imageUrl} alt="" className="mt-2 w-24 h-24 rounded-lg object-cover" />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-[#3A2414] bg-transparent">Cancelar</Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !name || !price}
            className="bg-[#FF7A00] hover:bg-[#D97706] text-black">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function ProductsSection(props: any) {
  const [tab, setTab] = useState<"products" | "categories">("products");
  return (
    <div className="w-full">
      <div className="flex bg-[#1a1a1a] p-1 rounded-xl border border-[#3A2414] w-fit mb-5">
        <button
          onClick={() => setTab("products")}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
            tab === "products" ? "bg-[#FF7A00] text-black" : "text-[#A3A3A3]"
          }`}
        >Produtos</button>
        <button
          onClick={() => setTab("categories")}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
            tab === "categories" ? "bg-[#FF7A00] text-black" : "text-[#A3A3A3]"
          }`}
        >Categorias</button>
      </div>
      {tab === "products" ? <ProductsTab {...props} /> : <CategoriesTab categories={props.categories} qc={props.qc} />}
    </div>
  );
}

function CategoriesTab({ categories, qc }: any) {
  const list: any[] = Array.isArray(categories) ? categories : [];
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [managingGrupo, setManagingGrupo] = useState<any>(null);

  const openNew = () => {
    setEditing(null);
    setIsOpen(true);
  };
  const openEdit = (c: any) => {
    setEditing(c);
    setIsOpen(true);
  };
  const closeDialog = () => {
    setIsOpen(false);
    setEditing(null);
  };

  const delMut = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "all"] });
      qc.invalidateQueries({ queryKey: ["menuData"] });
      toast.success("Categoria removida");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold">Categorias ({list.length})</h2>
        <Button
          type="button"
          onClick={() => openNew()}
          className="bg-[#FF7A00] hover:bg-[#D97706] text-black"
        >
          <Plus className="w-4 h-4 mr-1" /> Nova Categoria
        </Button>
      </div>

      <div className="grid gap-2">
        {list.map((c: any) => {
          const isProduto = (c.tipo ?? "produto") === "produto";
          return (
            <div key={c.id} className="bg-[#121212] border border-[#3A2414] rounded-lg p-3 flex justify-between items-center gap-3">
              <div className="min-w-0">
                <div className="font-medium text-sm">{c.name}</div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  isProduto
                    ? "bg-[#FF7A00]/15 text-[#FF7A00]"
                    : "bg-[#D4A15A]/15 text-[#D4A15A]"
                }`}>
                  {isProduto ? "Produto Principal" : "Adicionais"}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(c)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                {(c.tipo ?? "produto") === "adicional" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs gap-1 text-[#FF7A00] hover:bg-[#FF7A00]/10"
                    onClick={() => setManagingGrupo(c)}
                  >
                    <Settings2 className="w-4 h-4" /> Gerenciar Itens
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={async () => {
                  if (!confirm("Excluir categoria?")) return;
                  if (!(await confirmAdminPassword())) return;
                  delMut.mutate(c.id);
                }}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <CategoryDialog
        open={isOpen}
        category={editing}
        onClose={closeDialog}
        qc={qc}
        categories={list}
      />

      {managingGrupo && (
        <ManageGrupoItemsDialog
          category={managingGrupo}
          onClose={() => setManagingGrupo(null)}
          qc={qc}
        />
      )}
    </div>
  );
}

function CategoryDialog({ open, category, onClose, qc, categories }: { open: boolean; category: any; onClose: () => void; qc: any; categories: any[] }) {
  const EMPTY_ADICIONAIS: any[] = [];
  const EMPTY_LINKED_IDS: string[] = [];
  const isNew = !category?.id;
  const [name, setName] = useState<string>(category?.name ?? "");
  const [tipo, setTipo] = useState<"produto" | "adicional">(
    (category?.tipo as "produto" | "adicional") ?? "produto",
  );

  // Reset form whenever the dialog opens with a different (or new) category
  useEffect(() => {
    if (open) {
      setName(category?.name ?? "");
      setTipo((category?.tipo as "produto" | "adicional") ?? "produto");
    }
  }, [open, category?.id]);

  const { data: allAdicionaisData } = useQuery({
    queryKey: ["admin", "all-adicionais"],
    queryFn: () => listAllAdicionais(),
    enabled: open,
  });
  const allAdicionais = allAdicionaisData ?? EMPTY_ADICIONAIS;

  const { data: linkedIdsData } = useQuery({
    queryKey: ["admin", "category-adicionais", category?.id ?? "new"],
    queryFn: () => getCategoryAdicionais(category!.id),
    enabled: open && !!category?.id && tipo === "produto",
  });
  const linkedIds = linkedIdsData ?? EMPTY_LINKED_IDS;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!open) return;

    if (!category?.id || tipo !== "produto") {
      setSelected((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }

    setSelected(new Set(linkedIds));
  }, [category?.id, linkedIds, open, tipo]);

  const toggleId = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const res = await saveCategory({ id: category?.id, name, tipo });
      const catId = (res as any).id as string;
      if (tipo === "produto") {
        await saveCategoryAdicionais(catId, Array.from(selected));
      }
      return catId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "all"] });
      qc.invalidateQueries({ queryKey: ["menuData"] });
      qc.invalidateQueries({ queryKey: ["menu-extras"] });
      toast.success(isNew ? "Categoria criada" : "Categoria atualizada");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "Nova Categoria" : "Editar Categoria"}
        className="w-full max-w-lg rounded-xl border border-[#3A2414] bg-[#1a1a1a] text-[#E7D3B1] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[#3A2414] px-5 py-4">
          <h3 className="text-lg font-semibold">{isNew ? "Nova Categoria" : "Editar Categoria"}</h3>
          <p className="mt-1 text-xs text-[#A3A3A3]">
            Defina o nome, o tipo da categoria e quais adicionais estarão disponíveis.
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <Label>Nome da Categoria</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Hambúrgueres"
              maxLength={60}
              className="bg-[#121212] border-[#3A2414] mt-1"
            />
          </div>

          <div>
            <Label>Tipo da Categoria</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                onClick={() => setTipo("produto")}
                className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition border ${
                  tipo === "produto"
                    ? "bg-[#FF7A00] text-black border-[#FF7A00]"
                    : "bg-[#121212] text-[#A3A3A3] border-[#3A2414]"
                }`}
              >Produto Principal</button>
              <button
                type="button"
                onClick={() => setTipo("adicional")}
                className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition border ${
                  tipo === "adicional"
                    ? "bg-emerald-500 text-black border-emerald-500"
                    : "bg-[#121212] text-[#A3A3A3] border-[#3A2414]"
                }`}
              >Grupo de Adicionais</button>
            </div>
          </div>

          {tipo === "produto" && (
            <div>
              <Label>Adicionais Permitidos para esta Categoria</Label>
              <p className="text-[11px] text-[#A3A3A3] mb-2">
                Marque os insumos que poderão ser escolhidos pelo cliente nesta categoria.
              </p>
              <div className="max-h-64 overflow-y-auto bg-[#121212] border border-[#3A2414] rounded-lg p-2 space-y-1">
                {(allAdicionais as any[]).length === 0 && (
                  <p className="text-xs text-[#666] p-2">Nenhum adicional cadastrado ainda.</p>
                )}
                {(allAdicionais as any[])
                  .filter((a) => {
                    const cat = categories.find((c: any) => c.id === a.category_id);
                    return cat?.tipo === "adicional";
                  })
                  .map((a) => {
                    const checked = selected.has(a.id);
                    return (
                      <label
                        key={a.id}
                        className="flex items-center justify-between gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[#3A2414]/30"
                      >
                        <span className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleId(a.id)}
                            className="accent-[#FF7A00] w-4 h-4"
                          />
                          {a.nome}
                        </span>
                        <span className="text-[11px] text-[#D4A15A]">
                          R$ {Number(a.preco ?? 0).toFixed(2)}
                        </span>
                      </label>
                    );
                  })}
                {(allAdicionais as any[]).filter((a: any) => {
                  const cat = categories.find((c: any) => c.id === a.category_id);
                  return cat?.tipo === "adicional";
                }).length === 0 && (
                  <p className="text-xs text-[#666] p-2">Nenhum item do tipo Adicional encontrado.</p>
                )}
              </div>
              <p className="text-[11px] text-[#A3A3A3] mt-1">
                {selected.size} marcado(s)
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#3A2414] px-5 py-4">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => saveMut.mutate()}
            disabled={!name.trim() || saveMut.isPending}
            className="bg-[#FF7A00] hover:bg-[#D97706] text-black"
          >
            {saveMut.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ManageGrupoItemsDialog({ category, onClose, qc }: { category: any; onClose: () => void; qc: any }) {
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [custo, setCusto] = useState("");

  const { data: items, refetch } = useQuery({
    queryKey: ["admin", "grupo-items", category.id],
    queryFn: () => listAdicionaisByCategory(category.id),
  });

  const invalidateMenu = () => {
    qc.invalidateQueries({ queryKey: ["admin", "all-adicionais"] });
    qc.invalidateQueries({ queryKey: ["menu-extras"] });
    qc.invalidateQueries({ queryKey: ["menuData"] });
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const n = nome.trim();
      const p = parseFloat(preco);
      const c = parseFloat(custo || "0");
      if (!n) throw new Error("Informe o nome");
      if (!Number.isFinite(p) || p < 0) throw new Error("Preço inválido");
      return saveAdicional({
        nome: n,
        preco: p,
        cost_price: Number.isFinite(c) && c >= 0 ? c : 0,
        category_id: category.id,
        controlar_estoque: true,
        quantidade_estoque: 20,
        estoque_minimo: 5,
      });
    },
    onSuccess: () => {
      setNome(""); setPreco(""); setCusto("");
      refetch();
      invalidateMenu();
      toast.success("Adicional criado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteAdicional(id),
    onSuccess: () => {
      refetch();
      invalidateMenu();
      toast.success("Removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded-xl border border-[#3A2414] bg-[#1a1a1a] text-[#E7D3B1] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[#3A2414] px-5 py-4">
          <h3 className="text-lg font-semibold">Gerenciar Itens — {category.name}</h3>
          <p className="mt-1 text-xs text-[#A3A3A3]">
            Cadastre os adicionais deste grupo (Ex: Ovo, Bacon, Blend 180g).
          </p>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-[1fr_100px_100px_auto] gap-2 items-end">
            <div>
              <Label className="text-xs">Nome do Adicional</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Bacon"
                maxLength={120}
                className="bg-[#121212] border-[#3A2414] mt-1 h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Preço (R$)</Label>
              <Input
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                type="number" step="0.01" min="0"
                placeholder="0,00"
                className="bg-[#121212] border-[#3A2414] mt-1 h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Custo (R$)</Label>
              <Input
                value={custo}
                onChange={(e) => setCusto(e.target.value)}
                type="number" step="0.01" min="0"
                placeholder="0,00"
                className="bg-[#121212] border-[#3A2414] mt-1 h-9 text-sm"
              />
            </div>
            <Button
              type="button"
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              className="bg-[#FF7A00] hover:bg-[#D97706] text-black h-9"
            >
              <Plus className="w-4 h-4 mr-1" /> Adicionar
            </Button>
          </div>

          <div className="border border-[#3A2414] rounded-lg divide-y divide-[#3A2414] max-h-72 overflow-y-auto">
            {(items ?? []).length === 0 && (
              <p className="text-xs text-[#A3A3A3] p-3">Nenhum item neste grupo ainda.</p>
            )}
            {(items ?? []).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-sm">{a.nome}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#D4A15A]">R$ {Number(a.preco).toFixed(2)}</span>
                  <span className="text-[10px] text-[#A3A3A3]">Custo: R$ {Number((a as any).cost_price ?? 0).toFixed(2)}</span>
                  <Button
                    size="icon" variant="ghost" className="h-7 w-7"
                    onClick={() => {
                      if (!confirm(`Remover "${a.nome}"?`)) return;
                      delMut.mutate(a.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#3A2414] px-5 py-4">
          <Button onClick={onClose} className="bg-[#FF7A00] hover:bg-[#D97706] text-black">Fechar</Button>
        </div>
      </div>
    </div>
  );
}

function SettingsTab({ qc }: { qc: any }) {
  const { data, isLoading } = useQuery({
    queryKey: ["restaurant-settings"],
    queryFn: () => getRestaurantSettings(),
  });
  const [total, setTotal] = useState<string>("");
  const [fee, setFee] = useState<string>("");
  const [defaultFee, setDefaultFee] = useState<string>("");
  const [limiteVirada, setLimiteVirada] = useState<string>("05:00");
  const [avisoAtivo, setAvisoAtivo] = useState<boolean>(false);
  const [avisoTitulo, setAvisoTitulo] = useState<string>("");
  const [avisoMensagem, setAvisoMensagem] = useState<string>("");
  const [avisoLink, setAvisoLink] = useState<string>("");
  const [deliveryModuleEnabled, setDeliveryModuleEnabled] = useState<boolean>(true);


  useEffect(() => {
    if (data) {
      setTotal(String(data.total_tables));
      setFee(String(data.delivery_fee ?? 5));
      setDefaultFee(String((data as any).default_neighborhood_fee ?? 15));
      setLimiteVirada(String((data as any).limite_virada_caixa ?? "05:00"));
      setAvisoAtivo(Boolean((data as any).aviso_ativo));
      setAvisoTitulo(String((data as any).aviso_titulo ?? ""));
      setAvisoMensagem(String((data as any).aviso_mensagem ?? ""));
      setAvisoLink(String((data as any).aviso_link ?? ""));
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () =>
      updateRestaurantSettings({
        total_tables: parseInt(total, 10),
        delivery_fee: parseFloat(fee) || 0,
        default_neighborhood_fee: parseFloat(defaultFee) || 0,
        limite_virada_caixa: /^\d{2}:\d{2}$/.test(limiteVirada) ? limiteVirada : "05:00",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restaurant-settings"] });

      toast.success("Configurações salvas");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveAvisoMut = useMutation({
    mutationFn: () =>
      updateRestaurantSettings({
        total_tables: parseInt(total, 10) || data?.total_tables || 10,
        aviso_ativo: avisoAtivo,
        aviso_titulo: (avisoTitulo || "").trim() || null,
        aviso_mensagem: (avisoMensagem || "").trim() || null,
        aviso_link: (avisoLink || "").trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restaurant-settings"] });
      toast.success("Aviso atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const forceClosedMut = useMutation({
    mutationFn: (value: boolean) =>
      updateRestaurantSettings({
        total_tables: parseInt(total, 10) || data?.total_tables || 10,
        force_closed: value,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restaurant-settings"] });
      toast.success("Status atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Neighborhoods CRUD
  const { data: neighborhoods = [] } = useQuery({
    queryKey: ["delivery-neighborhoods"],
    queryFn: () => listNeighborhoods(),
  });
  const [newName, setNewName] = useState("");
  const [newFee, setNewFee] = useState("");
  const [editing, setEditing] = useState<Record<string, { name: string; fee: string }>>({});

  const refetchN = () =>
    qc.invalidateQueries({ queryKey: ["delivery-neighborhoods"] });

  const addMut = useMutation({
    mutationFn: () =>
      upsertNeighborhood({ name: newName.trim(), fee: parseFloat(newFee) || 0 }),
    onSuccess: () => {
      toast.success("Bairro adicionado");
      setNewName("");
      setNewFee("");
      refetchN();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const editMut = useMutation({
    mutationFn: (vars: { id: string; name: string; fee: number }) =>
      upsertNeighborhood(vars),
    onSuccess: () => {
      toast.success("Bairro atualizado");
      setEditing({});
      refetchN();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteNeighborhood(id),
    onSuccess: () => {
      toast.success("Bairro removido");
      refetchN();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#E7D3B1]">Configurações</h1>
        <p className="text-sm text-[#A3A3A3]">Ajustes gerais do restaurante</p>
      </div>

      <div className="bg-[#121212] border border-[#3A2414] rounded-2xl p-5 max-w-md space-y-4">
        <div>
          <Label className="text-sm">Número total de mesas</Label>
          <p className="text-xs text-[#A3A3A3] mb-2">
            Os números das mesas são gerados automaticamente (01 até o total).
          </p>
          <Input
            type="number"
            min={0}
            max={500}
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            disabled={isLoading}
            className="bg-[#1a1a1a] border-[#3A2414]"
          />
        </div>
        <div>
          <Label className="text-sm">Taxa para Bairros Não Listados (Padrão) — R$</Label>
          <p className="text-xs text-[#A3A3A3] mb-2">
            Aplicada quando o cliente escolhe "Outros / Não encontrei meu bairro".
          </p>
          <Input
            type="number"
            min={0}
            max={1000}
            step="0.01"
            value={defaultFee}
            onChange={(e) => setDefaultFee(e.target.value)}
            disabled={isLoading}
            className="bg-[#1a1a1a] border-[#3A2414]"
          />
        </div>
        <Button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending || !total || isNaN(parseInt(total, 10))}
          className="bg-[#FF7A00] hover:bg-[#D97706] text-black w-full"
        >
          {saveMut.isPending ? "Salvando…" : "Salvar configurações"}
        </Button>
      </div>

      <div className="bg-[#121212] border border-[#3A2414] rounded-2xl p-5 max-w-2xl space-y-4">
        <div>
          <h2 className="text-lg font-bold text-[#E7D3B1]">Taxas por Bairro</h2>
          <p className="text-xs text-[#A3A3A3]">
            Cadastre cada bairro atendido e o valor da taxa de entrega correspondente.
          </p>
        </div>

        <div className="grid grid-cols-[1fr_140px_auto] gap-2 items-end">
          <div>
            <Label className="text-xs">Nome do bairro</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Vila Natal"
              className="bg-[#1a1a1a] border-[#3A2414]"
              maxLength={120}
            />
          </div>
          <div>
            <Label className="text-xs">Taxa (R$)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={newFee}
              onChange={(e) => setNewFee(e.target.value)}
              placeholder="0,00"
              className="bg-[#1a1a1a] border-[#3A2414]"
            />
          </div>
          <Button
            onClick={() => addMut.mutate()}
            disabled={addMut.isPending || !newName.trim()}
            className="bg-[#FF7A00] hover:bg-[#D97706] text-black"
          >
            <Plus className="w-4 h-4 mr-1" /> Adicionar
          </Button>
        </div>

        <div className="border-t border-[#3A2414] pt-3 space-y-2 max-h-96 overflow-y-auto">
          {neighborhoods.length === 0 ? (
            <p className="text-sm text-[#A3A3A3] italic">
              Nenhum bairro cadastrado ainda.
            </p>
          ) : (
            neighborhoods.map((n) => {
              const ed = editing[n.id];
              const isEditing = !!ed;
              return (
                <div
                  key={n.id}
                  className="grid grid-cols-[1fr_140px_auto_auto] gap-2 items-center bg-[#1a1a1a] border border-[#3A2414] rounded-lg px-3 py-2"
                >
                  {isEditing ? (
                    <>
                      <Input
                        value={ed.name}
                        onChange={(e) =>
                          setEditing((s) => ({
                            ...s,
                            [n.id]: { ...s[n.id], name: e.target.value },
                          }))
                        }
                        className="bg-[#0a0a0a] border-[#3A2414] h-8"
                      />
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={ed.fee}
                        onChange={(e) =>
                          setEditing((s) => ({
                            ...s,
                            [n.id]: { ...s[n.id], fee: e.target.value },
                          }))
                        }
                        className="bg-[#0a0a0a] border-[#3A2414] h-8"
                      />
                      <Button
                        size="sm"
                        onClick={() =>
                          editMut.mutate({
                            id: n.id,
                            name: ed.name.trim(),
                            fee: parseFloat(ed.fee) || 0,
                          })
                        }
                        className="bg-[#FF7A00] hover:bg-[#D97706] text-black h-8"
                      >
                        Salvar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setEditing((s) => {
                            const { [n.id]: _, ...rest } = s;
                            return rest;
                          })
                        }
                        className="h-8 text-[#A3A3A3]"
                      >
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="font-bold text-sm text-[#E7D3B1]">{n.name}</div>
                      <div className="text-sm text-[#D4A15A]">
                        R$ {n.fee.toFixed(2).replace(".", ",")}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setEditing((s) => ({
                            ...s,
                            [n.id]: { name: n.name, fee: String(n.fee) },
                          }))
                        }
                        className="h-8"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Remover o bairro "${n.name}"?`)) {
                            delMut.mutate(n.id);
                          }
                        }}
                        className="h-8 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="bg-[#121212] border border-[#3A2414] rounded-2xl p-5 max-w-md space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#E7D3B1]">Forçar Fechamento Manual</h2>
            <p className="text-xs text-[#A3A3A3]">
              Ative em caso de imprevistos (falta de energia, fechamento antecipado). Bloqueia novos pedidos no cardápio.
            </p>
          </div>
          <Switch
            checked={Boolean((data as any)?.force_closed)}
            onCheckedChange={(v) => forceClosedMut.mutate(v)}
            disabled={forceClosedMut.isPending}
          />
        </div>
      </div>


      {/* 
      <div className="bg-[#121212] border border-[#D4A15A]/30 rounded-2xl p-5 max-w-md space-y-3">
        <div>
          <h2 className="text-lg font-bold text-[#D4A15A]">Trava de Virada de Caixa</h2>
          <p className="text-xs text-[#A3A3A3]">
            Horário limite (madrugada) para o sistema encerrar automaticamente o caixa aberto do dia anterior.
          </p>
        </div>
        <Input
          type="time"
          value={limiteVirada}
          onChange={(e) => setLimiteVirada(e.target.value)}
          className="bg-[#1a1a1a] border-[#3A2414]"
        />
        <Button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          className="bg-[#D4A15A] hover:bg-[#c0904a] text-black w-full"
        >
          {saveMut.isPending ? "Salvando…" : "Salvar trava"}
        </Button>
      </div>

      <div className="bg-[#121212] border border-[#D4A15A]/30 rounded-2xl p-5 max-w-md space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#D4A15A]">Aviso Importante (Cliente)</h2>
            <p className="text-xs text-[#A3A3A3]">
              Modal exibido automaticamente ao cliente quando a loja abrir. Ideal para link do Instagram, comunicados, promoções.
            </p>
          </div>
          <Switch checked={avisoAtivo} onCheckedChange={setAvisoAtivo} />
        </div>
        <div className="space-y-2">
          <Label className="text-sm">Título</Label>
          <Input
            value={avisoTitulo}
            onChange={(e) => setAvisoTitulo(e.target.value)}
            placeholder="Ex: Estamos abertos!"
            maxLength={120}
            className="bg-[#1a1a1a] border-[#3A2414]"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm">Mensagem</Label>
          <Textarea
            value={avisoMensagem}
            onChange={(e) => setAvisoMensagem(e.target.value)}
            placeholder="Ex: Siga nosso Instagram para receber os combos do dia."
            maxLength={500}
            rows={3}
            className="bg-[#1a1a1a] border-[#3A2414]"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm">Link (opcional)</Label>
          <Input
            value={avisoLink}
            onChange={(e) => setAvisoLink(e.target.value)}
            placeholder="https://instagram.com/oxenteburguer"
            maxLength={300}
            className="bg-[#1a1a1a] border-[#3A2414]"
          />
        </div>
        <Button
          onClick={() => saveAvisoMut.mutate()}
          disabled={saveAvisoMut.isPending}
          className="bg-[#D4A15A] hover:bg-[#c0904a] text-black w-full"
        >
          {saveAvisoMut.isPending ? "Salvando…" : "Salvar aviso"}
        </Button>
      </div>
      */}

      <OpeningHoursPanel qc={qc} />
    </div>
  );
}

const DAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function OpeningHoursPanel({ qc }: { qc: any }) {
  const { data } = useQuery({
    queryKey: ["opening-hours"],
    queryFn: () => listOpeningHours(),
  });
  const [rows, setRows] = useState<Array<{ day_of_week: number; open_time: string; close_time: string; is_closed: boolean }>>([]);

  useEffect(() => {
    if (!data) return;
    const byDay = new Map(data.map((d) => [d.day_of_week, d]));
    setRows(
      Array.from({ length: 7 }, (_, i) => {
        const existing = byDay.get(i);
        return {
          day_of_week: i,
          open_time: existing?.open_time ?? "18:00",
          close_time: existing?.close_time ?? "23:00",
          is_closed: existing?.is_closed ?? false,
        };
      }),
    );
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () => updateOpeningHours({ hours: rows }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opening-hours"] });
      toast.success("Horários salvos");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = (idx: number, patch: Partial<typeof rows[number]>) => {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  return (
    <div className="bg-[#121212] border border-[#3A2414] rounded-2xl p-5 max-w-2xl space-y-3">
      <div>
        <h2 className="text-lg font-bold text-[#E7D3B1]">Horário de Funcionamento</h2>
        <p className="text-xs text-[#A3A3A3]">Defina o horário de abertura e fechamento para cada dia da semana.</p>
      </div>
      <div className="space-y-2">
        {rows.map((row, idx) => (
          <div key={row.day_of_week} className="grid grid-cols-[110px_1fr_1fr_auto] gap-2 items-center bg-[#1a1a1a] border border-[#3A2414] rounded-lg px-3 py-2">
            <div className="text-sm font-bold text-[#E7D3B1]">{DAY_LABELS[row.day_of_week]}</div>
            <Input
              type="time"
              value={row.open_time}
              onChange={(e) => update(idx, { open_time: e.target.value })}
              disabled={row.is_closed}
              className="bg-[#0a0a0a] border-[#3A2414] h-8"
            />
            <Input
              type="time"
              value={row.close_time}
              onChange={(e) => update(idx, { close_time: e.target.value })}
              disabled={row.is_closed}
              className="bg-[#0a0a0a] border-[#3A2414] h-8"
            />
            <label className="flex items-center gap-2 text-xs text-[#A3A3A3]">
              <Switch
                checked={row.is_closed}
                onCheckedChange={(v) => update(idx, { is_closed: v })}
              />
              Fechado
            </label>
          </div>
        ))}
      </div>
      <Button
        onClick={() => saveMut.mutate()}
        disabled={saveMut.isPending || rows.length !== 7}
        className="bg-[#FF7A00] hover:bg-[#D97706] text-black w-full"
      >
        {saveMut.isPending ? "Salvando…" : "Salvar horários"}
      </Button>
    </div>
  );
}

function OrderDetailsDialog({ order, onClose, menuItems, qc, onStatusChange }: any) {
  const isDelivery = order.source === "delivery";
  const [showPayment, setShowPayment] = useState(false);
  const [printType, setPrintType] = useState<null | "ticket" | "label">(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelPassword, setCancelPassword] = useState("");

  useEffect(() => {
    if (!printType) return;
    document.body.dataset.printMode = printType === "ticket" ? "receipt" : "label";
    const selector = printType === "ticket" ? "#cupom-impressao img" : "#etiqueta-impressao img";
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(selector));
    const waitForImages = Promise.all(
      imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }),
      ),
    );
    const cleanup = () => {
      delete document.body.dataset.printMode;
      setPrintType(null);
    };
    window.addEventListener("afterprint", cleanup, { once: true });
    waitForImages.then(() => {
      setTimeout(() => {
        window.print();
        setTimeout(cleanup, 500);
      }, 50);
    });
    return () => {
      delete document.body.dataset.printMode;
      window.removeEventListener("afterprint", cleanup);
    };
  }, [printType]);

  const isMesa = order.source === "mesa";
  const statusOptions: { key: string; label: string }[] = isMesa
    ? [
        { key: "pending", label: "PEDIDO RECEBIDO" },
        { key: "preparing", label: "EM PREPARO" },
        { key: "ready", label: "PRONTO PARA MESA" },
      ]
    : [
        { key: "pending", label: "PEDIDO RECEBIDO" },
        { key: "preparing", label: "EM PREPARO" },
        { key: "delivered", label: isDelivery ? "SAIU PARA ENTREGA" : "PRONTO PARA RETIRADA" },
        { key: "completed", label: "CONCLUÍDO" },
      ];
  const FLOW = ["pending", "preparing", "ready", "delivered", "completed"];
  const currentIdx = FLOW.indexOf(order.status);
  const isTerminal = order.status === "completed" || order.status === "cancelled";

  const statusMut = useMutation({
    mutationFn: (v: { status: string }) =>
      updateOrderStatus({ id: order.id, status: v.status as any }),
    onSuccess: (_d, v) => {
      onStatusChange?.(v.status);
      qc?.invalidateQueries({ queryKey: ["admin", "all"] });
      toast.success("Status atualizado");
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao atualizar status"),
  });

  const cancelMut = useMutation({
    mutationFn: async (password: string) => {
      const { data: u } = await supabase.auth.getUser();
      const email = u.user?.email;
      if (!email) throw new Error("Sessão inválida. Faça login novamente.");
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error("__wrong_password__");
      return updateOrderStatus({ id: order.id, status: "cancelled" as any });
    },
    onSuccess: () => {
      onStatusChange?.("cancelled");
      qc?.invalidateQueries({ queryKey: ["admin", "all"] });
      toast.success("Pedido cancelado");
      setCancelDialogOpen(false);
      setCancelPassword("");
      onClose?.();
    },
    onError: (e: any) => {
      if (e?.message === "__wrong_password__") {
        toast.error("Senha incorreta");
        return;
      }
      toast.error(e?.message || "Falha ao cancelar pedido");
    },
  });

  const handleStatusClick = (nextStatus: string) => {
    // Apenas atualiza o banco de dados silenciosamente
    statusMut.mutate({ status: nextStatus });
  };

  const updateFinanceiroMut = useMutation({
    mutationFn: async (next: string) => {
      const { error } = await supabase
        .from("orders")
        .update({ status_financeiro: next } as any)
        .eq("id", order.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, next) => {
      qc?.invalidateQueries({ queryKey: ["admin", "all"] });
      toast.success(
        next === "pago" ? "Pagamento confirmado" : "Pagamento recusado",
      );
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao atualizar pagamento"),
  });

  const handleSendTracking = () => {
    try {
      const rawPhone = order.customer_whatsapp ?? order.customer_phone ?? (order.customers?.whatsapp) ?? "";
      const cleanedPhone = String(rawPhone).replace(/\D/g, "");

      if (!cleanedPhone) return;

      const phone = cleanedPhone.startsWith("55") ? cleanedPhone : `55${cleanedPhone}`;
      const customerName = (order.customer_name || "Cliente").slice(0, 50);
      
      const trackingUrl = `${window.location.origin}/pedido/${order.id}`;
      const message = `Olá, *${customerName}*! Seu pedido na CISSABURGER já foi recebido com sucesso! 🌵🍔 Para acompanhar o preparo e a entrega em tempo real, clique no seu link de rastreio exclusivo: ${trackingUrl}. Obrigado pela preferência! ❤️`;

      const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Erro ao enviar rastreio via WhatsApp:", error);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#121212] border-[#3A2414] text-[#E7D3B1] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#FF7A00]" />
            Detalhes do Pedido #{order.id.slice(0, 8).toUpperCase()}
          </DialogTitle>
          <div className="px-6 pb-2">
            <Button
              onClick={handleSendTracking}
              disabled={!(order.customer_whatsapp || order.customer_phone || order.customers?.whatsapp)}
              className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-bold h-10 gap-2 shadow-lg shadow-[#25D366]/20 transition-all active:scale-[0.98]"
            >
              <Smartphone className="w-4 h-4" />
              💬 Enviar Rastreio no WhatsApp
            </Button>
          </div>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#1a1a1a] p-3 rounded-xl border border-[#3A2414]/50 flex flex-col justify-between h-full">
              <div>
                <p className="text-[10px] text-[#A3A3A3] uppercase mb-1">Cliente</p>
                <p className="font-bold truncate text-sm" title={order.customer_name || "Não informado"}>
                  {order.customer_name || "Não informado"}
                </p>
                {(order.customer_whatsapp || order.customers?.whatsapp) && (
                  <p className="text-[10px] text-[#D4A15A] mt-0.5">
                    WhatsApp: {order.customer_whatsapp || order.customers?.whatsapp}
                  </p>
                )}
              </div>
            </div>
            <div className="bg-[#1a1a1a] p-3 rounded-xl border border-[#3A2414]/50 flex flex-col justify-between h-full">
              <div>
                <p className="text-[10px] text-[#A3A3A3] uppercase mb-1">Status</p>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full inline-block ${
                  order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                  order.status === 'preparing' ? 'bg-blue-500/20 text-blue-500' :
                  order.status === 'ready' ? 'bg-indigo-500/20 text-indigo-400' :
                  order.status === 'delivered' ? 'bg-orange-500/20 text-orange-400' :
                  order.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                  'bg-red-500/20 text-red-500'
                }`}>
                  {order.status}
                </span>
              </div>
              {order.updated_at && (
                <p className="text-[9px] text-[#A3A3A3] mt-1 whitespace-nowrap">
                  Atualizado: {new Date(order.updated_at).toLocaleTimeString('pt-BR')}
                </p>
              )}
            </div>
            <div className="bg-[#1a1a1a] p-3 rounded-xl border border-[#3A2414]/50 flex flex-col justify-between h-full">
              <div>
                <p className="text-[10px] text-[#A3A3A3] uppercase mb-1">Data/Hora</p>
                <p className="text-sm">{new Date(order.created_at).toLocaleString('pt-BR')}</p>
              </div>
            </div>
            <div className="bg-[#1a1a1a] p-3 rounded-xl border border-[#3A2414]/50 flex flex-col justify-between h-full">
              <div>
                <p className="text-[10px] text-[#A3A3A3] uppercase mb-1">Tipo de Pedido</p>
                <p className="text-sm capitalize truncate">{order.source} {order.table_number && `(Mesa ${order.table_number})`}</p>
              </div>
            </div>
          </div>

          {/* Informações Financeiras e de Pagamento */}
          <div className="bg-[#1a1a1a] border border-[#3A2414] rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-[#A3A3A3] uppercase font-bold tracking-widest">Forma de Pagamento</span>
              <span className="text-xs font-bold text-[#FF7A00] uppercase">{order.payment_method === 'card' ? (order.payment_details?.card_type === 'credit' ? 'Cartão Crédito' : 'Cartão Débito') : (order.payment_method === 'cash' ? 'Dinheiro' : order.payment_method)}</span>
            </div>
            
            {order.payment_method === 'cash' && order.needs_change && (
              <div className="flex justify-between items-center text-xs border-t border-[#3A2414]/40 pt-2">
                <span className="text-[#A3A3A3]">Troco para:</span>
                <span className="font-bold text-emerald-400">R$ {Number(order.change_for).toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between items-center text-xs border-t border-[#3A2414]/40 pt-2">
              <span className="text-[#A3A3A3]">Status Financeiro:</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                order.status_financeiro === 'pago' ? 'bg-emerald-500/10 text-emerald-500' :
                order.status_financeiro === 'aguardando_pix' ? 'bg-amber-500/10 text-amber-500' :
                order.status_financeiro === 'aguardando_pagamento' ? 'bg-yellow-500/15 text-yellow-300' :
                order.status_financeiro === 'pagamento_rejeitado' ? 'bg-red-500/15 text-red-400' :
                'bg-red-500/10 text-red-500'
              }`}>
                {order.status_financeiro === 'aguardando_pagamento'
                  ? '⏳ Aguardando Pagamento'
                  : order.status_financeiro === 'pagamento_rejeitado'
                  ? '✕ Recusado'
                  : (order.status_financeiro || 'Pendente')}
              </span>
            </div>

            {order.status_financeiro === 'aguardando_pagamento' && (
              <div className="border-t border-[#3A2414]/40 pt-3 space-y-2">
                <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-lg p-3 text-xs text-yellow-200">
                  ⏳ <span className="font-bold">Pedido aguardando confirmação do pagamento PIX.</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => updateFinanceiroMut.mutate("pago")}
                    disabled={updateFinanceiroMut.isPending}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                  >
                    <Check className="w-4 h-4 mr-1" /> Confirmar Pagamento
                  </Button>
                  <Button
                    onClick={() => updateFinanceiroMut.mutate("pagamento_rejeitado")}
                    disabled={updateFinanceiroMut.isPending}
                    variant="outline"
                    className="border-red-500/60 text-red-300 hover:bg-red-500/10"
                  >
                    <X className="w-4 h-4 mr-1" /> Recusar Pagamento
                  </Button>
                </div>
              </div>
            )}
          </div>

          {order.source === 'delivery' && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl">
              <h4 className="text-emerald-400 text-xs font-bold uppercase flex items-center gap-2 mb-2">
                <MapPin className="w-3.5 h-3.5" /> Endereço de Entrega
              </h4>
              <p className="text-sm">{order.delivery_address}</p>
              {order.delivery_reference && (
                <p className="text-xs text-[#A3A3A3] mt-2 italic">Referência: {order.delivery_reference}</p>
              )}
            </div>
          )}

          <div className="space-y-3">
            <h4 className="text-[10px] text-[#A3A3A3] uppercase font-bold tracking-widest">Itens do Pedido</h4>
            <div className="space-y-2">
              {(order.order_items || []).map((item: any, i: number) => {
                const menuItem = menuItems.find((m: any) => m.id === item.menu_item_id);
                const extrasTotal = Array.isArray(item.extras)
                  ? item.extras.reduce(
                      (a: number, ex: any) =>
                        a + Number(ex.price ?? 0) * Number(ex.qty ?? 0),
                      0,
                    )
                  : 0;
                
                return (
                  <div key={i} className="flex justify-between items-start p-3 bg-[#1a1a1a]/40 border border-[#3A2414]/30 rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[#FF7A00] font-bold">{item.quantity}x</span>
                        <span className="font-bold text-sm">{menuItem?.name || "Produto"}</span>
                        <span className="text-xs text-[#A3A3A3] ml-2 font-normal">
                          R$ {Number(item.unit_price).toFixed(2)}
                        </span>
                      </div>
                      
                      {Array.isArray(item.extras) && item.extras.length > 0 && (
                        <ul className="ml-6 space-y-0.5 mt-1 border-l border-[#3A2414] pl-3">
                          {item.extras.map((ex: any, j: number) => (
                            <li key={j} className="text-[11px] text-[#A3A3A3] flex justify-between gap-4">
                              <span>+ {ex.qty}x {ex.name}</span>
                              <span className="text-[#D4A15A]">R$ {(Number(ex.price) * Number(ex.qty)).toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      
                      {item.notes && (
                        <p className="text-xs text-[#D4A15A] italic ml-6 mt-1 bg-[#D4A15A]/5 p-1.5 rounded border border-[#D4A15A]/10">
                          Obs: {item.notes}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">
                        R$ {((Number(item.unit_price) + extrasTotal) * Number(item.quantity)).toFixed(2)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {!isTerminal && (
            <div className="space-y-2">
              <h4 className="text-[10px] text-[#A3A3A3] uppercase font-bold tracking-widest">
                Atualizar Status
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {statusOptions.map((opt, i) => {
                  const active = order.status === opt.key;
                  const disabled =
                    statusMut.isPending ||
                    active ||
                    (opt.key === "delivered" && order.source === "mesa");
                  return (
                    <button
                      key={opt.key}
                      onClick={() => handleStatusClick(opt.key)}
                      disabled={disabled}
                      className={`text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-lg border transition-all ${
                        active
                          ? "bg-[#FF7A00] border-[#FF7A00] text-[#121212]"
                          : disabled
                          ? "bg-[#1a1a1a]/40 border-[#3A2414]/40 text-[#5a5a5a] cursor-not-allowed"
                          : "bg-[#1a1a1a] border-[#3A2414] text-[#E7D3B1] hover:border-[#FF7A00] hover:text-[#FF7A00]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-[#3A2414]/60 space-y-2">
            {Number(order.delivery_fee) > 0 && (
              <div className="flex justify-between text-sm text-[#A3A3A3]">
                <span>Taxa de Entrega</span>
                <span>R$ {Number(order.delivery_fee).toFixed(2)}</span>
              </div>
            )}
            <div className="bg-[#FF7A00]/10 p-4 rounded-xl border border-[#FF7A00]/20 space-y-2">
              <div className="flex justify-between items-center text-xs text-[#A3A3A3] uppercase tracking-wider">
                <span>Subtotal Itens + Adicionais</span>
                <span className="font-bold">R$ {(() => {
                  const itemsSum = (order.order_items || []).reduce(
                    (s: number, it: any) => {
                      const ex = Array.isArray(it.extras)
                        ? it.extras.reduce(
                            (a: number, e: any) =>
                              a + Number(e.price ?? 0) * Number(e.qty ?? 0),
                            0,
                          )
                        : 0;
                      return s + (Number(it.unit_price) + ex) * Number(it.quantity);
                    },
                    0,
                  );
                  return itemsSum.toFixed(2);
                })()}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-[#FF7A00]/10">
                <span className="font-bold text-[#E7D3B1]">Total do Pedido</span>
                <span className="text-xl font-black text-[#FF7A00]">R$ {(() => {
                  const itemsSum = (order.order_items || []).reduce(
                    (s: number, it: any) => {
                      const ex = Array.isArray(it.extras)
                        ? it.extras.reduce(
                            (a: number, e: any) =>
                              a + Number(e.price ?? 0) * Number(e.qty ?? 0),
                            0,
                          )
                        : 0;
                      return s + (Number(it.unit_price) + ex) * Number(it.quantity);
                    },
                    0,
                  );
                  const total = itemsSum + Number(order.delivery_fee ?? 0);
                  return total.toFixed(2);
                })()}</span>
              </div>
            </div>
            {order.status === 'pending' && order.source !== 'mesa' && (
              (order.payment_method === 'pix' && order.status_financeiro === 'aguardando_pix') ? (
                <div className="w-full flex items-center justify-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg h-12 mt-2 text-sm font-bold">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Aguardando confirmação automática do PIX...
                </div>
              ) : (order.payment_method === 'pix' && (order.status_financeiro === 'paid' || order.status_financeiro === 'pago')) ? (
                <div className="w-full flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg h-12 mt-2 text-sm font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  Pagamento Confirmado
                </div>
              ) : (
                <Button
                  onClick={() => setShowPayment(true)}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12 mt-2"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  Finalizar Pagamento
                </Button>
              )
            )}
            {order.source === 'mesa' && order.status !== 'completed' && order.status !== 'cancelled' && (
              <div className="text-[11px] text-center text-[#A3A3A3] bg-[#1a1a1a]/60 border border-[#3A2414]/60 rounded-lg px-3 py-2 mt-2">
                Pagamento desta mesa é finalizado no <span className="text-[#FF7A00] font-bold">Gestor de Comandas</span>.
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-wrap items-center gap-2 justify-between w-full">
          {!isTerminal && (
            <Button
              variant="outline"
              size="icon"
              className="border-red-600/60 text-red-400 hover:bg-red-600/10 hover:text-red-300"
              onClick={() => { setCancelPassword(""); setCancelDialogOpen(true); }}
              disabled={cancelMut.isPending}
              title="Cancelar Pedido (senha admin)"
              aria-label="Cancelar Pedido (senha admin)"
            >
              {cancelMut.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <X className="w-4 h-4" />
              )}
            </Button>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto border-[#3A2414] text-[#A3A3A3]" onClick={onClose}>
              Fechar Detalhes
            </Button>
            <div className="w-full sm:w-auto grid grid-cols-2 gap-2">
              <Button 
                className="w-full bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold"
                onClick={() => setPrintType("ticket")}
              >
                <Printer className="w-4 h-4 mr-2" />
                Recibo
              </Button>
              <Button 
                variant="outline"
                className="w-full border-[#FF7A00] text-[#FF7A00] hover:bg-[#FF7A00]/10 font-bold"
                onClick={() => setPrintType("label")}
              >
                <FileText className="w-4 h-4 mr-2" />
                Etiqueta
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
      {printType === "ticket" && typeof document !== "undefined"
        ? createPortal(<PrintTicket order={order} menuItems={menuItems} />, document.body)
        : null}
      {printType === "label" && typeof document !== "undefined"
        ? createPortal(<PrintLabel order={order} />, document.body)
        : null}
      {showPayment && (
        <PaymentDialog
          order={order}
          qc={qc}
          onClose={() => {
            setShowPayment(false);
            onStatusChange?.('preparing');
          }}
        />
      )}
      <Dialog
        open={cancelDialogOpen}
        onOpenChange={(open) => {
          if (cancelMut.isPending) return;
          setCancelDialogOpen(open);
          if (!open) setCancelPassword("");
        }}
      >
        <DialogContent className="bg-[#0d0907] border border-[#3A2414] text-[#E7D3B1] rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#FF7A00]">Confirmar Cancelamento</DialogTitle>
            <DialogDescription className="text-[#A3A3A3]">
              Digite a senha do administrador para confirmar a exclusão do pedido.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!cancelPassword) {
                toast.error("Digite a senha do administrador");
                return;
              }
              cancelMut.mutate(cancelPassword);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="admin-cancel-password" className="text-[#D4A15A]">
                Senha do administrador
              </Label>
              <Input
                id="admin-cancel-password"
                type="password"
                autoFocus
                value={cancelPassword}
                onChange={(e) => setCancelPassword(e.target.value)}
                disabled={cancelMut.isPending}
                className="bg-[#1a1a1a] border-[#3A2414] text-[#E7D3B1] placeholder:text-[#666]"
                placeholder="••••••••"
              />
            </div>
            <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-[#3A2414] text-[#A3A3A3] hover:text-[#E7D3B1]"
                onClick={() => {
                  setCancelDialogOpen(false);
                  setCancelPassword("");
                }}
                disabled={cancelMut.isPending}
              >
                Voltar
              </Button>
              <Button
                type="submit"
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
                disabled={cancelMut.isPending || !cancelPassword}
              >
                {cancelMut.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  "Confirmar Exclusão"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function CashFlowTab({ qc }: { qc: any }) {
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState<{ type: "sangria" | "suprimento" } | null>(null);
  const [view, setView] = useState<"current" | "history">("current");

  const { data: status, isLoading: loadingStatus } = useQuery({
    queryKey: ["cash", "status"],
    queryFn: () => getCashStatus(),
  });

  const { data: paidOrders, isLoading: loadingOrders } = useQuery({
    queryKey: ["cash", "daily-orders"],
    queryFn: () => getDailyPaidOrders(),
    enabled: status?.status === "open",
  });

  const { data: allExpenses } = useQuery({
    queryKey: ["admin", "expenses"],
    queryFn: () => listExpenses(),
    enabled: status?.status === "open",
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const todayExpenses = allExpenses?.filter((e: any) => e.expense_date === todayStr) || [];
  const totalExpenses = todayExpenses.reduce((sum: number, e: any) => sum + Number(e.amount), 0);

  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ["cash", "history"],
    queryFn: () => getCashHistory(),
    enabled: view === "history",
  });

  if (loadingStatus) return <div className="p-8 text-center text-[#A3A3A3]">Carregando caixa...</div>;

  const isOpen = status?.status === "open";

  // Calcular totais do dia para o caixa aberto
  const totalOrders = paidOrders?.reduce((sum: number, o: any) => sum + Number(o.total_amount), 0) || 0;
  const suprimentos = status?.cash_movements?.filter((m: any) => m.type === "suprimento").reduce((sum: number, m: any) => sum + Number(m.amount), 0) || 0;
  const sangrias = status?.cash_movements?.filter((m: any) => m.type === "sangria").reduce((sum: number, m: any) => sum + Number(m.amount), 0) || 0;


  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E7D3B1]">Fluxo de Caixa</h1>
          <p className="text-sm text-[#A3A3A3]">
            {isOpen ? "Caixa aberto desde " + new Date(status.opening_time).toLocaleString() : "Caixa fechado"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setView(view === "current" ? "history" : "current")}
            className="border-[#3A2414] text-[#A3A3A3]"
          >
            {view === "current" ? <History className="w-4 h-4 mr-2" /> : <Calculator className="w-4 h-4 mr-2" />}
            {view === "current" ? "Histórico" : "Caixa Atual"}
          </Button>
          {!isOpen && (
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={() => setShowOpenModal(true)}>
              <PlusCircle className="w-4 h-4 mr-2" /> Abrir Caixa
            </Button>
          )}
          {isOpen && (
            <Button className="bg-red-600 hover:bg-red-700 text-white font-bold" onClick={() => setShowCloseModal(true)}>
              <CheckCircle2 className="w-4 h-4 mr-2" /> Fechar Caixa
            </Button>
          )}
        </div>
      </div>

      {view === "current" && (
        <>
          {!isOpen ? (
            <div className="bg-[#121212] border border-dashed border-[#3A2414] rounded-2xl p-12 text-center">
              <AlertCircle className="w-12 h-12 mx-auto text-[#3A2414] mb-4" />
              <h2 className="text-xl font-bold text-[#E7D3B1]">O caixa está fechado</h2>
              <p className="text-[#A3A3A3] mt-2 max-w-sm mx-auto">
                Para registrar vendas e movimentações financeiras, você precisa abrir o caixa primeiro.
              </p>
              <Button className="mt-6 bg-[#FF7A00] hover:bg-[#D97706] text-black font-bold px-8" onClick={() => setShowOpenModal(true)}>
                Abrir agora
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                <StatCard label="Saldo Inicial" value={`R$ ${Number(status?.initial_balance || 0).toFixed(2)}`} />
                <StatCard label="Vendas (+)" value={`R$ ${totalOrders.toFixed(2)}`} accent />
                <StatCard label="Suprimentos (+)" value={`R$ ${suprimentos.toFixed(2)}`} />
                <StatCard label="Sangrias (-)" value={`R$ ${sangrias.toFixed(2)}`} />
                <StatCard label="Despesas (-)" value={`R$ ${totalExpenses.toFixed(2)}`} />
                <StatCard label="Lucro Líquido" value={`R$ ${(totalOrders - totalExpenses).toFixed(2)}`} accent />
              </div>

              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <Panel title="Vendas do Turno" subtitle="Pagamentos confirmados automaticamente">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-wider text-[#A3A3A3] border-b border-[#3A2414]/40">
                            <th className="pb-2 font-normal">Hora</th>
                            <th className="pb-2 font-normal">Cliente</th>
                            <th className="pb-2 font-normal">Pagamento</th>
                            <th className="pb-2 font-normal text-right">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#3A2414]/20">
                          {paidOrders?.map((order) => (
                            <tr key={order.id} className="hover:bg-[#1a1a1a]/40 transition-colors">
                              <td className="py-3 text-[#A3A3A3]">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                              <td className="py-3 font-medium">{order.customer_name || "Balcão"}</td>
                              <td className="py-3 uppercase text-[10px] font-bold text-[#D4A15A]">{order.payment_method}</td>
                              <td className="py-3 text-right font-bold">R$ {Number(order.total_amount).toFixed(2)}</td>
                            </tr>
                          ))}
                          {(!paidOrders || paidOrders.length === 0) && (
                            <tr>
                              <td colSpan={4} className="py-8 text-center text-[#5a5a5a]">Nenhuma venda registrada neste turno.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                </div>

                <div className="space-y-4">
                  <div className="bg-[#121212] border border-[#3A2414] rounded-2xl p-5 space-y-4">
                    <h3 className="font-bold text-[#E7D3B1] flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-[#FF7A00]" /> Operações Rápidas
                    </h3>
                    <div className="grid grid-cols-1 gap-2">
                      <Button 
                        className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 w-full justify-start h-12"
                        onClick={() => setShowMoveModal({ type: "suprimento" })}
                      >
                        <PlusCircle className="w-5 h-5 mr-3" /> Suprimento (Entrada)
                      </Button>
                      <Button 
                        className="bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 w-full justify-start h-12"
                        onClick={() => setShowMoveModal({ type: "sangria" })}
                      >
                        <MinusCircle className="w-5 h-5 mr-3" /> Sangria (Retirada)
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {view === "history" && (
        <Panel title="Histórico de Caixas" subtitle="Fechamentos anteriores">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-[#A3A3A3] border-b border-[#3A2414]/40">
                  <th className="pb-2 font-normal">Data Operacional</th>
                  <th className="pb-2 font-normal">Abertura</th>
                  <th className="pb-2 font-normal">Fechamento</th>
                  <th className="pb-2 font-normal">Esperado</th>
                  <th className="pb-2 font-normal">Saldo Real</th>
                  <th className="pb-2 font-normal">Divergência</th>
                  <th className="pb-2 font-normal text-right">Status / Auditoria</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A2414]/20">
                {history?.map((reg: any) => {
                  const diff = Number(reg.divergencia || (reg.physical_balance ? Number(reg.physical_balance) - Number(reg.expected_balance) : 0));
                  const isClosedByManager = reg.observacao_divergencia === "Fechamento forçado por pendência operacional";
                  
                  return (
                    <tr key={reg.id} className="hover:bg-[#1a1a1a]/40 transition-colors">
                      <td className="py-3 font-bold text-[#D4A15A]">{reg.business_date ? new Date(reg.business_date + 'T12:00:00').toLocaleDateString('pt-BR') : "—"}</td>
                      <td className="py-3 text-[10px] text-[#A3A3A3]">{new Date(reg.opening_time).toLocaleString()}</td>
                      <td className="py-3 text-[10px] text-[#A3A3A3]">{reg.closing_time ? new Date(reg.closing_time).toLocaleString() : "—"}</td>
                      <td className="py-3">R$ {Number(reg.expected_balance).toFixed(2)}</td>
                      <td className="py-3">{reg.saldo_real !== null ? `R$ ${Number(reg.saldo_real).toFixed(2)}` : (reg.physical_balance ? `R$ ${Number(reg.physical_balance).toFixed(2)}` : "—")}</td>
                      <td className="py-3">
                        {reg.status === 'closed' ? (
                          <span className={diff < 0 ? "text-red-500" : diff > 0 ? "text-blue-500" : "text-emerald-500"}>
                            R$ {diff.toFixed(2)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-3 text-right flex flex-wrap gap-1 justify-end">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          reg.status === 'open' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-gray-500/10 text-gray-500 border border-gray-500/20'
                        }`}>
                          {reg.status === 'open' ? "Aberto" : "Caixa Encerrado"}
                        </span>
                        
                        {isClosedByManager && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            Gerente
                          </span>
                        )}

                        {reg.status === 'closed' && Math.abs(diff) > 0.01 && !isClosedByManager && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-500/10 text-red-500 border border-red-500/20">
                            Divergência
                          </span>
                        )}

                        {reg.fechado_automaticamente && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-500/10 text-purple-500 border border-purple-500/20">
                            Sistema
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {showOpenModal && (
        <OpenCashModal onClose={() => setShowOpenModal(false)} qc={qc} />
      )}
      {showCloseModal && status && (
        <CloseCashModal status={status} onClose={() => setShowCloseModal(false)} qc={qc} />
      )}
      {showMoveModal && status && (
        <CashMovementModal status={status} type={showMoveModal.type} onClose={() => setShowMoveModal(null)} qc={qc} />
      )}
    </div>
  );
}

function ExpiredCashBlockingModal({ status, restaurantSettings, userRole, qc, onClose }: any) {
  const [step, setStep] = useState<1 | 2>(1);
  const [closingData, setClosingData] = useState<any>(null);

  if (step === 1) {
    return (
      <CloseCashModal 
        status={status} 
        isBlocking 
        userRole={userRole}
        onSuccess={(data: any) => {
          setClosingData(data);
          setStep(2);
        }} 
        onClose={onClose}
        qc={qc} 
      />
    );
  }

  return (
    <OpenCashModal 
      isBlocking
      defaultBalance={closingData?.fundo_troco || 0}
      onClose={onClose}
      qc={qc} 
    />
  );
}

function OpenCashModal({ onClose, qc, isBlocking = false, defaultBalance = 0 }: any) {
  const [balance, setBalance] = useState(defaultBalance.toString());
  const [businessDate, setBusinessDate] = useState(new Date().toISOString().split('T')[0]);

  const mutation = useMutation({
    mutationFn: (v: { balance: number, date: string }) => openCash(v.balance, v.date),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash"] });
      qc.invalidateQueries({ queryKey: ["cash", "status"] });
      qc.invalidateQueries({ queryKey: ["cash", "history"] });
      toast.success("Caixa aberto com sucesso!");
      if (onClose) onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={isBlocking ? undefined : onClose}>
      <DialogContent 
        className="bg-[#121212] border-[#3A2414] text-[#E7D3B1]" 
        onPointerDownOutside={isBlocking ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={isBlocking ? (e) => e.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <PlusCircle className="text-emerald-500" />
            Abrir Novo Dia Operacional
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label>Data Operacional (Business Date)</Label>
            <Input 
              type="date" 
              value={businessDate} 
              onChange={e => setBusinessDate(e.target.value)}
              className="bg-[#1a1a1a] border-[#3A2414]"
            />
          </div>
          <div className="space-y-2">
            <Label>Saldo Inicial (Troco em Dinheiro)</Label>
            <Input 
              type="number" 
              step="0.01" 
              value={balance} 
              onChange={e => setBalance(e.target.value)}
              className="bg-[#1a1a1a] border-[#3A2414] text-xl font-bold"
              autoFocus
            />
            <p className="text-xs text-[#A3A3A3]">Fundo de reserva para troco do dia.</p>
          </div>
        </div>
        <DialogFooter>
          {!isBlocking && <Button variant="outline" className="border-[#3A2414] text-[#A3A3A3]" onClick={onClose}>Cancelar</Button>}
          <Button 
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold w-full h-12 text-lg"
            onClick={() => mutation.mutate({ balance: Number(balance), date: businessDate })}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Abrindo..." : "Abrir Novo Caixa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CloseCashModal({ status, onClose, qc, isBlocking = false, userRole, onSuccess }: any) {
  const [physical, setPhysical] = useState("");
  const [reason, setReason] = useState("");
  const [fundoTroco, setFundoTroco] = useState("0");
  const [showSummary, setShowSummary] = useState(false);
  const [showForceConfirmModal, setShowForceConfirmModal] = useState(false);

  const mutation = useMutation({
    mutationFn: (v: any) => closeCash(
      status.id, 
      v.physical_balance, 
      Number(status.expected_balance),
      v.fundo_troco,
      v.notes,
      v.observations
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash"] });
      qc.invalidateQueries({ queryKey: ["cash", "status"] });
      qc.invalidateQueries({ queryKey: ["cash", "history"] });
      if (onSuccess) {
        onSuccess({ fundo_troco: Number(fundoTroco) });
      } else {
        toast.success("Caixa fechado com sucesso!");
        setShowSummary(true);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const forceCloseMut = useMutation({
    mutationFn: () => forceCloseByManager(status.id, Number(status.expected_balance)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash"] });
      qc.invalidateQueries({ queryKey: ["cash", "status"] });
      qc.invalidateQueries({ queryKey: ["cash", "history"] });
      toast.success("Fechamento forçado realizado com sucesso!");
      if (onSuccess) {
        onSuccess({ fundo_troco: 0 });
      } else {
        if (onClose) onClose();
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const expected = Number(status.expected_balance);
  const diff = Number(physical) - expected;
  const isManager = userRole?.isManager || userRole?.isAdmin;

  if (showSummary) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="bg-[#121212] border-[#3A2414] text-[#E7D3B1] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">Resumo do Fechamento</DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-4" id="cash-close-summary">
            <div className="flex justify-between border-b border-[#3A2414]/40 pb-2">
              <span className="text-[#A3A3A3]">Saldo Inicial</span>
              <span className="font-bold">R$ {Number(status.initial_balance).toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-b border-[#3A2414]/40 pb-2">
              <span className="text-[#A3A3A3]">Saldo Esperado</span>
              <span className="font-bold">R$ {expected.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-b border-[#3A2414]/40 pb-2">
              <span className="text-[#A3A3A3]">Valor Físico</span>
              <span className="font-bold">R$ {Number(physical).toFixed(2)}</span>
            </div>
            <div className={`flex justify-between p-3 rounded-lg ${Math.abs(diff) < 0.01 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
              <span className="font-bold">Divergência</span>
              <span className={`font-black ${diff < 0 ? 'text-red-500' : diff > 0 ? 'text-blue-500' : 'text-emerald-500'}`}>
                R$ {diff.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between border-t border-[#3A2414]/40 pt-2">
              <span className="text-[#A3A3A3]">Fundo de Troco Deixado</span>
              <span className="font-bold">R$ {Number(fundoTroco).toFixed(2)}</span>
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-2">
            <Button className="w-full bg-[#FF7A00] text-black font-bold" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" /> Imprimir Resumo
            </Button>
            <Button variant="outline" className="w-full border-[#3A2414]" onClick={onClose}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent 
        className="bg-[#121212] border-[#3A2414] text-[#E7D3B1] max-w-lg"
        onPointerDownOutside={isBlocking ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={isBlocking ? (e) => e.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-500">
            <AlertCircle />
            {isBlocking ? "Conferência Obrigatória de Fechamento" : "Fechamento de Caixa"}
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#1a1a1a] p-3 rounded-xl border border-[#3A2414]">
              <p className="text-[10px] uppercase text-[#A3A3A3]">Saldo Esperado</p>
              <p className="text-xl font-bold text-[#FF7A00]">R$ {expected.toFixed(2)}</p>
            </div>
            <div className="bg-[#1a1a1a] p-3 rounded-xl border border-[#3A2414]">
              <p className="text-[10px] uppercase text-[#A3A3A3]">Troco Inicial</p>
              <p className="text-xl font-bold">R$ {Number(status.initial_balance).toFixed(2)}</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-lg font-bold">Saldo Real em Caixa (Dinheiro Físico) *</Label>
              <Input 
                type="number" 
                step="0.01" 
                value={physical} 
                onChange={e => setPhysical(e.target.value)}
                className="bg-[#1a1a1a] border-[#3A2414] text-2xl font-black h-14 text-[#FF7A00]"
                placeholder="0,00"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Fundo de Troco para Próximo Dia *</Label>
              <Input 
                type="number" 
                step="0.01" 
                value={fundoTroco} 
                onChange={e => setFundoTroco(e.target.value)}
                className="bg-[#1a1a1a] border-[#3A2414] h-12"
              />
            </div>

            {physical && Math.abs(diff) > 0.01 && (
              <div className="space-y-2 p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                <Label className="text-red-400 font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Observação da Divergência (R$ {diff.toFixed(2)})
                </Label>
                <Textarea 
                  value={reason} 
                  onChange={e => setReason(e.target.value)}
                  placeholder="Justifique a diferença encontrada no caixa..."
                  className="bg-[#0a0a0a] border-[#3A2414] min-h-[80px]"
                />
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isManager && (
            <Button 
              variant="ghost" 
              className="text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 text-xs"
              onClick={() => setShowForceConfirmModal(true)}
              disabled={forceCloseMut.isPending}
            >
              Forçar Encerramento por Gerente
            </Button>
          )}
          <div className="flex gap-2 w-full sm:w-auto ml-auto">
            {!isBlocking && <Button variant="outline" className="border-[#3A2414] text-[#A3A3A3]" onClick={onClose}>Cancelar</Button>}
            <Button 
              className="bg-red-600 hover:bg-red-700 text-white font-bold h-12 px-8"
              onClick={() => mutation.mutate({ 
                physical_balance: Number(physical), 
                fundo_troco: Number(fundoTroco),
                notes: Math.abs(diff) > 0.01 ? "Divergência apurada" : "Conferência manual realizada",
                observations: reason
              })}
              disabled={mutation.isPending || !physical}
            >
              {mutation.isPending ? "Processando..." : "Concluir Turno Anterior"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
      <Dialog open={showForceConfirmModal} onOpenChange={setShowForceConfirmModal}>
        <DialogContent className="bg-[#121212] border-[#3A2414] text-[#E7D3B1] max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500">
              <AlertCircle className="w-5 h-5" />
              Confirmar Encerramento Forçado
            </DialogTitle>
          </DialogHeader>
          <p className="py-2 text-sm text-[#E7D3B1]/90">
            Deseja forçar o encerramento do caixa? O saldo real será igualado ao esperado.
          </p>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              className="border-[#3A2414] text-[#A3A3A3]"
              onClick={() => setShowForceConfirmModal(false)}
              disabled={forceCloseMut.isPending}
            >
              Cancelar
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              onClick={() => {
                forceCloseMut.mutate(undefined, {
                  onSettled: () => {
                    setShowForceConfirmModal(false);
                  },
                });
              }}
              disabled={forceCloseMut.isPending}
            >
              {forceCloseMut.isPending ? "Processando..." : "Sim, Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function CashMovementModal({ status, type, onClose, qc }: { status: any, type: "sangria" | "suprimento", onClose: () => void, qc: any }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: (v: any) => addCashMovement(status.id, v.type, v.amount, v.reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash"] });
      toast.success(type === "sangria" ? "Sangria realizada" : "Suprimento realizado");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#121212] border-[#3A2414] text-[#E7D3B1]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === "sangria" ? <TrendingDown className="text-red-500" /> : <TrendingUp className="text-emerald-500" />}
            {type === "sangria" ? "Realizar Sangria" : "Realizar Suprimento"}
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input 
              type="number" 
              step="0.01" 
              value={amount} 
              onChange={e => setAmount(e.target.value)}
              className="bg-[#1a1a1a] border-[#3A2414]"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Motivo / Descrição *</Label>
            <Textarea 
              value={reason} 
              onChange={e => setReason(e.target.value)}
              placeholder={type === "sangria" ? "Ex: Pagamento fornecedor, Troco para entregador" : "Ex: Reforço de troco"}
              className="bg-[#1a1a1a] border-[#3A2414] min-h-[100px]"
              required
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="border-[#3A2414] text-[#A3A3A3]" onClick={onClose}>Cancelar</Button>
          <Button 
            className={type === "sangria" ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}
            onClick={() => mutation.mutate({ type, amount: Number(amount), reason })}
            disabled={mutation.isPending || !amount || reason.length < 3}
          >
            {mutation.isPending ? "Processando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductRanking({ orders }: { orders: any[] }) {
  const ranking = orders
    .filter(o => o.status !== 'cancelled')
    .flatMap(o => o.order_items || [])
    .reduce((acc: any, it: any) => {
      acc[it.menu_item_name] = (acc[it.menu_item_name] || 0) + it.quantity;
      return acc;
    }, {});

  const sorted = Object.entries(ranking)
    .sort(([, a]: any, [, b]: any) => b - a)
    .slice(0, 5);

  return (
    <div className="space-y-4">
      {sorted.map(([name, qty]: any, i) => (
        <div key={name} className="flex items-center justify-between p-3 rounded-xl bg-[#1a1a1a]/60 border border-[#3A2414]/40">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-[#D4A15A] w-4">#{i + 1}</span>
            <span className="text-sm">{name}</span>
          </div>
          <span className="font-bold text-[#FF7A00]">{qty} un</span>
        </div>
      ))}
      {sorted.length === 0 && <p className="text-center py-4 text-[#5a5a5a]">Nenhum dado disponível</p>}
    </div>
  );
}

function PaymentStat({ label, value, icon, color, bg }: any) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-[#1a1a1a]/60 border border-[#3A2414]/40">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <span className="text-sm">{label}</span>
      </div>
      <span className="font-bold text-[#E7D3B1]">R$ {Number(value).toFixed(2)}</span>
    </div>
  );
}

function MarketingTab({ qc }: { qc: any }) {
  const [subSection, setSubSection] = useState<"loyalty" | "reviews">("loyalty");
  
  const { data: loyaltyPoints } = useQuery({
    queryKey: ["admin", "loyalty"],
    queryFn: () => listLoyaltyPoints(),
  });

  const { data: reviews } = useQuery({
    queryKey: ["admin", "reviews"],
    queryFn: () => listReviews(),
  });

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-[#3A2414]">
        {[
          { id: "loyalty", label: "Fidelidade", icon: Heart },
          { id: "reviews", label: "Avaliações", icon: Star },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setSubSection(t.id as any)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
              subSection === t.id ? "border-[#FF7A00] text-[#FF7A00]" : "border-transparent text-[#A3A3A3] hover:text-[#E7D3B1]"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {subSection === "loyalty" && (
        <Panel title="Ranking de Fidelidade" subtitle="Clientes com mais pedidos">
          <div className="overflow-x-auto">
             <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-[#A3A3A3] border-b border-[#3A2414]/40">
                    <th className="pb-2 font-normal">Cliente</th>
                    <th className="pb-2 font-normal">Telefone</th>
                    <th className="pb-2 font-normal">Pontos</th>
                    <th className="pb-2 font-normal text-right">Último Pedido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3A2414]/20">
                  {loyaltyPoints?.map((p: any) => (
                    <tr key={p.id}>
                      <td className="py-3 font-medium">{p.customer_name || "—"}</td>
                      <td className="py-3 text-[#A3A3A3]">{p.customer_phone}</td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded-full bg-[#FF7A00]/10 text-[#FF7A00] font-bold">
                           {p.points} pedidos
                        </span>
                      </td>
                      <td className="py-3 text-right text-xs text-[#A3A3A3]">
                        {new Date(p.last_order_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
             </table>
          </div>
        </Panel>
      )}

      {subSection === "reviews" && (
        <div className="grid md:grid-cols-2 gap-4">
          {reviews?.map((r: any) => (
            <div key={r.id} className="p-4 bg-[#1a1a1a] border border-[#3A2414] rounded-xl space-y-2">
              <div className="flex justify-between items-start">
                <span className="font-bold text-[#E7D3B1]">{r.orders?.customer_name || "Cliente"}</span>
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-3 h-3 ${i < r.rating ? "text-yellow-500 fill-yellow-500" : "text-[#3A2414]"}`} />
                  ))}
                </div>
              </div>
              <p className="text-sm text-[#A3A3A3] italic">"{r.comment || "Sem comentário"}"</p>
              <p className="text-[10px] text-[#5a5a5a] text-right">{new Date(r.created_at).toLocaleString()}</p>
            </div>
          ))}
          {reviews?.length === 0 && <p className="col-span-2 text-center py-12 text-[#5a5a5a]">Nenhuma avaliação ainda.</p>}
        </div>
      )}
    </div>
  );
}

function FinanceTab({ qc }: { qc: any }) {
  const [subSection, setSubSection] = useState<"fluxo" | "expenses">("fluxo");

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-[#3A2414]">
        {[
          { id: "fluxo", label: "Fluxo de Caixa", icon: Banknote },
          { id: "expenses", label: "Contas a Pagar/Despesas", icon: Receipt },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setSubSection(t.id as any)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
              subSection === t.id ? "border-[#FF7A00] text-[#FF7A00]" : "border-transparent text-[#A3A3A3] hover:text-[#E7D3B1]"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
        <Link
          to="/admin/pagamento"
          className="ml-auto inline-flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wider text-[#A3A3A3] border-b-2 border-transparent hover:text-[#FF7A00] hover:border-[#FF7A00] transition-colors"
        >
          <Wallet className="w-4 h-4" /> Formas de Pagamento
        </Link>
      </div>

      {subSection === "fluxo" && <CashFlowTab qc={qc} />}
      {subSection === "expenses" && <ExpensesManager qc={qc} />}
    </div>
  );
}

function ExpensesManager({ qc }: { qc: any }) {
  const [showAdd, setShowAdd] = useState(false);
  const { data: expenses } = useQuery({
    queryKey: ["admin", "expenses"],
    queryFn: () => listExpenses(),
  });

  const totalExpenses = expenses?.reduce((sum: number, e: any) => sum + Number(e.amount), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total em Despesas" value={`R$ ${totalExpenses.toFixed(2)}`} accent />
        <StatCard label="Próximo Vencimento" value="05/06/2026" />
        <Button 
          className="h-full bg-[#FF7A00] text-black font-bold"
          onClick={() => setShowAdd(true)}
        >
          <Plus className="w-5 h-5 mr-2" /> Registrar Despesa
        </Button>
      </div>

      <Panel title="Lista de Despesas" subtitle="Controle de gastos fixos e variáveis">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-[#A3A3A3] border-b border-[#3A2414]/40">
                <th className="pb-2 font-normal">Data</th>
                <th className="pb-2 font-normal">Descrição</th>
                <th className="pb-2 font-normal">Categoria</th>
                <th className="pb-2 font-normal text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A2414]/20">
              {expenses?.map((e: any) => (
                <tr key={e.id}>
                  <td className="py-3 text-[#A3A3A3]">{new Date(e.expense_date).toLocaleDateString()}</td>
                  <td className="py-3 font-medium">{e.description}</td>
                  <td className="py-3"><span className="text-[10px] px-2 py-0.5 rounded bg-[#3A2414]">{e.category}</span></td>
                  <td className="py-3 text-right font-bold text-red-400">R$ {Number(e.amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {showAdd && (
        <Dialog open onOpenChange={() => setShowAdd(false)}>
           <DialogContent className="bg-[#121212] border-[#3A2414] text-[#E7D3B1]">
             <DialogHeader><DialogTitle>Registrar Despesa</DialogTitle></DialogHeader>
             <form className="space-y-4" onSubmit={(e) => {
               e.preventDefault();
               const fd = new FormData(e.currentTarget);
               saveExpense({
                 data: {
                   description: fd.get('desc') as string,
                   amount: Number(fd.get('amount')),
                   category: fd.get('cat') as string,
                   expense_date: fd.get('date') as string,
                 }
               }).then(() => {
                 qc.invalidateQueries({ queryKey: ["admin", "expenses"] });
                 toast.success("Despesa registrada");
                 setShowAdd(false);
               });
             }}>
               <div className="space-y-2">
                 <Label>Descrição</Label>
                 <Input name="desc" placeholder="Ex: Aluguel Junho" required className="bg-[#1a1a1a] border-[#3A2414]" />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label>Valor (R$)</Label>
                   <Input name="amount" type="number" step="0.01" required className="bg-[#1a1a1a] border-[#3A2414]" />
                 </div>
                 <div className="space-y-2">
                   <Label>Data</Label>
                   <Input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="bg-[#1a1a1a] border-[#3A2414]" />
                 </div>
               </div>
               <div className="space-y-2">
                 <Label>Categoria</Label>
                 <Select name="cat" defaultValue="Insumos">
                    <SelectTrigger className="bg-[#1a1a1a] border-[#3A2414]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#121212] border-[#3A2414] text-[#E7D3B1]">
                      <SelectItem value="Insumos">Insumos / Mercadoria</SelectItem>
                      <SelectItem value="Aluguel">Aluguel</SelectItem>
                      <SelectItem value="Energia">Energia / Água</SelectItem>
                      <SelectItem value="Pessoal">Pessoal / Salários</SelectItem>
                      <SelectItem value="Outros">Outros</SelectItem>
                    </SelectContent>
                 </Select>
               </div>
               <DialogFooter>
                 <Button type="submit" className="bg-[#FF7A00] text-black font-bold w-full">Salvar Despesa</Button>
               </DialogFooter>
             </form>
           </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function StockManager({ qc }: { qc: any }) {
  const [showAdd, setShowAdd] = useState(false);
  const { data: stock } = useQuery({
    queryKey: ["admin", "stock"],
    queryFn: () => listStockItems(),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-[#D4A15A]">Controle de Insumos</h3>
        <Button size="sm" onClick={() => setShowAdd(true)} className="bg-emerald-600 text-white font-bold">
           <Plus className="w-4 h-4 mr-2" /> Novo Insumo
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stock?.map((item: any) => {
          const isLow = Number(item.quantity) <= Number(item.min_quantity);
          return (
            <div key={item.id} className={`p-4 rounded-xl border ${isLow ? 'bg-red-500/5 border-red-500/20' : 'bg-[#1a1a1a] border-[#3A2414]'}`}>
              <div className="flex justify-between items-center">
                <div>
                   <p className="font-bold text-[#E7D3B1]">{item.name}</p>
                   <p className="text-xs text-[#A3A3A3]">{item.unit}</p>
                </div>
                <div className="text-right">
                   <p className={`text-lg font-black ${isLow ? 'text-red-400' : 'text-[#FF7A00]'}`}>
                     {item.quantity} {item.unit}
                   </p>
                   {isLow && <p className="text-[10px] text-red-400 font-bold uppercase tracking-tighter">Estoque Baixo!</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showAdd && (
        <Dialog open onOpenChange={() => setShowAdd(false)}>
          <DialogContent className="bg-[#121212] border-[#3A2414] text-[#E7D3B1]">
             <DialogHeader><DialogTitle>Novo Insumo</DialogTitle></DialogHeader>
             <form className="space-y-4" onSubmit={(e) => {
               e.preventDefault();
               const fd = new FormData(e.currentTarget);
               saveStockItem({
                 data: {
                   name: fd.get('name') as string,
                   unit: fd.get('unit') as string,
                   quantity: Number(fd.get('qty')),
                   min_quantity: Number(fd.get('min')),
                 }
               }).then(() => {
                 qc.invalidateQueries({ queryKey: ["admin", "stock"] });
                 toast.success("Insumo cadastrado");
                 setShowAdd(false);
               });
             }}>
               <div className="space-y-2">
                 <Label>Nome do Insumo</Label>
                 <Input name="name" placeholder="Ex: Pão de Hambúrguer" required className="bg-[#1a1a1a] border-[#3A2414]" />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label>Quantidade Atual</Label>
                   <Input name="qty" type="number" required className="bg-[#1a1a1a] border-[#3A2414]" />
                 </div>
                 <div className="space-y-2">
                   <Label>Unidade</Label>
                   <Input name="unit" placeholder="un, kg, g, l" required className="bg-[#1a1a1a] border-[#3A2414]" />
                 </div>
               </div>
               <div className="space-y-2">
                 <Label>Estoque Mínimo (Alerta)</Label>
                 <Input name="min" type="number" defaultValue="10" required className="bg-[#1a1a1a] border-[#3A2414]" />
               </div>
               <Button type="submit" className="w-full bg-[#FF7A00] text-black font-bold">Salvar Insumo</Button>
             </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}


function OrdersTable({ orders, onSelect, setPaymentOrder }: any) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-[#A3A3A3] border-b border-[#3A2414]/40">
            <th className="pb-2 font-normal">Fonte</th>
            <th className="pb-2 font-normal">Cliente</th>
            <th className="pb-2 font-normal">Status</th>
            <th className="pb-2 font-normal text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#3A2414]/20">
          {orders.map((order: any) => {
            const isMesa = order.source === 'mesa';
            const isPaid = isMesa
              ? order.status_comanda === 'paga' || order.status === 'completed'
              : order.status !== 'pending' && order.status !== 'cancelled';
            const isOpenAccount = !isPaid && order.status !== 'cancelled';
            return (
            <tr key={order.id} className="group hover:bg-[#1a1a1a]/40 transition-colors cursor-pointer" onClick={() => onSelect(order)}>
              <td className="py-3">
                <span className="text-[10px] font-bold uppercase text-[#D4A15A]">{order.source}</span>
              </td>
              <td className="py-3 font-medium">{order.customer_name || "—"}</td>
              <td className="py-3">
                <div className="flex flex-col gap-1">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase w-fit ${
                    order.status === 'completed' ? 'bg-emerald-500 text-[#121212]' : 'bg-[#3A2414] text-[#E7D3B1]'
                  }`}>
                    {order.status}
                  </span>
                  {isOpenAccount && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-yellow-500/15 text-yellow-400 border border-yellow-500/40 w-fit">
                      ● Conta Aberta
                    </span>
                  )}
                </div>
              </td>
              <td className="py-3 text-right font-bold">R$ {Number(order.total_amount).toFixed(2)}</td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OrdersList({ orders, view, historyPage, pageSize, setHistoryPage, onSelectOrder, menuItems, cashRegister }: any) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todaysOrders = orders.filter((o: any) => new Date(o.created_at) >= startOfToday);
  
  const shiftStart = cashRegister && cashRegister.status === "open" 
    ? new Date(cashRegister.opening_time || cashRegister.created_at) 
    : null;
    
  const todayList = shiftStart
    ? todaysOrders.filter((o: any) => new Date(o.created_at) >= shiftStart)
    : todaysOrders;

  const list = view === "today" ? todayList : orders;
  const pagedList = view === "all"
    ? list.slice((historyPage - 1) * pageSize, historyPage * pageSize)
    : list;

  return (
    <div className="grid gap-4">
      {pagedList.map((order: any) => {
        const isMesa = order.source === 'mesa';
        const isPaid = isMesa
          ? order.status_comanda === 'paga' || order.status === 'completed'
          : order.status !== 'pending' && order.status !== 'cancelled';
        const isOpenAccount = !isPaid && order.status !== 'cancelled';
        return (
        <div 
          key={order.id} 
          className="bg-[#121212] border border-[#3A2414] rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-[#FF7A00]/50 transition-all cursor-pointer"
          onClick={() => onSelectOrder(order)}
        >
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              order.source === 'mesa' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'
            }`}>
               {order.source === 'mesa' ? <Monitor className="w-6 h-6" /> : <ShoppingBag className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="font-bold text-lg">{order.customer_name || "Cliente"}</h3>
              <div className="flex gap-3 text-xs text-[#A3A3A3]">
                <span>{new Date(order.created_at).toLocaleTimeString()}</span>
                {order.table_number && <span>• Mesa: {order.table_number}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs text-[#A3A3A3] uppercase tracking-widest mb-1">Total</p>
              <p className="font-black text-xl text-[#FF7A00]">R$ {Number(order.total_amount).toFixed(2)}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${
                order.status === 'completed' ? 'bg-emerald-500 text-[#121212]' : 'bg-[#1a1a1a] border border-[#3A2414] text-[#E7D3B1]'
              }`}>
                {order.status}
              </div>
              {isOpenAccount ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-yellow-500/15 text-yellow-400 border border-yellow-500/40">
                  ● Conta Aberta
                </span>
              ) : isPaid ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  ✓ Pago
                </span>
              ) : null}
            </div>
          </div>
        </div>
        );
      })}
    </div>
  );
}


function PrintTicket({ order, sector, menuItems }: { order: any, sector?: string, menuItems: any[] }) {
  const filteredItems = order?.order_items ?? [];

  const shortId = String(order.id).slice(0, 8).toUpperCase();
  const created = new Date(order.created_at).toLocaleString("pt-BR");
  const isDelivery = order.source === "delivery";
  const isPickup = order.source === "online";
  const isMesa = order.source === "mesa";
  const tipoLabel = isDelivery
    ? "DELIVERY"
    : isPickup
      ? "RETIRADA"
      : isMesa
        ? `MESA ${order.table_number ?? ""}`.trim()
        : String(order.source ?? "").toUpperCase();
  const paymentLabel: Record<string, string> = {
    pix: "PIX",
    card: "CARTÃO",
    cash: "DINHEIRO",
  };
  const subtotal = (filteredItems || []).reduce((sum: number, item: any) => {
    const extrasTotal = Array.isArray(item.extras)
      ? item.extras.reduce(
          (extraSum: number, extra: any) => extraSum + Number(extra.price ?? 0) * Number(extra.qty ?? 0),
          0,
        )
      : 0;
    return sum + (Number(item.unit_price) + extrasTotal) * Number(item.quantity);
  }, 0);
  const deliveryFee = Number(order.delivery_fee ?? 0);
  const parsedAddress = String(order.delivery_address || "").split("—");
  const addressLine = parsedAddress[0]?.trim() || order.delivery_address || "—";
  const neighborhoodLine = parsedAddress[1]?.trim() || null;

  return (
    <div
      id="cupom-impressao"
      className="bg-white text-black print:block mx-auto my-8 md:my-12 shadow-2xl rounded-sm border border-neutral-200"
      style={{
        width: "80mm",
        maxWidth: "450px",
        color: "#000",
        background: "#fff",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: "12px",
        lineHeight: 1.35,
        padding: "20px",
      }}
    >
      <div style={{ textAlign: "center", paddingTop: "4px", paddingBottom: "10px" }}>
        <img
          src={oxenteLogo}
          alt="CISSABURGER"
          style={{
            width: "120px",
            maxWidth: "100%",
            height: "auto",
            display: "block",
            margin: "0 auto",
          }}
        />
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0 12px" }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "14px" }}>
        <div style={{ width: "14px", borderTop: "1px solid #000" }} />
        <Star size={10} fill="#000" strokeWidth={0} />
        <div
          style={{
            background: "#000",
            color: "#fff",
            borderRadius: "999px",
            padding: "5px 12px",
            fontWeight: 700,
            fontSize: "9px",
            letterSpacing: "0.05em",
            whiteSpace: "nowrap",
            textTransform: "uppercase",
          }}
        >
          SABOR QUE VEM DO NORDESTE, SIÓ!
        </div>
        <Star size={10} fill="#000" strokeWidth={0} />
        <div style={{ width: "14px", borderTop: "1px solid #000" }} />
      </div>

      {sector && (
        <div style={{ textAlign: "center", fontWeight: 900, fontSize: "13px", letterSpacing: "0.18em", borderTop: "2px solid #000", borderBottom: "2px solid #000", padding: "4px 0", margin: "0 0 10px" }}>
          SETOR: {sector.toUpperCase()}
        </div>
      )}

      <div style={{ padding: "2px 2px 12px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {[
          { Icon: Receipt, label: "PEDIDO:", value: shortId },
          { Icon: Calendar, label: "DATA:", value: created },
          { Icon: Monitor, label: "TIPO DE VENDA:", value: tipoLabel },
          { Icon: User, label: "CLIENTE:", value: order.customer_name || "—" },
          ...(order.customer_whatsapp
            ? [{ Icon: Smartphone, label: "WHATSAPP:", value: String(order.customer_whatsapp) }]
            : []),
        ].map(({ Icon, label, value }) => (
          <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <Icon size={14} strokeWidth={1.8} style={{ flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontSize: "11px", letterSpacing: "0.03em", width: "88px", flexShrink: 0 }}>
              {label}
            </span>
            <span style={{ fontSize: "11px", fontWeight: label === "PEDIDO:" ? 700 : 500 }}>{value}</span>
          </div>
        ))}

        {isDelivery && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <MapPin size={14} strokeWidth={1.8} style={{ flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontSize: "11px", letterSpacing: "0.03em", width: "88px", flexShrink: 0 }}>
              ENDEREÇO:
            </span>
            <div style={{ fontSize: "11px", flex: 1 }}>
              <div>{addressLine}</div>
              {neighborhoodLine && <div>{neighborhoodLine}</div>}
              {order.delivery_reference && (
                <div>
                  <span style={{ fontWeight: 700 }}>Ref:</span> {order.delivery_reference}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "4px 0 10px" }} />

      <div
        style={{
          background: "#000",
          color: "#fff",
          textAlign: "center",
          padding: "6px 0",
          fontWeight: 700,
          fontSize: "11px",
          letterSpacing: "0.12em",
          marginBottom: "8px",
          borderRadius: "6px",
        }}
      >
        ITENS DO PEDIDO
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "4px 0", fontWeight: 400, fontSize: "8.5px", letterSpacing: "0.05em" }}>QTD</th>
            <th style={{ textAlign: "left", padding: "4px 0", fontWeight: 400, fontSize: "8.5px", letterSpacing: "0.05em" }}>DESCRIÇÃO</th>
            <th style={{ textAlign: "right", padding: "4px 0", fontWeight: 400, fontSize: "8.5px", letterSpacing: "0.05em" }}>VALOR UNIT.</th>
            <th style={{ textAlign: "right", padding: "4px 0", fontWeight: 400, fontSize: "8.5px", letterSpacing: "0.05em" }}>VALOR TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {(filteredItems ?? []).map((it: any, i: number) => {
            const unit = Number(it.unit_price);
            const qty = Number(it.quantity);
            const extrasTotal = Array.isArray(it.extras)
              ? it.extras.reduce(
                  (extraSum: number, extra: any) => extraSum + Number(extra.price ?? 0) * Number(extra.qty ?? 0),
                  0,
                )
              : 0;
            const lineTotal = (unit + extrasTotal) * qty;
            const menuItem = menuItems.find((m: any) => m.id === it.menu_item_id);
            const itemName = it.menu_item_name || menuItem?.name || "Produto";
            return (
              <Fragment key={`item-group-${i}`}>
                <tr style={{ borderTop: i === 0 ? "1px dashed #000" : "none" }}>
                  <td style={{ padding: "6px 0", verticalAlign: "top", fontSize: "11px" }}>{qty}x</td>
                  <td style={{ padding: "6px 4px", verticalAlign: "top", fontSize: "11px" }}>
                    <div style={{ fontWeight: 700 }}>{itemName}</div>
                  </td>
                  <td style={{ padding: "6px 0", verticalAlign: "top", textAlign: "right", whiteSpace: "nowrap", fontSize: "11px" }}>
                    R$ {unit.toFixed(2).replace(".", ",")}
                  </td>
                  <td style={{ padding: "6px 0", verticalAlign: "top", textAlign: "right", whiteSpace: "nowrap", fontSize: "11px" }}>
                    R$ {lineTotal.toFixed(2).replace(".", ",")}
                  </td>
                </tr>
                {it.extras?.map((e: any, extraIndex: number) => (
                  <tr key={`extra-${i}-${extraIndex}`}>
                    <td style={{ padding: "0 0 2px", verticalAlign: "top", fontSize: "9.5px" }} />
                    <td style={{ padding: "0 4px 2px 14px", verticalAlign: "top", fontSize: "9.5px", color: "#333" }}>
                      + {e.qty}x {e.name}
                    </td>
                    <td style={{ padding: "0 0 2px", verticalAlign: "top", textAlign: "right", whiteSpace: "nowrap", fontSize: "9.5px", color: "#333" }}>
                      R$ {Number(e.price ?? 0).toFixed(2).replace(".", ",")}
                    </td>
                    <td style={{ padding: "0 0 2px", verticalAlign: "top", textAlign: "right", whiteSpace: "nowrap", fontSize: "9.5px", color: "#333" }} />
                  </tr>
                ))}
                {it.notes && (
                  <tr>
                    <td style={{ padding: "0 0 2px", verticalAlign: "top", fontSize: "9.5px" }} />
                    <td colSpan={3} style={{ padding: "0 4px 2px 14px", verticalAlign: "top", fontSize: "9.5px", fontStyle: "italic", color: "#333" }}>
                      Obs: {it.notes}
                    </td>
                  </tr>
                )}
                <tr>
                  <td colSpan={4} style={{ padding: 0, borderBottom: "1px dashed #000", height: "4px" }} />
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {!sector && (() => {
        return (
          <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "3px" }}>
            <div style={{ borderTop: "1px dashed #000", margin: "6px 0 8px" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
              <span>Subtotal dos Itens</span>
              <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
            </div>
            {isDelivery && deliveryFee > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                <span>Taxa de entrega</span>
                <span>R$ {deliveryFee.toFixed(2).replace(".", ",")}</span>
              </div>
            )}
          </div>
        );
      })()}

      {!sector && (
        <>
          <div
            style={{
              border: "2px solid #000",
              borderRadius: "10px",
              padding: "10px 12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              margin: "14px 0 12px",
            }}
          >
            <span style={{ fontWeight: 700, fontSize: "15px", letterSpacing: "0.05em" }}>TOTAL</span>
            <span style={{ fontWeight: 900, fontSize: "18px" }}>
              R$ {Number(order.total_amount).toFixed(2).replace(".", ",")}
            </span>
          </div>

          {order.payment_method && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "4px 4px 12px" }}>
              <CreditCard size={15} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: "11px", letterSpacing: "0.05em" }}>FORMA DE PAGAMENTO</div>
                <div style={{ fontSize: "13px", marginTop: "3px", fontWeight: 600 }}>
                  {paymentLabel[order.payment_method] ?? order.payment_method}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

      <div style={{ textAlign: "center", padding: "8px 0 10px" }}>
        <p style={{ fontWeight: 700, fontSize: "12px", letterSpacing: "0.08em" }}>
          OBRIGADO PELA PREFERÊNCIA!
        </p>
        <div style={{ display: "flex", justifyContent: "center", marginTop: "10px" }}>
          <Star size={11} fill="#000" strokeWidth={0} />
        </div>
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "0 0 10px" }} />

      <div
        style={{
          background: "#000",
          color: "#fff",
          borderRadius: "6px",
          padding: "8px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          fontWeight: 600,
          fontSize: "12px",
        }}
      >
        <Globe size={13} strokeWidth={1.8} />
        cissaburguer.com.br
      </div>
    </div>
  );
}

function PrintLabel({ order }: { order: any }) {
  const shortId = String(order.id).slice(0, 8).toUpperCase();
  const created = new Date(order.created_at).toLocaleString("pt-BR");
  const isPickup = order.source === "online";
  const isDelivery = order.source === "delivery";
  const isMesa = order.source === "mesa";

  let modalidade = "";
  if (isDelivery) modalidade = "ENTREGA";
  else if (isPickup) modalidade = "RETIRADA NA LOJA";
  else if (isMesa) modalidade = `MESA ${order.table_number || ""}`;

  return (
    <div
      id="etiqueta-impressao"
      className="bg-white text-black w-[80mm] font-sans text-[12px] leading-tight"
    >
      {/* Cabeçalho com Logo (P&B de alto contraste — sem filtros) */}
      <div
        style={{
          textAlign: "center",
          padding: "16px 0",
          margin: "0 16px",
          borderBottom: "2px dashed #000",
        }}
      >
        <img
          src={oxenteLogo}
          alt="CISSABURGER"
          style={{
            width: "120px",
            maxWidth: "100%",
            height: "auto",
            display: "block",
            margin: "0 auto",
          }}
        />
      </div>

      {/* Container da Etiqueta */}
      <div className="m-2 p-4 border-2 border-black border-dashed rounded-xl space-y-3">
        {/* DESTINATÁRIO */}
        <div className="space-y-1">
          <p className="text-[10px] uppercase font-light tracking-widest text-neutral-600">
            DESTINATÁRIO
          </p>
          <p className="text-lg font-black uppercase leading-none">
            {order.customer_name || "CLIENTE NÃO INFORMADO"}
          </p>
        </div>

        {/* Informações de Contato */}
        <div className="space-y-1 pt-1">
          <div className="flex gap-1">
            <span className="font-bold text-[10px] uppercase">TELEFONE:</span>
            <span className="text-[11px] font-mono">{order.customer_phone || "—"}</span>
          </div>
          
          <div className="flex flex-col gap-0.5 pt-1">
            <span className="font-bold text-[10px] uppercase">ENDEREÇO/MODALIDADE:</span>
            <div className={`p-1 rounded ${isPickup ? 'bg-neutral-100 font-bold border border-black/10' : ''}`}>
              <p className="text-[11px] leading-snug">
                {isDelivery ? order.delivery_address : modalidade}
              </p>
            </div>
          </div>
        </div>

        {/* Destaque do Pedido */}
        <div className="pt-4 flex justify-between items-end border-t border-black/10">
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase font-bold">Pedido</p>
            <p className="font-mono text-sm">#{shortId}</p>
          </div>
          <div className="text-right space-y-0.5">
            <p className="text-[9px] text-neutral-500 font-mono">{created}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomersTab({ qc }: { qc: any }) {
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const { data: customers, isLoading } = useQuery({
    queryKey: ["admin", "customers"],
    queryFn: () => listCustomers(),
  });

  const saveMut = useMutation({
    mutationFn: (v: any) => saveCustomer({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "customers"] });
      toast.success("Cliente salvo!");
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (v: { id: string; password: string }) => deleteCustomer(v.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "customers"] });
      toast.success("Cliente excluído.");
      setDeleting(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao excluir."),
  });

  if (isLoading) return <div className="p-8 text-center text-[#A3A3A3]">Carregando clientes...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-[#E7D3B1]">Gestão de Clientes</h1>
        <Button onClick={() => setEditing({})} className="bg-[#FF7A00] text-black font-bold">
          <UserPlus className="w-4 h-4 mr-2" /> Novo Cliente
        </Button>
      </div>

      <div className="grid gap-3">
        {customers?.map((c: any) => (
          <div key={c.id} className="bg-[#121212] border border-[#3A2414] rounded-xl p-4 flex items-center justify-between group hover:border-[#FF7A00]/40 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#1a1a1a] flex items-center justify-center text-[#FF7A00] font-bold">
                {c.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-[#E7D3B1]">{c.name}</h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#A3A3A3]">
                  {c.whatsapp && <span className="flex items-center gap-1"><Smartphone className="w-3 h-3" /> {c.whatsapp}</span>}
                  {c.cpf && <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> CPF: {c.cpf}</span>}
                  {c.birth_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Nasc: {new Date(c.birth_date).toLocaleDateString('pt-BR')}</span>}
                  <span className={`flex items-center gap-1 ${c.is_active ? 'text-emerald-400' : 'text-red-400'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${c.is_active ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    {c.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => setEditing(c)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setDeleting(c)}
                className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <CustomerDialog 
          customer={editing} 
          onClose={() => setEditing(null)} 
          onSave={(data: any) => saveMut.mutate(data)}
          isSaving={saveMut.isPending}
        />
      )}
      {deleting && (
        <DeleteCustomerDialog
          customer={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={(password: string) => deleteMut.mutate({ id: deleting.id, password })}
          isDeleting={deleteMut.isPending}
        />
      )}
    </div>
  );
}

function DeleteCustomerDialog({ customer, onClose, onConfirm, isDeleting }: any) {
  const [password, setPassword] = useState("");
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#121212] border-[#3A2414] text-[#E7D3B1] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-500 flex items-center gap-2">
            <Trash2 className="w-5 h-5" /> Confirmar Exclusão de Cliente
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-[#A3A3A3]">
            <span className="text-red-400 font-bold">Atenção:</span> Esta ação é irreversível. Para confirmar a exclusão do cliente{" "}
            <span className="font-bold text-[#E7D3B1]">{customer.name}</span>, insira a senha do administrador:
          </p>
          <div className="space-y-2">
            <Label htmlFor="admin-pass">Senha do Administrador</Label>
            <Input
              id="admin-pass"
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && password) onConfirm(password); }}
              className="bg-[#1a1a1a] border-[#3A2414]"
              placeholder="••••••••"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isDeleting}>Cancelar</Button>
          <Button
            onClick={() => onConfirm(password)}
            disabled={!password || isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white font-bold"
          >
            {isDeleting ? "Excluindo..." : "Confirmar Exclusão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomerDialog({ customer, onClose, onSave, isSaving }: any) {
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["admin", "customer-history", customer.id],
    queryFn: () => getCustomerHistory(customer.id),
    enabled: !!customer.id,
  });

  const [formData, setFormData] = useState({
    id: customer.id,
    name: customer.name || "",
    whatsapp: customer.whatsapp || "",
    cpf: customer.cpf || "",
    birth_date: customer.birth_date || "",
    is_active: customer.is_active !== undefined ? customer.is_active : true,
    allow_whatsapp_promo: customer.allow_whatsapp_promo || false,
    notes: customer.notes || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#121212] border-[#3A2414] text-[#E7D3B1] max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-[#FF7A00]" />
            {customer.id ? "Editar Cliente" : "Novo Cliente"}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="dados" className="w-full">
          <TabsList className="bg-[#1a1a1a] border-[#3A2414] w-full justify-start h-12 p-1 gap-1">
            <TabsTrigger value="dados" className="data-[state=active]:bg-[#FF7A00] data-[state=active]:text-black h-full flex items-center gap-2 px-4">
              <User className="w-4 h-4" /> Dados Pessoais
            </TabsTrigger>
            <TabsTrigger value="historico" className="data-[state=active]:bg-[#FF7A00] data-[state=active]:text-black h-full flex items-center gap-2 px-4">
              <History className="w-4 h-4" /> Histórico de Pedidos
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit}>
            <TabsContent value="dados" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nome Completo *</Label>
                <Input 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="Ex: João da Silva"
                  required 
                  className="bg-[#1a1a1a] border-[#3A2414]" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input 
                    value={formData.whatsapp} 
                    onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                    placeholder="(00) 00000-0000" 
                    className="bg-[#1a1a1a] border-[#3A2414]" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input 
                    value={formData.cpf} 
                    onChange={e => setFormData({...formData, cpf: e.target.value})}
                    placeholder="000.000.000-00" 
                    className="bg-[#1a1a1a] border-[#3A2414]" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de Nascimento</Label>
                  <Input 
                    type="date"
                    value={formData.birth_date} 
                    onChange={e => setFormData({...formData, birth_date: e.target.value})}
                    className="bg-[#1a1a1a] border-[#3A2414]" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status da Conta</Label>
                  <div className="flex items-center space-x-2 bg-[#1a1a1a] border border-[#3A2414] h-10 px-3 rounded-md">
                    <Switch 
                      checked={formData.is_active} 
                      onCheckedChange={checked => setFormData({...formData, is_active: checked})} 
                    />
                    <span className="text-sm">{formData.is_active ? "Ativo (aparece no PDV)" : "Inativo"}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 bg-[#1a1a1a] border border-[#3A2414] p-3 rounded-md">
                <Checkbox 
                  id="promo"
                  checked={formData.allow_whatsapp_promo} 
                  onCheckedChange={checked => setFormData({...formData, allow_whatsapp_promo: !!checked})} 
                />
                <Label htmlFor="promo" className="text-sm font-normal cursor-pointer">
                  Autorizo receber promoções via WhatsApp
                </Label>
              </div>
            </TabsContent>

            <TabsContent value="historico" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Últimos Pedidos</Label>
                <div className="bg-[#1a1a1a] border border-[#3A2414] rounded-md overflow-hidden">
                  {historyLoading ? (
                    <div className="p-4 text-center text-xs text-[#A3A3A3]">Carregando histórico...</div>
                  ) : !history || history.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#A3A3A3] italic">Nenhum pedido encontrado.</div>
                  ) : (
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#2a2a2a] text-[#A3A3A3] uppercase tracking-wider">
                        <tr>
                          <th className="px-3 py-2">Data</th>
                          <th className="px-3 py-2">Valor</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#3A2414]">
                        {history.map((h: any) => (
                          <tr key={h.id}>
                            <td className="px-3 py-2">{new Date(h.created_at).toLocaleDateString('pt-BR')}</td>
                            <td className="px-3 py-2 font-bold text-[#FF7A00]">
                              {h.total_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                                h.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-yellow-500/10 text-yellow-400'
                              }`}>
                                {h.status === 'completed' ? 'Finalizado' : 'Pendente'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </TabsContent>

            <DialogFooter className="mt-6 gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={onClose} className="text-[#A3A3A3] hover:text-white">
                Cancelar
              </Button>
              <Button type="submit" className="bg-[#FF7A00] text-black font-bold px-8" disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar Cliente"}
              </Button>
            </DialogFooter>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function POSTab({ items, categories, qc, onNewOrder, onManageCustomers }: any) {

  const [cart, setCart] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: customers } = useQuery({
    queryKey: ["admin", "customers"],
    queryFn: () => listCustomers(),
  });

  const { data: loyaltyPoints } = useQuery({
    queryKey: ["admin", "loyalty"],
    queryFn: () => listLoyaltyPoints(),
  });

  const filteredCustomers = customers?.filter((c: any) => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.whatsapp?.includes(searchTerm) || 
    c.cpf?.includes(searchTerm)
  ) || [];

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const total = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

  const createMut = useMutation({
    mutationFn: (v: any) => createAdminOrder(v),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["admin", "all"] });
      toast.success("Conta aberta! Finalize o pagamento quando o cliente quiser pagar.");
      
      const lp = loyaltyPoints?.find((p: any) => p.customer_phone === selectedCustomer?.whatsapp);
      const points = lp?.points || 0;
      if (points + 1 >= 10) {
        toast("🎁 CLIENTE ATINGIU 10 PEDIDOS!", {
          description: "Ofereça o brinde de fidelidade para " + selectedCustomer.name,
          duration: 10000,
        });
      }
      onNewOrder();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const finishOrder = () => {
    if (cart.length === 0) return;
    if (!selectedCustomer) {
      toast.error("Selecione um cliente para vincular o pedido.");
      setShowCustomerSearch(true);
      return;
    }

    createMut.mutate({
      customer_id: selectedCustomer.id,
      customer_name: selectedCustomer.name,
      customer_phone: selectedCustomer.whatsapp,
      total_amount: total,
      items: cart.map(i => ({
        menu_item_id: i.id,
        menu_item_name: i.name,
        quantity: i.quantity,
        unit_price: i.price,
      }))
    });
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
      <div className="lg:col-span-2 space-y-4 overflow-y-auto pr-2 scrollbar-hide">
        <div className="sticky top-0 bg-[#0d0907] z-10 py-2">
           <Input 
             placeholder="Buscar produto..." 
             className="bg-[#1a1a1a] border-[#3A2414]" 
             onChange={(e) => setSearchTerm(e.target.value)}
           />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {items.filter((it: any) => it.is_available).map((it: any) => (
            <button 
              key={it.id} 
              onClick={() => addToCart(it)}
              className="bg-[#121212] border border-[#3A2414] rounded-xl p-3 text-left hover:border-[#FF7A00]/50 transition-all flex flex-col"
            >
              <img src={it.image_url} className="w-full h-24 object-cover rounded-lg mb-2" />
              <h4 className="font-bold text-sm truncate">{it.name}</h4>
              <p className="text-xs text-[#FF7A00] font-bold mt-auto">R$ {it.price.toFixed(2)}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#121212] border border-[#3A2414] rounded-2xl flex flex-col">
        <div className="p-4 border-b border-[#3A2414]">
          <h3 className="font-bold text-[#E7D3B1] flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-[#FF7A00]" /> Carrinho PDV
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div 
            onClick={() => setShowCustomerSearch(true)}
            className="p-3 bg-[#1a1a1a] border border-[#3A2414] rounded-xl cursor-pointer hover:border-[#D4A15A]/50 transition-all"
          >
            {selectedCustomer ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-[#A3A3A3] uppercase">Cliente Selecionado</p>
                  <p className="font-bold text-[#D4A15A]">{selectedCustomer.name}</p>
                </div>
                <Users className="w-4 h-4 text-[#D4A15A]" />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[#A3A3A3] text-sm py-1">
                <UserPlus className="w-4 h-4" /> Selecionar Cliente
              </div>
            )}
          </div>

          <div className="space-y-2 mt-4">
            {cart.map(item => (
              <div key={item.id} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-[#FF7A00] font-bold">{item.quantity}x</span>
                  <span className="truncate max-w-[120px]">{item.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold">R$ {(item.price * item.quantity).toFixed(2)}</span>
                  <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {cart.length === 0 && <p className="text-center py-12 text-[#5a5a5a] text-xs italic">Nenhum item selecionado</p>}
          </div>
        </div>

        <div className="p-4 bg-[#1a1a1a] border-t border-[#3A2414] space-y-4 rounded-b-2xl">
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-[10px] text-yellow-400/90 leading-relaxed">
            <strong className="uppercase tracking-wider">Conta aberta:</strong> o pagamento será cobrado depois, no menu Pedidos → Finalizar Pagamento.
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm font-bold">Total</span>
            <span className="text-xl font-black text-[#FF7A00]">R$ {total.toFixed(2)}</span>
          </div>
          
          <Button 
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12"
            disabled={cart.length === 0 || createMut.isPending}
            onClick={finishOrder}
          >
            {createMut.isPending ? "Processando..." : "Abrir Conta (Aguardar Pagamento)"}
          </Button>
        </div>
      </div>

      {showCustomerSearch && (
        <Dialog open onOpenChange={() => setShowCustomerSearch(false)}>
          <DialogContent className="bg-[#121212] border-[#3A2414] text-[#E7D3B1]">
            <DialogHeader><DialogTitle>Selecionar Cliente</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input 
                placeholder="Buscar por nome, whatsapp ou CPF..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-[#1a1a1a] border-[#3A2414]"
                autoFocus
              />
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {filteredCustomers.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCustomer(c); setShowCustomerSearch(false); }}
                    className="w-full p-3 bg-[#1a1a1a] hover:bg-[#222] border border-[#3A2414] rounded-xl text-left flex justify-between items-center group"
                  >
                    <div>
                      <p className="font-bold group-hover:text-[#FF7A00] transition-colors">{c.name}</p>
                      <p className="text-xs text-[#A3A3A3]">{c.whatsapp || "Sem WhatsApp"}</p>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-[#D4A15A] opacity-0 group-hover:opacity-100 transition-all" />
                  </button>
                ))}
                {filteredCustomers.length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-sm text-[#A3A3A3] mb-4">Nenhum cliente encontrado.</p>
                    <Button 
                      variant="outline" 
                      className="border-[#FF7A00] text-[#FF7A00]"
                      onClick={() => { setShowCustomerSearch(false); onManageCustomers(); }}
                    >
                      Cadastrar Novo Cliente
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
