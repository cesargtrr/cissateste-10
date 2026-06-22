import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingCart, Plus, Minus, Trash2, Utensils, ShoppingBag, Pencil, Bike, AlertCircle } from "lucide-react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { useNavigate } from "@tanstack/react-router";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  useCart,
  updateQty,
  removeItem,
  clearCart,
  formatBRL,
} from "@/lib/cart-store";
import { useServiceMode, setServiceMode, describeMode, getMesaSession } from "@/lib/service-mode-store";
import { createOrder } from "@/lib/settings.functions";
import { saveOrder, setActiveOrderId } from "@/lib/order-history";
import { toast } from "sonner";
import { useStoreOpenStatus } from "./OpeningStatusBanner";

const WHATSAPP = "5598982103076";

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center space-y-4 bg-[#1a1a1a] rounded-xl border border-red-900/50 m-4">
      <AlertCircle className="w-12 h-12 text-red-500" />
      <h3 className="font-bold text-[#E7D3B1]">Erro no Carrinho</h3>
      <p className="text-xs text-[#A3A3A3] line-clamp-3">
        {(error as any)?.message || "Ocorreu um erro ao carregar os itens do seu pedido."}
      </p>
      <button
        onClick={() => {
          clearCart();
          resetErrorBoundary();
        }}
        className="text-xs bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full font-bold transition-colors"
      >
        Limpar Carrinho e Tentar Novamente
      </button>
    </div>
  );
}

export const CartButton = ({ className = "" }: { className?: string }) => {
  const [open, setOpen] = useState(false);
  const { items, count, total: subtotal } = useCart();
  const mode = useServiceMode();
  const [submitting, setSubmitting] = useState(false);
  const openStatus = useStoreOpenStatus();
  const isClosed = openStatus ? !openStatus.isOpen : false;
  const navigate = useNavigate();
  const abandonedCartRef = useRef<string | null>(null);
  const deliveryFee = mode?.kind === "delivery" ? mode.deliveryFee : 0;
  const total = subtotal + deliveryFee;

  // Track abandoned carts
  useEffect(() => {
    if (items.length === 0) {
      if (abandonedCartRef.current) {
        void supabase.from("abandoned_carts").delete().eq("id", abandonedCartRef.current);
        abandonedCartRef.current = null;
      }
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const payload = {
          customer_name: mode?.customerName || "Visitante",
          customer_phone: (mode as any)?.phone || null,
          items: items,
          total_amount: total,
          status: "pending"
        };

        if (abandonedCartRef.current) {
          await supabase.from("abandoned_carts").update(payload).eq("id", abandonedCartRef.current);
        } else {
          const { data } = await supabase.from("abandoned_carts").insert(payload).select("id").single();
          if (data) abandonedCartRef.current = data.id;
        }
      } catch (err) {
        console.error("Error saving abandoned cart:", err);
      }
    }, 5000); 

    return () => clearTimeout(timer);
  }, [items, total, mode]);

  const checkoutText = encodeURIComponent(
    [
      "Olá! Quero fazer um pedido:",
      mode ? `Nome: ${mode.customerName}` : "",
      mode ? `Modo: ${describeMode(mode)}` : "",
      mode?.kind === "delivery" ? `Endereço: ${mode.address}` : "",
      mode?.kind === "delivery" && mode.reference ? `Referência: ${mode.reference}` : "",
      "",
      ...items.map((i) => {
        const extrasText = i.extras?.map(e => `\n  + ${e.qty}x ${e.name}`).join("") || "";
        const notesText = i.notes ? `\n  Obs: ${i.notes}` : "";
        const itemTotal = (i.price + (i.extras?.reduce((acc, e) => acc + (e.price * e.qty), 0) || 0)) * i.qty;
        return `• ${i.qty}x ${i.name}${extrasText}${notesText} — ${formatBRL(itemTotal)}`;
      }),
      "",
      `Subtotal: ${formatBRL(subtotal)}`,
      mode?.kind === "delivery" ? `Taxa de entrega: ${formatBRL(deliveryFee)}` : "",
      `Total: ${formatBRL(total)}`,
    ].filter(Boolean).join("\n")
  );

  const handleCheckout = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    if (submitting) return;
    e.preventDefault();
    // Non-mesa flows go through the full checkout page
    if (mode?.kind !== "mesa") {
      setOpen(false);
      navigate({ to: "/checkout" });
      return;
    }
    setSubmitting(true);
    try {
      const isMesa = mode?.kind === "mesa";
      const res = await createOrder({
        customer_name: mode?.customerName || null,
        source: "mesa",
        table_number: isMesa ? (mode as any).table : null,
        mesa_session: isMesa ? getMesaSession() : null,
        payment_method: "pix",
        total_amount: total,
        items: items.map((i) => ({
          menu_item_id: typeof i.id === "string" ? i.id : null,
          name: i.name,
          quantity: i.qty,
          // Preço base; adicionais vão separados em `extras`.
          unit_price: i.price,
          notes: i.notes ?? null,
          extras: (i.extras || []).filter((e) => e.qty > 0),
        })),
      });
      saveOrder({ id: res.id, createdAt: new Date().toISOString(), total });
      setActiveOrderId(res.id);
      toast.success("Pedido enviado para a cozinha!");
      clearCart();
      setOpen(false);
      navigate({ to: "/pedido/$id", params: { id: res.id } });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar pedido");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Abrir carrinho"
          disabled={isClosed}
          className={`relative p-2.5 rounded-full bg-[#1a1a1a] border border-[#D4A15A]/25 text-[#D4A15A] hover:text-[#FF7A00] hover:border-[#FF7A00] transition-colors disabled:opacity-0 disabled:pointer-events-none ${className}`}
        >
          <ShoppingCart className="w-5 h-5" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 bg-[#FF7A00] text-[#121212] text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
              {count}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent className="bg-[#121212] border-l border-[#3A2414] text-[#E7D3B1] flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-[#E7D3B1]">Seu pedido</SheetTitle>
        </SheetHeader>
        <ErrorBoundary 
          FallbackComponent={ErrorFallback}
          onError={(error) => reportLovableError(error, { boundary: "cart_sheet_content" })}
        >

        {mode && (
          <div className="flex items-center justify-between bg-[#1a1a1a] border border-[#3A2414] rounded-xl px-3 py-2 mt-2">
            <div className="flex items-center gap-2 text-sm">
              {mode.kind === "mesa" ? (
                <Utensils className="w-4 h-4 text-[#FF7A00]" />
              ) : mode.kind === "delivery" ? (
                <Bike className="w-4 h-4 text-emerald-500" />
              ) : (
                <ShoppingBag className="w-4 h-4 text-[#D4A15A]" />
              )}
              <div className="flex flex-col">
                <span className="font-bold text-[#E7D3B1]">{mode.customerName}</span>
                <span className="text-[10px] text-[#A3A3A3]">{describeMode(mode)}</span>
                {mode.kind === "delivery" && (
                  <span className="text-[10px] text-[#A3A3A3] truncate max-w-[200px]">
                    {mode.address}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setServiceMode(null)}
              className="text-[10px] text-[#A3A3A3] hover:text-[#FF7A00] flex items-center gap-1 uppercase tracking-wider"
            >
              <Pencil className="w-3 h-3" /> Alterar
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {items.length === 0 ? (
            <div className="text-center text-[#A3A3A3] text-sm py-12">
              Seu carrinho está vazio.
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.cartId}
                className="bg-[#1a1a1a] border border-[#3A2414] rounded-xl p-3 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{item.name}</p>
                  {item.extras && item.extras.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {item.extras.map((extra) => (
                        <p key={extra.name} className="text-[10px] text-[#A3A3A3]">
                          + {extra.qty}x {extra.name} ({formatBRL(extra.price)})
                        </p>
                      ))}
                    </div>
                  )}
                  {item.notes && (
                    <p className="text-[10px] text-[#D4A15A] italic mt-1 line-clamp-2">
                      Obs: {item.notes}
                    </p>
                  )}
                  <p className="text-[#FF7A00] text-xs font-bold mt-1">
                    {formatBRL(item.price + (item.extras?.reduce((acc, e) => acc + (e.price * e.qty), 0) || 0))}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 bg-[#0a0a0a] border border-[#3A2414] rounded-full px-1 py-1">
                    <button
                      onClick={() => updateQty(item.cartId, item.qty - 1)}
                      className="w-6 h-6 rounded-full text-[#D4A15A] hover:bg-[#3A2414] flex items-center justify-center"
                      aria-label="Diminuir"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-bold w-5 text-center">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => updateQty(item.cartId, item.qty + 1)}
                      className="w-6 h-6 rounded-full text-[#D4A15A] hover:bg-[#3A2414] flex items-center justify-center"
                      aria-label="Aumentar"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(item.cartId)}
                    className="text-[#A3A3A3] hover:text-[#FF7A00] p-1"
                    aria-label="Remover"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <SheetFooter className="border-t border-[#3A2414] pt-4 flex-col gap-3 sm:flex-col">
          {mode?.kind === "delivery" && items.length > 0 && (
            <>
              <div className="flex items-center justify-between w-full text-sm text-[#A3A3A3]">
                <span>Subtotal</span>
                <span>{formatBRL(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between w-full text-sm text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <Bike className="w-3.5 h-3.5" /> Taxa de entrega
                </span>
                <span>{formatBRL(deliveryFee)}</span>
              </div>
            </>
          )}
          <div className="flex items-center justify-between w-full">
            <span className="text-[#A3A3A3] text-sm">Total</span>
            <span className="text-xl font-bold text-[#FF7A00]">{formatBRL(total)}</span>
          </div>
          {mode?.kind === "mesa" ? (
            <button
              disabled={items.length === 0 || submitting}
              onClick={(e) => handleCheckout(e as any)}
              className={`w-full text-center bg-[#D97706] hover:bg-[#FF7A00] text-white py-3 rounded-full font-bold text-sm uppercase tracking-wide transition-colors ${
                items.length === 0 || submitting ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              {submitting ? "Enviando…" : "Enviar Pedido para a Cozinha"}
            </button>
          ) : (
            <button
              type="button"
              disabled={items.length === 0 || submitting}
              onClick={() => {
                if (items.length === 0 || submitting) return;
                setOpen(false);
                navigate({ to: "/checkout" });
              }}
              className={`w-full text-center bg-[#D97706] hover:bg-[#FF7A00] text-white py-3 rounded-full font-bold text-sm uppercase tracking-wide transition-colors ${
                items.length === 0 || submitting ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              Ir para Checkout
            </button>
          )}
          {items.length > 0 && (
            <button
              onClick={() => clearCart()}
              className="text-[#A3A3A3] hover:text-[#FF7A00] text-xs uppercase tracking-wider font-bold"
            >
              Limpar carrinho
            </button>
          )}
        </SheetFooter>
        </ErrorBoundary>
      </SheetContent>
    </Sheet>
  );
};