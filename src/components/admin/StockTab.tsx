import { useState, memo, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Minus, 
  Plus, 
  Boxes, 
  AlertTriangle, 
  Loader2, 
  History, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Clock,
  User,
  Info,
  Search
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  adjustStock,
  listStockOverview,
  toggleStockControl,
  updateStockSettings,
  listStockHistory,
} from "@/lib/admin.functions";

type Kind = "menu" | "adicional";


type StockRow = {
  id: string;
  name: string;
  nome?: string; // Fallback for additions
  controlar_estoque: boolean;
  quantidade_estoque: number;
  estoque_minimo: number;
  category?: string | null;
  cost_price?: number;
};

export function StockTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "stock-overview"],
    queryFn: () => listStockOverview(),
    refetchInterval: 10000,
  });

  const products: StockRow[] = (data?.products ?? []) as StockRow[];
  const adicionais: StockRow[] = (data?.adicionais ?? []) as StockRow[];

  const monitoredItems = [...products, ...adicionais].filter(i => i.controlar_estoque);
  const criticalItems = monitoredItems.filter(i => i.estoque_minimo > 0 && i.quantidade_estoque <= i.estoque_minimo);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "stock-overview"] });
    qc.invalidateQueries({ queryKey: ["admin", "all"] });
    qc.invalidateQueries({ queryKey: ["admin", "all-adicionais"] });
    qc.invalidateQueries({ queryKey: ["menuData"] });
    qc.invalidateQueries({ queryKey: ["menu-extras"] });
  };

  const toggleMut = useMutation({
    mutationFn: (v: { kind: Kind; id: string; enabled: boolean }) =>
      toggleStockControl(v),
    onSuccess: () => {
      invalidate();
      toast.success("Controle de estoque atualizado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar"),
  });

  const handleToggle = useCallback((id: string, enabled: boolean, kind: Kind) => {
    toggleMut.mutate({ kind, id, enabled });
  }, [toggleMut]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-[#D4A15A] py-12 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando estoque...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E7D3B1] flex items-center gap-2">
            <Boxes className="w-6 h-6 text-[#FF7A00]" /> Controle de Estoque
          </h1>
          <p className="text-sm text-[#A3A3A3] mt-1">
            Gerencie as quantidades de produtos e adicionais com controle de estoque ativo.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[#120d0b] border border-[#3A2414]/60 p-4 rounded-xl flex items-center gap-4">
          <div className="bg-[#1a1412] p-3 rounded-lg border border-[#3A2414]">
            <Boxes className="w-6 h-6 text-[#FF7A00]" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-[#A3A3A3]">Total de Itens Monitorados</p>
            <p className="text-2xl font-bold text-[#E7D3B1]">{monitoredItems.length}</p>
          </div>
        </div>
        <div className={`bg-[#120d0b] border border-[#3A2414]/60 p-4 rounded-xl flex items-center gap-4 ${criticalItems.length > 0 ? "ring-1 ring-red-500/30" : ""}`}>
          <div className={`p-3 rounded-lg border ${criticalItems.length > 0 ? "bg-red-950/20 border-red-900/40" : "bg-[#1a1412] border-[#3A2414]"}`}>
            <AlertTriangle className={`w-6 h-6 ${criticalItems.length > 0 ? "text-red-500" : "text-[#A3A3A3]"}`} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-[#A3A3A3]">Alerta Crítico</p>
            <p className={`text-2xl font-bold ${criticalItems.length > 0 ? "text-red-500" : "text-[#E7D3B1]"}`}>{criticalItems.length}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className="bg-[#120d0b] border border-[#3A2414]/60 p-1 mb-4 h-auto">
          <TabsTrigger 
            value="inventory" 
            className="data-[state=active]:bg-[#FF7A00] data-[state=active]:text-white px-4 py-2"
          >
            <Boxes className="w-4 h-4 mr-2" /> Estoque Atual
          </TabsTrigger>
          <TabsTrigger 
            value="history" 
            className="data-[state=active]:bg-[#FF7A00] data-[state=active]:text-white px-4 py-2"
          >
            <History className="w-4 h-4 mr-2" /> Movimentações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-8 mt-0">
          <StockSection
            title="Produtos do Cardápio"
            emptyMessage="Nenhum produto principal com controle de estoque. Ative o controle no cadastro do produto."
            rows={products}
            kind="menu"
            onToggle={handleToggle}
          />

          <StockSection
            title="Adicionais e Ingredientes"
            emptyMessage="Nenhum adicional com controle de estoque. Ative o controle no cadastro do adicional."
            rows={adicionais}
            kind="adicional"
            onToggle={handleToggle}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <HistorySection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HistorySection() {
  const { data: history, isLoading } = useQuery({
    queryKey: ["admin", "stock-history"],
    queryFn: () => listStockHistory(),
    refetchInterval: 10000,
  });

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const toISO = (d: Date) => d.toISOString().slice(0, 10);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [tipo, setTipo] = useState("all");
  const [dateFrom, setDateFrom] = useState(toISO(firstOfMonth));
  const [dateTo, setDateTo] = useState(toISO(today));

  const categories = Array.from(
    new Set((history ?? []).map((h: any) => h.category_name).filter(Boolean))
  ) as string[];

  const filtered = (history ?? []).filter((entry: any) => {
    if (search && !entry.item_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (category !== "all" && entry.category_name !== category) return false;
    if (tipo !== "all" && entry.tipo_movimentacao !== tipo) return false;
    if (dateFrom) {
      const from = new Date(dateFrom + "T00:00:00");
      if (new Date(entry.criado_em) < from) return false;
    }
    if (dateTo) {
      const to = new Date(dateTo + "T23:59:59");
      if (new Date(entry.criado_em) > to) return false;
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-[#D4A15A] py-12 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando histórico...
      </div>
    );
  }

  return (
    <div className="bg-[#0d0907] border border-[#3A2414]/60 rounded-xl overflow-hidden">
      <header className="px-4 py-3 border-b border-[#3A2414]/60 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#FF7A00]">
          Histórico de Movimentações
        </h2>
        <span className="text-[10px] uppercase tracking-widest text-[#A3A3A3]">
          {filtered.length} {filtered.length === 1 ? "registro" : "registros"}
        </span>
      </header>

      <div className="px-4 py-3 border-b border-[#3A2414]/60 bg-[#0d0907]">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-[#A3A3A3]">Busca</Label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#A3A3A3]" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produto..."
                className="bg-[#1a1412] border-[#3A2414] h-9 pl-8 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-[#A3A3A3]">Categoria</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-[#1a1412] border border-[#3A2414] rounded-md h-9 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF7A00]"
            >
              <option value="all">Todas</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-[#A3A3A3]">Tipo</Label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full bg-[#1a1412] border border-[#3A2414] rounded-md h-9 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF7A00]"
            >
              <option value="all">Todos</option>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-[#A3A3A3]">De:</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-[#1a1412] border-[#3A2414] h-9 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-[#A3A3A3]">Até:</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-[#1a1412] border-[#3A2414] h-9 text-xs"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="text-[10px] uppercase tracking-widest text-[#A3A3A3] bg-[#120d0b]">
            <tr>
              <th className="px-4 py-3 font-medium">Data/Hora</th>
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium text-center">Qtd.</th>
              <th className="px-4 py-3 font-medium">Motivo</th>
              <th className="px-4 py-3 font-medium">Responsável</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#3A2414]/40">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-xs text-[#A3A3A3]">
                  Nenhuma movimentação encontrada para os filtros aplicados.
                </td>
              </tr>
            ) : (
              filtered.map((entry: any) => (
                <tr key={entry.id} className="hover:bg-[#120d0b]/50 transition-colors">
                  <td className="px-4 py-3 text-xs whitespace-nowrap text-[#E7D3B1]">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-[#A3A3A3]" />
                      {format(new Date(entry.criado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#E7D3B1]">
                    {entry.item_name}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {entry.tipo_movimentacao === "entrada" ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-950/30 text-emerald-400 border border-emerald-900/50">
                        <ArrowUpCircle className="w-3 h-3" /> Entrada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-950/30 text-red-400 border border-red-900/50">
                        <ArrowDownCircle className="w-3 h-3" /> Saída
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-bold text-[#E7D3B1]">
                    {entry.quantidade}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#A3A3A3] max-w-[200px]">
                    <div className="flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-[#D4A15A]" />
                      <span>{entry.motivo || "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#E7D3B1]">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#1a1412] border border-[#3A2414] flex items-center justify-center">
                        <User className="w-3 h-3 text-[#FF7A00]" />
                      </div>
                      {entry.responsavel_nome}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


const StockSection = memo(({
  title,
  emptyMessage,
  rows,
  kind,
  onToggle,
}: {
  title: string;
  emptyMessage: string;
  rows: StockRow[];
  kind: Kind;
  onToggle: (id: string, enabled: boolean, kind: Kind) => void;
}) => {
  return (
    <section className="bg-[#0d0907] border border-[#3A2414]/60 rounded-xl overflow-hidden">
      <header className="px-4 py-3 border-b border-[#3A2414]/60 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#FF7A00]">
          {title}
        </h2>
        <span className="text-[10px] uppercase tracking-widest text-[#A3A3A3]">
          {rows.length} {rows.length === 1 ? "item" : "itens"}
        </span>
      </header>

      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-[#A3A3A3]">
          {emptyMessage}
        </div>
      ) : (
        <div className="divide-y divide-[#3A2414]/40">
          {/* Header (desktop) */}
          <div className="hidden md:grid grid-cols-[1.5fr_120px_1fr_120px_220px] gap-3 px-4 py-2 text-[10px] uppercase tracking-widest text-[#A3A3A3]">
            <span>Item</span>
            <span>Controlar Estoque</span>
            <span className="text-center">Quantidade</span>
            <span className="text-center">Alerta Mín.</span>
            <span className="text-right">Movimentação</span>
          </div>

          {rows.map((row) => (
            <StockRowItem
              key={row.id}
              row={row}
              kind={kind}
              onToggle={(enabled) => onToggle(row.id, enabled, kind)}
            />
          ))}
        </div>
      )}
    </section>
  );
});

const StockRowItem = memo(({ row, kind, onToggle }: { row: StockRow; kind: Kind; onToggle: (enabled: boolean) => void; }) => {
  const qc = useQueryClient();
  const displayName = row.name || row.nome || "Sem nome";

  const isLow =
    row.controlar_estoque &&
    row.estoque_minimo > 0 &&
    row.quantidade_estoque <= row.estoque_minimo;

  const [minEdit, setMinEdit] = useState<string>(String(row.estoque_minimo));
  const minMut = useMutation({
    mutationFn: (v: number) =>
      updateStockSettings({ kind, id: row.id, estoque_minimo: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "stock-overview"] });
      qc.invalidateQueries({ queryKey: ["admin", "all"] });
      qc.invalidateQueries({ queryKey: ["admin", "all-adicionais"] });
      qc.invalidateQueries({ queryKey: ["menuData"] });
      qc.invalidateQueries({ queryKey: ["menu-extras"] });
      toast.success("Estoque mínimo atualizado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  const commitMin = () => {
    const parsed = Math.max(0, parseInt(minEdit || "0", 10) || 0);
    if (parsed !== row.estoque_minimo) minMut.mutate(parsed);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.5fr_120px_1fr_120px_220px] gap-3 px-4 py-3 items-center text-sm">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-[#E7D3B1] truncate">{displayName}</p>
          {isLow && (
            <span className="inline-flex items-center gap-1 text-[9px] uppercase font-bold bg-amber-900/50 text-amber-200 px-1.5 py-0.5 rounded">
              <AlertTriangle className="w-3 h-3" /> baixo
            </span>
          )}
        </div>
        {row.category && (
          <p className="text-[10px] text-[#A3A3A3] mt-0.5">{row.category}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={row.controlar_estoque} onCheckedChange={onToggle} />
        <span className="text-[11px] text-[#A3A3A3]">
          {row.controlar_estoque ? "Bloquear se zerar" : "Venda Livre"}
        </span>
      </div>

      <div className="text-center font-mono text-base font-bold text-[#E7D3B1]">
        {row.controlar_estoque ? (
          row.quantidade_estoque
        ) : (
          <span className="text-sm font-normal text-[#A3A3A3]">Ilimitado</span>
        )}
      </div>

      <div className="flex justify-center">
        <Input
          type="number"
          min="0"
          value={minEdit}
          disabled={!row.controlar_estoque || minMut.isPending}
          onChange={(e) => setMinEdit(e.target.value)}
          onBlur={commitMin}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="bg-[#1a1a1a] border-[#3A2414] h-8 w-20 text-center text-xs"
        />
      </div>

      <div className="flex justify-end gap-2">
        <AdjustPopover
          kind={kind}
          id={row.id}
          name={row.name}
          direction="out"
          disabled={!row.controlar_estoque}
          currentCost={row.cost_price ?? 0}
        />
        <AdjustPopover
          kind={kind}
          id={row.id}
          name={row.name}
          direction="in"
          disabled={!row.controlar_estoque}
          currentCost={row.cost_price ?? 0}
        />
      </div>
    </div>
  );
});

const AdjustPopover = memo(({
  kind,
  id,
  name,
  direction,
  disabled,
  currentCost,
}: {
  kind: Kind;
  id: string;
  name: string;
  direction: "in" | "out";
  disabled: boolean;
  currentCost: number;
}) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");
  const [costInput, setCostInput] = useState<string>(String(currentCost ?? 0));

  const mut = useMutation({
    mutationFn: () => {
      const parsed = Math.max(1, parseInt(qty || "0", 10) || 0);
      const delta = direction === "in" ? parsed : -parsed;
      return adjustStock({ type: kind === "menu" ? "product" : "addition", id, delta, reason: reason || undefined });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "stock-overview"] });
      qc.invalidateQueries({ queryKey: ["admin", "stock-history"] });
      qc.invalidateQueries({ queryKey: ["admin", "all"] });
      qc.invalidateQueries({ queryKey: ["admin", "all-adicionais"] });
      qc.invalidateQueries({ queryKey: ["menuData"] });
      qc.invalidateQueries({ queryKey: ["menu-extras"] });
      toast.success(direction === "in" ? "Entrada registrada" : "Saída registrada");
      setOpen(false);
      setQty("1");
      setReason("");
      setCostInput(String(currentCost ?? 0));
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao ajustar estoque"),
  });

  const Icon = direction === "in" ? Plus : Minus;
  const label = direction === "in" ? "Entrada" : "Saída";
  const title = direction === "in" ? "Entrada de estoque" : "Saída de estoque";
  
  const reasons = direction === "in" 
    ? ["Compra de insumos", "Ajuste de inventário", "Devolução"]
    : ["Erro de digitação anterior", "Insumo estragado/desperdiçado", "Consumo interno", "Ajuste de inventário"];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          className={
            direction === "in"
              ? "border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/30 hover:text-emerald-200 h-8 px-2"
              : "border-red-700/50 text-red-300 hover:bg-red-900/30 hover:text-red-200 h-8 px-2"
          }
          aria-label={`${label} de estoque`}
        >
          <Icon className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 bg-[#0d0907] border-[#3A2414] text-[#E7D3B1] p-4 shadow-2xl">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-[#FF7A00] flex items-center gap-2">
                {direction === "in" ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                {title}
              </h3>
              <p className="text-[11px] text-[#A3A3A3] mt-0.5">Informe os detalhes da movimentação.</p>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-[#A3A3A3]">Produto</Label>
            <p className="text-sm font-semibold truncate bg-[#1a1412] px-2 py-1.5 rounded border border-[#3A2414]/50">
              {name}
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-[#A3A3A3]">Quantidade</Label>
            <Input
              type="number"
              min="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="bg-[#1a1412] border-[#3A2414] h-9 focus-visible:ring-[#FF7A00]"
              autoFocus
            />
          </div>

          {direction === "in" && (
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-[#A3A3A3]">
                Preço de Custo desta Remessa (R$)
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={costInput}
                onChange={(e) => setCostInput(e.target.value)}
                className="bg-[#1a1412] border-[#3A2414] h-9 focus-visible:ring-[#FF7A00]"
              />
              <p className="text-[10px] text-[#A3A3A3]">
                Atualiza o custo padrão deste item para as próximas vendas.
              </p>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-[#A3A3A3]">Motivo</Label>
            <select 
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-[#1a1412] border border-[#3A2414] rounded-md h-9 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#FF7A00] appearance-none"
            >
              <option value="" disabled>Selecione um motivo...</option>
              {reasons.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
              <option value="Outro">Outro...</option>
            </select>
          </div>

          {reason === "Outro" && (
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-[#A3A3A3]">Observação</Label>
              <Textarea
                value={reason === "Outro" ? "" : reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Descreva o motivo..."
                maxLength={100}
                className="bg-[#1a1412] border-[#3A2414] min-h-[60px] text-xs focus-visible:ring-[#FF7A00]"
              />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1 border-[#3A2414] text-[#A3A3A3] hover:bg-[#1a1412] h-9"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={mut.isPending || !qty || parseInt(qty, 10) < 1 || !reason}
              onClick={() => mut.mutate()}
              className={
                direction === "in"
                  ? "flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-9"
                  : "flex-1 bg-red-600 hover:bg-red-700 text-white h-9"
              }
            >
              {mut.isPending ? "Salvando..." : "Confirmar"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});
