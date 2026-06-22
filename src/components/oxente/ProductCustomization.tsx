import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMenuItemExtras } from "@/lib/menu.functions";
import { formatBRL, parsePrice } from "@/lib/cart-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Minus, X } from "lucide-react";
import { addItem } from "@/lib/cart-store";
import { toast } from "sonner";
import { useStoreOpenStatus } from "./OpeningStatusBanner";

interface Extra {
  id?: string;
  name: string;
  price: number;
  qty: number;
  controlar_estoque?: boolean;
  quantidade_estoque?: number;
  estoque_minimo?: number;
}

interface Product {
  id: string | number;
  name: string;
  price: number;
  desc: string;
  img: string;
  permitir_observacao?: boolean;
  placeholder_observacao?: string | null;
}

interface ProductCustomizationProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

const EMPTY_EXTRAS: Extra[] = [];

export const ProductCustomization = ({
  product,
  isOpen,
  onClose,
}: ProductCustomizationProps) => {
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [extras, setExtras] = useState<Extra[]>([]);
  const openStatus = useStoreOpenStatus();
  const isClosed = openStatus ? !openStatus.isOpen : false;

  const productId = product?.id ? String(product.id) : null;
  const isUuid =
    !!productId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId);

  const { data: loadedProductExtras } = useQuery({
    queryKey: ["menu-extras", productId],
    queryFn: () => getMenuItemExtras({ menu_item_id: productId! }),
    enabled: !!isUuid && isOpen,
  });

  const productExtras = loadedProductExtras ?? EMPTY_EXTRAS;

  React.useEffect(() => {
    const nextExtras = productExtras.length
      ? (productExtras as any[]).map((e) => ({
          id: e.id,
          name: e.name,
          price: Number(e.price),
          controlar_estoque: !!e.controlar_estoque,
          quantidade_estoque: Number(e.quantidade_estoque ?? 0),
          estoque_minimo: Number(e.estoque_minimo ?? 0),
          qty: 0,
        }))
      : [];

    setExtras((prev) => {
      const prevSignature = JSON.stringify(
        prev.map((extra) => ({
          id: extra.id ?? null,
          name: extra.name,
          price: extra.price,
        })),
      );
      const nextSignature = JSON.stringify(
        nextExtras.map((extra) => ({
          id: extra.id ?? null,
          name: extra.name,
          price: extra.price,
        })),
      );

      return prevSignature === nextSignature ? prev : nextExtras;
    });
  }, [productExtras]);

  if (!product) return null;

  const allowNotes = product.permitir_observacao !== false;
  const notesPlaceholder =
    product.placeholder_observacao && product.placeholder_observacao.trim().length > 0
      ? product.placeholder_observacao
      : "Alguma observação? (ex: tirar cebola, ponto da carne, etc.)";

  const handleUpdateExtra = (id: string | undefined, name: string, delta: number) => {
    setExtras((prev) =>
      prev.map((e) =>
        (id ? e.id === id : e.name === name) ? { ...e, qty: Math.max(0, e.qty + delta) } : e
      )
    );
  };

  const productPrice = parsePrice(product.price);
  const selectedExtras = extras.filter((e) => e.qty > 0);
  const extrasTotal = selectedExtras.reduce(
    (acc, e) => acc + e.price * e.qty,
    0
  );
  const totalPrice = (productPrice + extrasTotal) * qty;

  const handleAddToCart = () => {
    addItem(
      {
        id: product.id,
        name: product.name,
        price: productPrice,
        extras: selectedExtras,
        notes: notes,
      },
      qty
    );
    toast.success(`${product.name} adicionado ao carrinho`);
    onClose();
    // Reset state
    setQty(1);
    setNotes("");
    setExtras((prev) => prev.map((e) => ({ ...e, qty: 0 })));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-[#121212] border-[#3A2414] text-[#E7D3B1] max-h-[90vh] flex flex-col [&>button.absolute]:hidden">
        <DialogHeader className="relative h-64 flex-shrink-0">
          <img
            src={product.img}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <div className="flex flex-col">
            <DialogTitle className="text-2xl font-bold text-[#E7D3B1]">
              {product.name}
            </DialogTitle>
            <p className="text-[#A3A3A3] text-sm mt-2">{product.desc}</p>
            <p className="text-[#D4A15A] font-bold mt-2">{formatBRL(productPrice)}</p>
          </div>

          {extras.length > 0 && (
            <div className="space-y-4">
              <div className="bg-[#1a1a1a] p-3 -mx-6 px-6">
                <h4 className="font-bold text-sm">Adicionais</h4>
                <p className="text-xs text-[#A3A3A3]">Opções para este produto</p>
              </div>

              <div className="space-y-4">
                {extras.map((extra, idx) => {
                  const outOfStock = extra.controlar_estoque && (extra.quantidade_estoque ?? 0) <= 0;
                  return (
                    <div
                      key={extra.id || extra.name || idx}
                      className={`flex items-center justify-between py-2 border-b border-[#3A2414] last:border-0 ${outOfStock ? "opacity-60" : ""}`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{extra.name}</p>
                          {outOfStock && (
                            <span className="text-[10px] bg-red-900/50 text-red-200 px-1.5 py-0.5 rounded font-bold uppercase tracking-tight">Esgotado</span>
                          )}
                        </div>
                        <p className="text-xs text-[#D4A15A]">
                          + {formatBRL(extra.price)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleUpdateExtra(extra.id, extra.name, -1)}
                          className={`p-1 rounded-full border transition-colors ${
                            extra.qty > 0
                              ? "border-[#D4A15A] text-[#D4A15A]"
                              : "border-[#3A2414] text-[#3A2414]"
                          }`}
                          disabled={extra.qty === 0 || outOfStock}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-4 text-center text-sm font-bold">
                          {extra.qty}
                        </span>
                        <button
                          onClick={() => handleUpdateExtra(extra.id, extra.name, 1)}
                          className={`p-1 rounded-full border transition-colors ${
                            outOfStock 
                              ? "border-[#3A2414] text-[#3A2414] cursor-not-allowed" 
                              : "border-[#D4A15A] text-[#D4A15A] hover:bg-[#D4A15A]/10"
                          }`}
                          disabled={outOfStock}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {allowNotes && (
            <div className="space-y-2 pb-4">
              <h4 className="font-bold text-sm">Observações</h4>
              <Textarea
                placeholder={notesPlaceholder}
                className="bg-[#1a1a1a] border-[#3A2414] focus:border-[#D4A15A] text-[#E7D3B1] placeholder:text-[#555] min-h-[80px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="p-6 border-t border-[#3A2414] bg-[#1a1a1a] flex items-center gap-4 flex-shrink-0">
          <div className="flex items-center gap-3 bg-[#121212] border border-[#3A2414] rounded-lg p-1">
            <button
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="p-2 text-[#D4A15A] hover:bg-[#D4A15A]/10 rounded-md transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-6 text-center font-bold">{qty}</span>
            <button
              onClick={() => setQty(qty + 1)}
              className="p-2 text-[#D4A15A] hover:bg-[#D4A15A]/10 rounded-md transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <Button
            onClick={handleAddToCart}
            disabled={isClosed}
            className="flex-1 bg-[#D97706] hover:bg-[#FF7A00] text-white font-bold h-12 flex items-center justify-between px-6 rounded-lg transition-colors disabled:bg-[#3A2414] disabled:text-[#A3A3A3] disabled:cursor-not-allowed"
          >
            <span>{isClosed ? "Loja Fechada" : "Adicionar"}</span>
            <span>{formatBRL(totalPrice)}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};