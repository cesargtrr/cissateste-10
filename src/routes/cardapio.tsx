import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Clock, Receipt } from "lucide-react";
import React, { useState, useMemo, lazy, Suspense } from "react";
import { CartButton } from "@/components/oxente/CartSheet";
import { ChangeServiceModeButton } from "@/components/oxente/ChangeServiceModeButton";
import { parsePrice, formatBRL } from "@/lib/cart-store";
import { getMenuData } from "@/lib/menu.functions";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getSavedOrders } from "@/lib/order-history";
import { OpeningStatusBanner, useStoreOpenStatus } from "@/components/oxente/OpeningStatusBanner";
import { OpeningNoticeModal } from "@/components/oxente/OpeningNoticeModal";

const ProductCustomization = lazy(() => import("@/components/oxente/ProductCustomization").then(m => ({ default: m.ProductCustomization })));

export const Route = createFileRoute("/cardapio")({
  component: CardapioPage,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: ["menuData"],
      queryFn: () => getMenuData(),
    });
  },
});

function CardapioPage() {
  const { data } = useSuspenseQuery({
    queryKey: ["menuData"],
    queryFn: () => getMenuData(),
  });

  // Custom ordering: Hambúrgueres first, then Bebidas, then Acompanhamentos, then the rest.
  const orderedCategories = useMemo(() => {
    const priority = ["hambúrgueres", "hamburgueres", "bebidas", "acompanhamentos"];
    const rank = (name: string) => {
      const i = priority.indexOf(name.trim().toLowerCase());
      return i === -1 ? priority.length : i;
    };
    return data.categories
      .filter((cat) => cat.tipo === "produto")
      .sort((a, b) => rank(a.name) - rank(b.name));
  }, [data.categories]);

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    orderedCategories[0]?.id || null
  );
  const [maisOpen, setMaisOpen] = useState(false);
  const navigate = useNavigate();
  const savedOrders = typeof window !== "undefined" ? getSavedOrders() : [];
  const lastOrder = savedOrders[0];
  const openStatus = useStoreOpenStatus();
  const isClosed = openStatus ? !openStatus.isOpen : false;

  const filteredItems = useMemo(() => {
    return data.items.filter((i) => i.category_id === activeCategoryId);
  }, [data.items, activeCategoryId]);

  const activeCategoryName = useMemo(() => {
    return data.categories.find((c) => c.id === activeCategoryId)?.name || "";
  }, [data.categories, activeCategoryId]);


  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#E7D3B1] font-sans pb-24 selection:bg-[#FF7A00] selection:text-[#121212]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex flex-col">
        <OpeningStatusBanner className="relative z-[51]" />
        <div className="bg-[#0a0a0a]/80 backdrop-blur-lg border-b border-[#3A2414] px-5 py-4 flex items-center justify-between">
          <Link to="/" className="p-2 -ml-2 text-[#D4A15A]">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-lg font-bold tracking-tight text-[#E7D3B1]">Cardápio Digital</h1>
          <div className="flex items-center gap-2">
            <ChangeServiceModeButton />
            <CartButton />
          </div>
        </div>
      </header>
      <OpeningNoticeModal />

      {/* Hero / Categories */}
      <div className={`px-5 ${isClosed ? 'pt-32' : 'pt-24'}`}>
        <div className="mb-6">
          <span className="text-[#FF7A00] text-[11px] font-bold uppercase tracking-widest">Menu</span>
          <h2 className="text-3xl font-bold text-[#D4A15A] leading-tight">Toda a carta</h2>
          <p className="text-[#E7D3B1]/50 text-xs mt-1">{data.items.length} pratos selecionados</p>
        </div>

        {/* Categories scroll */}
        <div className="flex gap-2 justify-center flex-wrap pb-4">
          {orderedCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryId(cat.id)}
              className={`whitespace-nowrap px-5 py-2 rounded-full text-xs font-bold transition-all ${
                activeCategoryId === cat.id
                  ? "bg-[#FF7A00] text-[#121212]"
                  : "bg-[#1a1a1a] text-[#E7D3B1]/60 border border-[#3A2414]"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {filteredItems.map((item: any) => {
            const outOfStock = item.controlar_estoque === true && Number(item.quantidade_estoque ?? 0) <= 0;
            return (
              <div key={item.id} className={`flex bg-[#121212] border border-[#3A2414] rounded-xl overflow-hidden group transition-all duration-300 hover:border-[#FF7A00]/50 ${outOfStock ? 'opacity-80' : ''}`}>
                <div className="w-[100px] h-[100px] sm:w-[120px] sm:h-[120px] shrink-0 overflow-hidden bg-[#1a1a1a]">
                  {item.image_url ? (
                    <img 
                      src={item.image_url} 
                      alt={item.name} 
                      loading="lazy"
                      width="120"
                      height="120"
                      style={{ aspectRatio: '1/1' }}
                      className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${outOfStock ? "grayscale opacity-60" : ""}`} 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#3A2414] font-bold text-[10px]">SEM FOTO</div>
                  )}
                </div>
                <div className="p-3 flex-1 min-w-0 flex flex-col justify-between">
                  <div className="min-w-0">
                    <div className="flex justify-between items-start gap-1">
                      <h4 className="text-sm sm:text-base font-bold text-[#E7D3B1] truncate">{item.name}</h4>
                      {outOfStock && (
                        <span className="text-[9px] bg-red-900 text-red-100 px-1.5 py-0.5 rounded font-black uppercase tracking-tight shrink-0">Esgotado</span>
                      )}
                    </div>
                    <p className="text-[10px] sm:text-xs text-[#A3A3A3] line-clamp-2 mt-0.5 leading-relaxed">{item.description}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-black text-[#FF7A00]">R$ {item.price}</span>
                    <button
                      onClick={() => {
                        if (outOfStock) return;
                        setSelectedProduct({
                          id: item.id,
                          name: item.name,
                          price: item.price,
                          desc: item.description,
                          img: item.image_url,
                          permitir_observacao: item.permitir_observacao,
                          placeholder_observacao: item.placeholder_observacao,
                        });
                      }}
                      disabled={outOfStock}
                      className={`h-8 px-4 rounded-full text-[10px] font-black uppercase transition-all ${
                        outOfStock 
                          ? 'bg-[#3A2414] text-[#A3A3A3] cursor-not-allowed' 
                          : 'bg-[#FF7A00] hover:bg-[#D97706] text-[#121212]'
                      }`}
                    >
                      {outOfStock ? 'Esgotado' : 'Pedir'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>


      {/* Floating Bottom Nav */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1a1a1a]/90 backdrop-blur-xl border border-[#3A2414] px-8 py-3 rounded-full flex items-center gap-10 shadow-2xl shadow-black">
        <Link to="/" className="text-[#E7D3B1]/40 text-xs font-bold uppercase tracking-widest">Home</Link>
        <div className="h-4 w-px bg-[#3A2414]" />
        <button className="text-[#FF7A00] text-xs font-bold uppercase tracking-widest">Menu</button>
        <div className="h-4 w-px bg-[#3A2414]" />
        <button
          onClick={() => {
            if (lastOrder) {
              navigate({ to: "/pedido/$id", params: { id: lastOrder.id } });
            } else {
              setMaisOpen(true);
            }
          }}
          className="text-[#E7D3B1]/60 hover:text-[#E7D3B1] text-xs font-bold uppercase tracking-widest"
        >
          ACOMPANHAR
        </button>
      </nav>

      <Suspense fallback={null}>
        <ProductCustomization
          product={selectedProduct}
          isOpen={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      </Suspense>

      {/* Mais — bottom sheet */}
      {maisOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setMaisOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[#121212] border-t border-[#3A2414] rounded-t-3xl p-6 pb-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-[#3A2414] rounded-full mx-auto mb-6" />
            <h2 className="text-lg font-bold text-[#E7D3B1] mb-1">Mais opções</h2>
            <p className="text-xs text-[#A3A3A3] mb-5">Acompanhe seu pedido em tempo real.</p>

            {lastOrder ? (
              <button
                onClick={() => {
                  setMaisOpen(false);
                  navigate({ to: "/pedido/$id", params: { id: lastOrder.id } });
                }}
                className="w-full flex items-center gap-3 bg-[#FF7A00] hover:bg-[#FF8A1A] text-white rounded-2xl p-4 mb-3"
              >
                <Clock className="w-5 h-5 shrink-0" />
                <div className="text-left flex-1 min-w-0">
                  <p className="font-bold text-sm">Continuar acompanhando</p>
                  <p className="text-xs text-white/85">
                    Pedido #{lastOrder.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
              </button>
            ) : (
              <div className="w-full flex items-center gap-3 bg-[#1C1C1C] border border-[#D4A15A]/15 text-[#E7D3B1] rounded-2xl p-4">
                <Receipt className="w-5 h-5 text-[#A3A3A3] shrink-0" />
                <div className="text-left flex-1">
                  <p className="font-bold text-sm">Nenhum pedido ativo</p>
                  <p className="text-xs text-[#A3A3A3]">Faça um pedido para acompanhá-lo aqui.</p>
                </div>
              </div>
            )}

            <button
              onClick={() => setMaisOpen(false)}
              className="w-full mt-4 text-xs text-[#A3A3A3] py-2"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
