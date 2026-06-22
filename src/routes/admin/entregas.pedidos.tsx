import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, Bike, Flame, Loader2, Truck, CheckCircle2, UserPlus, RefreshCw,
  ChefHat, PackageCheck, Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { checkIsAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/entregas/pedidos")({
  component: PedidosEntregaPage,
});

type DeliveryStatus =
  | "aguardando_entregador" | "em_entrega" | "entregue"
  | "pedido_recebido" | "em_preparo" | "pronto_para_entrega" | "saiu_para_entrega";

type OrderRow = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  delivery_reference: string | null;
  total_amount: number;
  delivery_fee: number;
  status: string;
  source: string;
  created_at: string;
  delivery_driver_id: string | null;
  delivery_status: DeliveryStatus | null;
};

type Driver = { id: string; name: string; active: boolean };

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  aguardando_entregador: "Aguardando Entregador",
  em_entrega: "Em Entrega",
  entregue: "Entregue",
  pedido_recebido: "Pedido Recebido",
  em_preparo: "Em Preparo",
  pronto_para_entrega: "Pronto para Entrega",
  saiu_para_entrega: "Saiu para Entrega",
};

function statusOf(o: OrderRow): DeliveryStatus {
  if (o.delivery_status) return o.delivery_status;
  return o.delivery_driver_id ? "saiu_para_entrega" : "pedido_recebido";
}

function PedidosEntregaPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [authChecked, setAuthChecked] = useState(false);
  const [filter, setFilter] = useState<"all" | DeliveryStatus>("all");

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

  const { data: drivers = [] } = useQuery({
    queryKey: ["delivery_drivers_active"],
    enabled: authChecked,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_drivers" as any)
        .select("id, name, active")
        .eq("active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Driver[];
    },
  });

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ["delivery_orders"],
    enabled: authChecked,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, customer_name, customer_phone, delivery_address, delivery_reference, total_amount, delivery_fee, status, source, created_at, delivery_driver_id, delivery_status",
        )
        .not("delivery_address", "is", null)
        .not("status", "in", "(cancelled,completed)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as OrderRow[];
    },
  });

  // Realtime: any change on orders re-fetches the delivery list immediately.
  useEffect(() => {
    if (!authChecked) return;
    const ch = supabase
      .channel("admin-delivery-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          qc.invalidateQueries({ queryKey: ["delivery_orders"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [authChecked, qc]);

  const filtered = orders.filter((o) => filter === "all" || statusOf(o) === filter);

  const driverName = (id: string | null) =>
    drivers.find((d) => d.id === id)?.name || null;

  const assignDriver = async (orderId: string, driverId: string | null) => {
    try {
      const patch: Record<string, any> = { delivery_driver_id: driverId };
      // Quando atribui, garante status base
      if (driverId) patch.delivery_status = "aguardando_entregador";
      else patch.delivery_status = null;
      const { error } = await supabase
        .from("orders")
        .update(patch as any)
        .eq("id", orderId);
      if (error) throw error;
      toast.success(driverId ? "Entregador atribuído" : "Atribuição removida");
      qc.invalidateQueries({ queryKey: ["delivery_orders"] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao atribuir");
    }
  };

  const setStatus = async (o: OrderRow, next: DeliveryStatus) => {
    if ((next === "em_entrega" || next === "saiu_para_entrega") && !o.delivery_driver_id) {
      toast.error("Atribua um entregador primeiro");
      return;
    }
    try {
      const nowIso = new Date().toISOString();
      const patch: Record<string, any> = { delivery_status: next };
      if (next === "em_entrega" || next === "saiu_para_entrega") patch.delivery_started_at = nowIso;
      if (next === "entregue") patch.delivery_completed_at = nowIso;
      if (next === "aguardando_entregador" || next === "pedido_recebido") {
        patch.delivery_started_at = null;
        patch.delivery_completed_at = null;
      }
      const { error } = await supabase
        .from("orders")
        .update(patch as any)
        .eq("id", o.id);
      if (error) throw error;
      toast.success(`Status: ${STATUS_LABEL[next]}`);
      qc.invalidateQueries({ queryKey: ["delivery_orders"] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao atualizar status");
    }
  };

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
              <Truck className="w-5 h-5 text-[#FF7A00]" />
              <h1 className="text-lg md:text-xl font-bold text-[#E7D3B1]">
                Pedidos de Entrega
              </h1>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => refetch()}
            className="text-[#D4A15A] hover:text-[#FF7A00]"
          >
            <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
          </Button>
        </div>
        <div className="max-w-6xl mx-auto px-4 md:px-8 pb-3 flex gap-2">
          <Link
            to="/admin/entregas"
            className="px-3 py-1.5 rounded-md text-xs font-semibold border border-[#3A2414] text-[#D4A15A] hover:text-[#FF7A00] hover:border-[#FF7A00]/50"
          >
            Entregadores
          </Link>
          <Link
            to="/admin/entregas/pedidos"
            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-[#FF7A00] text-black"
          >
            Pedidos de Entrega
          </Link>
          <Link
            to="/admin/entregas/relatorios"
            className="px-3 py-1.5 rounded-md text-xs font-semibold border border-[#3A2414] text-[#D4A15A] hover:text-[#FF7A00] hover:border-[#FF7A00]/50"
          >
            Relatórios
          </Link>
          <Link
            to="/admin/entregadores/mapa"
            className="px-3 py-1.5 rounded-md text-xs font-semibold border border-[#3A2414] text-[#D4A15A] hover:text-[#FF7A00] hover:border-[#FF7A00]/50"
          >
            Mapa
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-4">
        <div className="flex gap-2 flex-wrap">
          {([
            ["all", "Todos"],
            ["pedido_recebido", "Recebido"],
            ["em_preparo", "Em Preparo"],
            ["pronto_para_entrega", "Pronto"],
            ["saiu_para_entrega", "Saiu p/ Entrega"],
            ["entregue", "Entregue"],
          ] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setFilter(v as any)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                filter === v
                  ? "bg-[#FF7A00] border-[#FF7A00] text-black"
                  : "border-[#3A2414] text-[#D4A15A] hover:text-[#FF7A00]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-[#3A2414] bg-[#0d0907] overflow-hidden">
          {isLoading ? (
            <div className="p-10 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#FF7A00]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-[#A3A3A3] text-sm">
              Nenhum pedido de entrega no momento.
            </div>
          ) : (
            <div className="divide-y divide-[#3A2414]/60">
              {filtered.map((o) => {
                const st = statusOf(o);
                return (
                  <div key={o.id} className="p-4 space-y-3">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[#FF7A00]">
                            #{o.id.slice(0, 8)}
                          </span>
                          <Badge
                            className={
                              st === "entregue"
                                ? "bg-emerald-600/20 text-emerald-400 border-emerald-600/40"
                                : st === "em_entrega"
                                  ? "bg-blue-600/20 text-blue-400 border-blue-600/40"
                                  : "bg-amber-600/20 text-amber-400 border-amber-600/40"
                            }
                          >
                            {STATUS_LABEL[st]}
                          </Badge>
                          {o.delivery_driver_id && (
                            <span className="text-xs text-[#D4A15A] flex items-center gap-1">
                              <Bike className="w-3 h-3" />
                              {driverName(o.delivery_driver_id) || "Entregador"}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-[#E7D3B1]">
                          {o.customer_name || "Cliente"}
                          {o.customer_phone && (
                            <span className="text-[#A3A3A3]"> · {o.customer_phone}</span>
                          )}
                        </div>
                        {o.delivery_address && (
                          <div className="text-xs text-[#A3A3A3] mt-0.5">
                            {o.delivery_address}
                            {o.delivery_reference && ` — ${o.delivery_reference}`}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-[#E7D3B1]">
                          R$ {Number(o.total_amount).toFixed(2).replace(".", ",")}
                        </div>
                        {Number(o.delivery_fee) > 0 && (
                          <div className="text-[10px] text-[#A3A3A3]">
                            Taxa: R${" "}
                            {Number(o.delivery_fee).toFixed(2).replace(".", ",")}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-[#D4A15A]" />
                        <Select
                          value={o.delivery_driver_id || "none"}
                          onValueChange={(v) =>
                            assignDriver(o.id, v === "none" ? null : v)
                          }
                        >
                          <SelectTrigger className="h-8 w-[200px] bg-[#1a1a1a] border-[#3A2414] text-xs">
                            <SelectValue placeholder="Atribuir entregador" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0d0907] border-[#3A2414] text-[#E7D3B1]">
                            <SelectItem value="none">— Sem entregador —</SelectItem>
                            {drivers.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex-1" />

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatus(o, "em_preparo")}
                        className="h-8 border-[#3A2414] text-[#D4A15A] hover:text-[#FF7A00]"
                        title="Marcar como Em Preparo"
                      >
                        <ChefHat className="w-4 h-4 mr-1" /> Em Preparo
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatus(o, "pronto_para_entrega")}
                        className="h-8 border-[#3A2414] text-[#D4A15A] hover:text-[#FF7A00]"
                        title="Marcar como Pronto para Entrega"
                      >
                        <PackageCheck className="w-4 h-4 mr-1" /> Pronto
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setStatus(o, "saiu_para_entrega")}
                        className="bg-blue-600 hover:bg-blue-700 text-white h-8"
                        title="Marcar como Saiu para Entrega"
                      >
                        <Truck className="w-4 h-4 mr-1" /> Saiu p/ Entrega
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setStatus(o, "entregue")}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white h-8"
                        title="Marcar como Entregue"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Entregue
                      </Button>
                      {(st === "entregue" || st === "saiu_para_entrega") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setStatus(o, "pedido_recebido")}
                          className="text-[#D4A15A] hover:text-[#FF7A00] h-8"
                          title="Reabrir como Pedido Recebido"
                        >
                          <Inbox className="w-4 h-4 mr-1" /> Reabrir
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}