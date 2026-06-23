import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Package, Clock, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSavedOrders, type SavedOrder } from "@/lib/order-history";
import { formatBRL } from "@/lib/cart-store";

export const Route = createFileRoute("/meus-pedidos")({
  head: () => ({
    meta: [
      { title: "Meus Pedidos — CISSABURGER" },
      { name: "description", content: "Acompanhe seus pedidos." },
    ],
  }),
  component: MeusPedidosPage,
});

type OrderRow = {
  id: string;
  status: string | null;
  delivery_status: string | null;
  total_amount: number | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Recebido",
  received: "Recebido",
  preparing: "Em preparo",
  in_preparation: "Em preparo",
  ready: "Pronto",
  out_for_delivery: "Saiu para entrega",
  saiu_para_entrega: "Saiu para entrega",
  em_entrega: "Saiu para entrega",
  delivered: "Entregue",
  entregue: "Entregue",
  completed: "Concluído",
  cancelled: "Cancelado",
  cancelado: "Cancelado",
};

const ACTIVE_STATUSES = new Set([
  "pending", "received", "preparing", "in_preparation", "ready",
  "out_for_delivery", "saiu_para_entrega", "em_entrega",
]);

function statusLabel(o: OrderRow): string {
  const key = (o.delivery_status || o.status || "").toLowerCase();
  return STATUS_LABEL[key] || key || "Pendente";
}

function isActive(o: OrderRow): boolean {
  const key = (o.delivery_status || o.status || "").toLowerCase();
  return ACTIVE_STATUSES.has(key);
}

function MeusPedidosPage() {
  const [saved, setSaved] = useState<SavedOrder[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const list = getSavedOrders();
    setSaved(list);
    if (list.length === 0) {
      setLoading(false);
      return;
    }
    const ids = list.map((o) => o.id);
    void (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, status, delivery_status, total_amount, created_at")
        .in("id", ids)
        .order("created_at", { ascending: false });
      setOrders((data as OrderRow[]) || []);
      setLoading(false);
    })();
  }, []);

  const active = orders.find(isActive);
  const past = orders.filter((o) => !isActive(o));

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-32">
      <header className="sticky top-0 z-30 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#1f1f1f]">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/" className="p-2 -ml-2 rounded-lg hover:bg-white/5">
            <ArrowLeft className="w-5 h-5 text-[#D4A15A]" />
          </Link>
          <h1 className="text-lg font-black tracking-tight">Meus Pedidos</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <p className="text-center text-sm text-[#A3A3A3]">Carregando...</p>
        ) : saved.length === 0 ? (
          <div className="bg-[#121212] border border-[#3A2414] rounded-2xl p-8 text-center">
            <Package className="w-10 h-10 text-[#FF7A00] mx-auto mb-3" />
            <p className="font-bold">Você ainda não fez pedidos</p>
            <p className="text-xs text-[#A3A3A3] mt-1">Quando pedir, eles aparecerão aqui.</p>
            <Link to="/" className="inline-block mt-5 h-11 px-6 rounded-full bg-[#FF7A00] text-black font-black text-sm leading-[44px]">
              Ver cardápio
            </Link>
          </div>
        ) : (
          <>
            {active && (
              <section>
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#D4A15A] mb-3 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" /> Pedido em andamento
                </h2>
                <div className="bg-gradient-to-br from-[#FF7A00]/15 to-[#121212] border border-[#FF7A00]/40 rounded-2xl p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[#D4A15A]">Status</p>
                      <p className="font-black text-lg text-[#FF7A00]">{statusLabel(active)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-[#A3A3A3]">Total</p>
                      <p className="font-black">{formatBRL(Number(active.total_amount || 0))}</p>
                    </div>
                  </div>
                  <p className="text-xs text-[#A3A3A3] mb-4">
                    {new Date(active.created_at).toLocaleString("pt-BR")}
                  </p>
                  <Link
                    to="/pedido/$id"
                    params={{ id: active.id }}
                    className="w-full h-11 rounded-full bg-[#FF7A00] text-black font-black text-sm flex items-center justify-center gap-2"
                  >
                    Acompanhar Pedido <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              </section>
            )}

            <section>
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#D4A15A] mb-3">
                Pedidos anteriores
              </h2>
              {past.length === 0 ? (
                <p className="text-sm text-[#A3A3A3]">Nenhum pedido anterior.</p>
              ) : (
                <div className="space-y-3">
                  {past.map((o) => {
                    const local = saved.find((s) => s.id === o.id);
                    const total = Number(o.total_amount ?? local?.total ?? 0);
                    return (
                      <Link
                        key={o.id}
                        to="/pedido/$id"
                        params={{ id: o.id }}
                        className="block bg-[#121212] border border-[#3A2414] rounded-2xl p-4 hover:border-[#FF7A00]/50 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-sm">{statusLabel(o)}</p>
                            <p className="text-xs text-[#A3A3A3] mt-1">
                              {new Date(o.created_at).toLocaleString("pt-BR")}
                            </p>
                          </div>
                          <p className="font-black text-sm text-[#FF7A00]">{formatBRL(total)}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
