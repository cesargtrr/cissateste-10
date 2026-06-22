import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { parsePrice, formatBRL } from "@/lib/cart-store";
import React, { useState, lazy, Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getFeaturedItems } from "@/lib/menu.functions";

const ProductCustomization = lazy(() => import("./ProductCustomization").then(m => ({ default: m.ProductCustomization })));

export const OxenteProdutos = () => {
  const { data: items } = useSuspenseQuery({
    queryKey: ["featuredItems"],
    queryFn: () => getFeaturedItems(),
  });
  
  const [selectedProduct, setSelectedProduct] = useState<any>(null);


  return (
    <section className="py-16 bg-[#121212] px-5">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10 flex flex-col items-start gap-1">
          <div>
            <span className="text-[#FF7A00] uppercase tracking-widest text-[11px] font-bold">Top</span>
            <h2 className="text-3xl md:text-5xl font-bold text-[#E7D3B1] mt-1 leading-tight">Mais vendidos</h2>
            <p className="text-[#A3A3A3] text-sm mt-2">temos 3 clássicos para você</p>
          </div>
        </div>

        <div className="space-y-16">
          {items && items.length > 0 ? items.map((item: any, idx) => {
            const num = String(idx + 1).padStart(2, '0');
            const outOfStock = item.controlar_estoque === true && Number(item.quantidade_estoque ?? 0) <= 0;
            return (
              <div
                key={item.id}
                className="flex flex-col gap-6"
              >
                <div className="relative rounded-3xl overflow-hidden h-64 md:h-[450px] border border-[#3A2414] shadow-[0_10px_30px_rgba(0,0,0,0.5)] bg-[#1a1a1a] aspect-video md:aspect-[16/9]">
                  {item.image_url ? (
                    <img 
                      src={item.image_url} 
                      alt={item.name} 
                      loading="lazy"
                      width="800"
                      height="450"
                      className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1a1a1a] to-[#2a1a11]">
                      <span className="text-[#3A2414] font-bold">Imagem não disponível</span>
                    </div>
                  )}

                  <div className="absolute top-6 right-6">
                    <span className="bg-[#FF7A00] text-[#121212] px-5 py-2 rounded-full text-sm font-black shadow-lg">
                      {formatBRL(parsePrice(item.price))}
                    </span>
                  </div>
                </div>

                <div className="px-1 max-w-3xl">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-[#D4A15A]/30 bg-[#1a1a1a] text-[#D4A15A] text-[11px] font-bold tracking-widest">
                    {num}
                  </div>
                  <h3 className="text-3xl md:text-4xl font-bold text-[#E7D3B1] mt-5 leading-tight">{item.name}</h3>
                  <p className="text-[#A3A3A3] text-base leading-relaxed mt-3">{item.description}</p>
                  
                  <div className="mt-8 flex flex-wrap items-center gap-4">
                    <button
                      onClick={() => {
                        if (outOfStock) return;
                        setSelectedProduct({
                          id: item.id,
                          name: item.name,
                          price: item.price,
                          desc: item.description,
                          img: item.image_url,
                        });
                      }}
                      disabled={outOfStock}
                      className={`inline-flex items-center justify-center gap-2 rounded-full h-12 px-8 font-bold text-sm transition-all shadow-lg ${
                        outOfStock
                          ? "bg-[#3A2414] text-[#A3A3A3] cursor-not-allowed shadow-none"
                          : "bg-[#FF7A00] hover:bg-[#e66e00] text-[#121212] hover:scale-105 shadow-[#FF7A00]/20"
                      }`}
                    >
                      {outOfStock ? "Esgotado" : (<>Adicionar ao carrinho <ArrowRight className="w-4 h-4" /></>)}
                    </button>
                    <Link
                      to="/cardapio"
                      className="inline-flex items-center justify-center gap-2 border border-[#D4A15A]/40 hover:border-[#D4A15A] hover:bg-[#D4A15A]/10 text-[#D4A15A] rounded-full h-12 px-8 font-bold text-sm transition-all"
                    >
                      Ver cardápio
                    </Link>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="text-center py-20 bg-[#1a1a1a] rounded-3xl border border-[#3A2414]">
              <p className="text-[#A3A3A3]">Nenhum produto em destaque encontrado.</p>
              <Link to="/cardapio" className="text-[#FF7A00] mt-4 inline-block font-bold">Ver cardápio completo</Link>
            </div>
          )}
        </div>

      </div>

      <Suspense fallback={null}>
        <ProductCustomization
          product={selectedProduct}
          isOpen={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      </Suspense>
    </section>
  );
};