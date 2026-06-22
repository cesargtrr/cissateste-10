import { useEffect, useMemo, useRef, useState, memo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Utensils,
  Users,
  Trash2,
  Printer,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Banknote,
  CreditCard,
  QrCode,
  Wallet,
  LayoutGrid,
  Search,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  getTablesOverview,
  getMesaComanda,
  removeComandaItem,
  finalizeMesaPayment,
} from "@/lib/comandas.functions";
import { listCustomers } from "@/lib/admin.functions";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import { TableGridItem, TableQuickTab, ComandaItemRow } from "./ComandasTabHelpers";



const STABILITY_WINDOW_MS = 10_000;

type UIMethod = "cash" | "card" | "pix" | "voucher" | "mixed";
const UI_TO_DB: Record<UIMethod, "cash" | "card" | "pix"> = {
  cash: "cash",
  card: "card",
  pix: "pix",
  voucher: "card",
  mixed: "cash",
};

function formatBRL(n: number) {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function ComandasTab({
  onPrintReceipt,
}: {
  onPrintReceipt?: (orderIds: string[]) => void;
}) {
  const qc = useQueryClient();
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [gridOpen, setGridOpen] = useState(false);

  

  const { data: overview, isLoading } = useQuery({
    queryKey: ["comandas", "overview"],
    queryFn: () => getTablesOverview(),
    refetchInterval: 15_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("comandas-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["comandas"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => {
        qc.invalidateQueries({ queryKey: ["comandas"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "abandoned_carts" }, () => {
        qc.invalidateQueries({ queryKey: ["comandas"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  const totalTables = overview?.total_tables ?? 10;
  const occupiedMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const o of overview?.occupied ?? []) {
      const raw = String(o.table_number ?? "").trim();
      const padded = /^\d+$/.test(raw) ? raw.padStart(2, "0") : raw;
      m.set(padded, o);
    }
    return m;
  }, [overview]);

  const occupiedCount = overview?.occupied?.length ?? 0;

  const handleSelectTable = (num: string) => {
    setActiveTable(num);
    setGridOpen(false);
  };

  const TablesGrid = (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
      {Array.from({ length: totalTables }, (_, i) => {
        const num = String(i + 1).padStart(2, "0");
        const info = occupiedMap.get(num);
        const occupied = !!info;
        const isActive = activeTable === num;
        return (
          <TableGridItem
            key={num}
            num={num}
            info={info}
            isActive={isActive}
            onClick={() => handleSelectTable(num)}
          />
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-[#E7D3B1] flex items-center gap-2">
            <Utensils className="w-6 h-6 text-[#FF7A00]" />
            Gestor de Comandas
          </h2>
          <p className="text-xs text-[#A3A3A3]">
            Sincronização em tempo real. Selecione uma mesa para gerenciar a comanda.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#3A2414] border border-[#5a4030]" />
            <span className="text-[#A3A3A3]">Livre</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-[#A3A3A3]">Ocupada</span>
          </div>
        </div>
      </div>

      {/* Top bar: Painel de Mesas trigger + quick tabs */}
      <div className="flex items-center gap-2 bg-[#121212] border border-[#3A2414] rounded-xl p-2">
        <Dialog open={gridOpen} onOpenChange={setGridOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="border-[#FF7A00]/50 bg-[#FF7A00]/10 text-[#FF7A00] hover:bg-[#FF7A00]/20 hover:text-[#FF7A00] shrink-0"
            >
              <LayoutGrid className="w-4 h-4 mr-2" />
              Painel de Mesas
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#0d0907] border-[#3A2414] text-[#E7D3B1] max-w-3xl">
            <DialogHeader>
              <DialogTitle className="text-[#E7D3B1] flex items-center gap-2">
                <Utensils className="w-5 h-5 text-[#FF7A00]" />
                Painel de Mesas
              </DialogTitle>
            </DialogHeader>
            {isLoading ? (
              <div className="flex items-center gap-2 text-[#A3A3A3] py-8 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
              </div>
            ) : (
              TablesGrid
            )}
          </DialogContent>
        </Dialog>

        <div className="h-6 w-px bg-[#3A2414] shrink-0" />

        <div className="flex-1 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {Array.from({ length: totalTables }, (_, i) => {
              const num = String(i + 1).padStart(2, "0");
              const info = occupiedMap.get(num);
              const occupied = !!info;
              const isActive = activeTable === num;
              return (
                <TableQuickTab
                  key={num}
                  num={num}
                  info={info}
                  isActive={isActive}
                  onClick={() => setActiveTable(num)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Main split panel */}
      {activeTable ? (
        <ComandaSplitPanel
          key={activeTable}
          tableNumber={activeTable}
          onClose={() => setActiveTable(null)}
          onPrintReceipt={onPrintReceipt}
        />
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-[#3A2414] bg-[#0d0907] p-12 text-center">
          <Utensils className="w-10 h-10 text-[#3A2414] mx-auto mb-3" />
          <p className="text-[#E7D3B1] font-bold">Nenhuma mesa selecionada</p>
          <p className="text-xs text-[#A3A3A3] mt-1">
            {occupiedCount > 0
              ? `${occupiedCount} mesa(s) ocupada(s). Clique em uma para abrir.`
              : "Abra o Painel de Mesas ou selecione uma mesa acima."}
          </p>
        </div>
      )}
    </div>
  );
}

function ComandaSplitPanel({
  tableNumber,
  onClose,
  onPrintReceipt,
}: {
  tableNumber: string;
  onClose: () => void;
  onPrintReceipt?: (orderIds: string[]) => void;
}) {
  const qc = useQueryClient();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paymentMethod, setPaymentMethod] = useState<UIMethod>("cash");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null);
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [serviceFee, setServiceFee] = useState<number>(0);
  const [nowTs, setNowTs] = useState(Date.now());

  
  const { data: customers } = useQuery({
    queryKey: ["admin", "customers"],
    queryFn: () => listCustomers(),
  });


  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: comanda, isLoading } = useQuery({
    queryKey: ["comandas", "detail", tableNumber],
    queryFn: () => getMesaComanda(tableNumber),
    refetchInterval: 5_000,
  });

  const itemsKey = useMemo(
    () => (comanda?.items ?? []).map((i: any) => i.id).join(","),
    [comanda?.items],
  );
  const prevKeyRef = useRef(itemsKey);
  useEffect(() => {
    if (prevKeyRef.current !== itemsKey) {
      const validIds = new Set((comanda?.items ?? []).map((i: any) => i.id));
      setSelected((prev) => {
        const next = new Set<string>();
        for (const id of prev) if (validIds.has(id)) next.add(id);
        return next;
      });
      prevKeyRef.current = itemsKey;
    }
  }, [itemsKey, comanda?.items]);

  const removeMut = useMutation({
    mutationFn: (item_id: string) => removeComandaItem(item_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comandas"] });
      toast.success("Item removido da comanda");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao remover item"),
  });

  const finalizeMut = useMutation({
    mutationFn: (vars: { selected_item_ids: string[] }) =>
      finalizeMesaPayment({
        table_number: tableNumber,
        selected_item_ids: vars.selected_item_ids,
        payment_method: UI_TO_DB[paymentMethod],
        customer_id: selectedCustomer?.id || null,
        discount_amount: discountValue,
        discount_type: discountType,
        service_fee: serviceFee,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["comandas"] });
      qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success(`Pagamento de ${formatBRL(res.total_charged)} registrado!`);
      const orderIds = (comanda?.orders ?? []).map((o: any) => o.id);
      if (orderIds.length > 0) onPrintReceipt?.(orderIds);
      if (selected.size === 0) {
        setTimeout(() => onClose(), 400);
      } else {
        setSelected(new Set());
      }
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao finalizar"),
  });

  const items = comanda?.items ?? [];
  const fullTotal = comanda?.total ?? 0;

  const baseTotal = useMemo(() => {
    if (selected.size === 0) return fullTotal;
    return items
      .filter((i: any) => selected.has(i.id))
      .reduce((s: number, i: any) => s + i.line_total, 0);
  }, [items, selected, fullTotal]);

  const finalTotal = useMemo(() => {
    let total = baseTotal;
    if (discountType === 'percentage') {
      total -= (baseTotal * (discountValue / 100));
    } else {
      total -= discountValue;
    }
    total += serviceFee;
    return Math.max(0, total);
  }, [baseTotal, discountValue, discountType, serviceFee]);


  const lastActivityMs = comanda?.last_activity ? new Date(comanda.last_activity).getTime() : 0;
  const cartActive = comanda?.cart_active ?? false;
  const stable =
    !cartActive && lastActivityMs > 0 && nowTs - lastActivityMs >= STABILITY_WINDOW_MS;
  const stabilityCountdown = Math.max(
    0,
    Math.ceil((STABILITY_WINDOW_MS - (nowTs - lastActivityMs)) / 1000),
  );

  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(new Set(items.map((i: any) => i.id)));
    else setSelected(new Set());
  };

  const customerName = comanda?.orders?.[0]?.customer_name ?? "";
  const allChecked = items.length > 0 && selected.size === items.length;

  const paymentButtons: { id: UIMethod; label: string; icon: any }[] = [
    { id: "cash", label: "Dinheiro", icon: Banknote },
    { id: "card", label: "Cartão", icon: CreditCard },
    { id: "pix", label: "Pix", icon: QrCode },
    { id: "voucher", label: "VR / Alim.", icon: Wallet },
    { id: "mixed", label: "Misto / Conv.", icon: Users },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4 min-h-[600px]">
      {/* LEFT: Items table */}
      <div className="rounded-2xl border border-[#3A2414] bg-[#0d0907] flex flex-col overflow-hidden">
        <div className="px-5 py-3 border-b border-[#3A2414] flex items-center justify-between bg-[#121212]">
          <div className="flex items-center gap-2">
            <Utensils className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-[#E7D3B1]">Comanda — Mesa {tableNumber}</span>
            <span className="text-xs text-[#A3A3A3]">
              ({items.length} item{items.length === 1 ? "" : "ns"})
            </span>
          </div>
          {items.length > 0 && (
            <button
              onClick={() => toggleAll(!allChecked)}
              className="text-[10px] uppercase tracking-wider text-[#A3A3A3] hover:text-[#FF7A00] transition-colors"
            >
              {allChecked ? "Desmarcar todos" : "Marcar todos"}
            </button>
          )}
        </div>

        {items.length > 0 && !stable && (
          <div className="m-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-300 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold uppercase tracking-wider">Pedido em andamento no site</p>
              <p className="mt-0.5">
                Pagamento liberado em {stabilityCountdown}s
                {cartActive ? " (carrinho ativo)" : ""}.
              </p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center gap-2 text-[#A3A3A3] text-sm p-6">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando comanda…
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-[#A3A3A3] text-sm italic">
              Nenhum item nesta comanda.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#121212] text-[10px] uppercase tracking-wider text-[#A3A3A3]">
                <tr className="border-b border-[#3A2414]">
                  <th className="text-left px-3 py-2 w-10">
                    <Checkbox checked={allChecked} onCheckedChange={(c) => toggleAll(!!c)} />
                  </th>
                  <th className="text-left px-2 py-2 w-8">#</th>
                  <th className="text-left px-2 py-2">Produto</th>
                  <th className="text-center px-2 py-2 w-16">Qtd</th>
                  <th className="text-right px-2 py-2 w-24">Unit.</th>
                  <th className="text-right px-2 py-2 w-28">Subtotal</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, idx: number) => (
                  <ComandaItemRow
                    key={item.id}
                    item={item}
                    idx={idx}
                    checked={selected.has(item.id)}
                    onCheckChange={(c: any) => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (c) next.add(item.id);
                        else next.delete(item.id);
                        return next;
                      });
                    }}
                    onRemove={() => {
                      if (window.confirm("Remover este item da comanda?")) {
                        removeMut.mutate(item.id);
                      }
                    }}
                    isRemoving={removeMut.isPending}
                  />
                ))}
                      
              </tbody>
            </table>
          )}
        </div>

        {onPrintReceipt && comanda?.orders?.length ? (
          <div className="border-t border-[#3A2414] px-5 py-2 bg-[#121212]">
            <button
              onClick={() => onPrintReceipt(comanda.orders.map((o: any) => o.id))}
              className="text-xs text-[#A3A3A3] hover:text-[#FF7A00] flex items-center gap-2"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir prévia (80mm)
            </button>
          </div>
        ) : null}
      </div>

      {/* RIGHT: Checkout sidebar */}
      <div className="flex flex-col gap-3">
        <div className="rounded-2xl bg-emerald-700 text-white p-5 shadow-lg">
          <p className="text-[11px] uppercase tracking-widest opacity-80 font-bold">Total Geral</p>
          <p className="text-4xl font-black mt-1">{formatBRL(finalTotal)}</p>
          {selected.size > 0 && selected.size < items.length && (
            <p className="text-xs mt-2 opacity-90">
              Pagamento parcial • Restante: {formatBRL(fullTotal - baseTotal)}
            </p>
          )}
        </div>


        <div className="rounded-2xl bg-[#0d0907] border border-[#3A2414] p-5 space-y-4 flex-1">
          <div>
            <p className="text-sm font-bold text-[#E7D3B1] flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-[#FF7A00]" />
              Cliente &amp; Pagamento
            </p>
            <label className="text-[10px] uppercase tracking-wider text-[#A3A3A3]">Cliente</label>
            <div className="mt-1">
              <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={customerSearchOpen}
                    className="w-full justify-between bg-[#121212] border-[#3A2414] text-[#E7D3B1] hover:bg-[#1a1a1a] hover:text-[#E7D3B1]"
                  >
                    {selectedCustomer?.name || customerName || "Consumidor"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-[#121212] border-[#3A2414]">
                  <Command className="bg-[#121212]">
                    <CommandInput placeholder="Buscar cliente por nome, CPF ou Tel..." className="h-9 text-[#E7D3B1]" />
                    <CommandList>
                      <CommandEmpty className="py-2 text-xs text-center text-[#A3A3A3]">Nenhum cliente encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => {
                            setSelectedCustomer(null);
                            setCustomerSearchOpen(false);
                          }}
                          className="text-[#E7D3B1] hover:bg-[#FF7A00]/10 cursor-pointer"
                        >
                          <Check className={cn("mr-2 h-4 w-4", !selectedCustomer ? "opacity-100" : "opacity-0")} />
                          Consumidor
                        </CommandItem>
                        {(customers ?? []).filter((c: any) => c.is_active !== false).map((c: any) => (
                          <CommandItem
                            key={c.id}
                            onSelect={() => {
                              setSelectedCustomer({ id: c.id, name: c.name });
                              setCustomerSearchOpen(false);
                            }}
                            className="text-[#E7D3B1] hover:bg-[#FF7A00]/10 cursor-pointer"
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedCustomer?.id === c.id ? "opacity-100" : "opacity-0")} />
                            <div className="flex flex-col">
                              <span>{c.name}</span>
                              <span className="text-[10px] text-[#A3A3A3]">{c.whatsapp || c.cpf || ''}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#A3A3A3]">Desconto</label>
              <div className="flex mt-1">
                <Input
                  type="number"
                  value={discountValue || ""}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  className="bg-[#121212] border-[#3A2414] text-[#E7D3B1] rounded-r-none h-9"
                  placeholder="0,00"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setDiscountType(discountType === 'fixed' ? 'percentage' : 'fixed')}
                  className="bg-[#1a1a1a] border-[#3A2414] border-l-0 rounded-l-none h-9 w-9 text-[#A3A3A3]"
                >
                  {discountType === 'percentage' ? <Percent className="w-3.5 h-3.5" /> : <Banknote className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#A3A3A3]">Taxa Serviço</label>
              <Input
                type="number"
                value={serviceFee || ""}
                onChange={(e) => setServiceFee(Number(e.target.value))}
                className="bg-[#121212] border-[#3A2414] text-[#E7D3B1] mt-1 h-9"
                placeholder="0,00"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#A3A3A3]">
              Forma de Pagamento
            </label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {paymentButtons.map((p) => {
                const Icon = p.icon;
                const active = paymentMethod === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPaymentMethod(p.id)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-lg border-2 transition-all text-[11px] font-bold ${
                      active
                        ? "border-[#FF7A00] bg-[#FF7A00]/15 text-[#FF7A00]"
                        : "border-[#3A2414] bg-[#121212] text-[#A3A3A3] hover:border-[#D4A15A]/50"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-[#3A2414] space-y-1">
            <div className="flex items-center justify-between text-xs text-[#A3A3A3]">
              <span>Subtotal</span>
              <span>{formatBRL(baseTotal)}</span>
            </div>
            {discountValue > 0 && (
              <div className="flex items-center justify-between text-xs text-red-400">
                <span>Desconto {discountType === 'percentage' ? `(${discountValue}%)` : ''}</span>
                <span>-{formatBRL(discountType === 'percentage' ? (baseTotal * (discountValue / 100)) : discountValue)}</span>
              </div>
            )}
            {serviceFee > 0 && (
              <div className="flex items-center justify-between text-xs text-emerald-400">
                <span>Taxa de Serviço</span>
                <span>+{formatBRL(serviceFee)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#E7D3B1]">A pagar</span>
              <span className="text-xl font-black text-[#FF7A00]">{formatBRL(finalTotal)}</span>
            </div>
          </div>
        </div>


        <Button
          className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base uppercase tracking-wider disabled:opacity-50 rounded-2xl shadow-lg"
          disabled={
            items.length === 0 || !stable || finalizeMut.isPending || removeMut.isPending
          }
          onClick={() => finalizeMut.mutate({ selected_item_ids: Array.from(selected) })}
        >
          {finalizeMut.isPending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Processando…
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Finalizar Pagamento
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
