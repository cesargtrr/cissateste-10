import { Link } from "@tanstack/react-router";
import { ArrowRight, Tag } from "lucide-react";
import logoAsset from "@/assets/cissaburger-logo.png.asset.json";
const logo = logoAsset.url;
import { CartButton } from "./CartSheet";
import { ChangeServiceModeButton } from "./ChangeServiceModeButton";

export const OxenteHero = () => {
  return (
    <section className="relative bg-gradient-to-b from-[#1a0e08] to-[#121212] px-5 pt-6 pb-12 border-b border-[#D4A15A]/15">
      {/* Top nav */}
      <div className="max-w-6xl mx-auto flex items-center justify-between mb-6">
        <img src={logo} alt="CISSABURGUER" className="h-12 w-auto object-contain" {...({ fetchPriority: "high" } as any)} />
        <div className="flex items-center gap-3">
          <ChangeServiceModeButton />
          <Link
            to="/cardapio"
            className="hidden md:inline-flex items-center gap-2 bg-[#D97706] hover:bg-[#FF7A00] text-white px-5 py-2.5 rounded-full font-semibold text-xs uppercase tracking-wide transition-colors"
          >
            Cardápio <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <CartButton />
        </div>
      </div>

      {/* Hero grid */}
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-5 items-stretch">
        {/* Left: promo + text card */}
        <div className="flex flex-col gap-4">
          {/* Promo card */}
          <div className="relative overflow-hidden rounded-3xl h-44 md:h-52 border border-[#D4A15A]/20">
            <img
              src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=900&auto=format&fit=crop"
              alt=""
              loading="eager"
              className="absolute inset-0 w-full h-full object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-[#1a0e08] via-[#1a0e08]/60 to-transparent" />
            <div className="relative h-full flex flex-col justify-between p-5">
              <span className="inline-flex items-center gap-1.5 self-start bg-[#FF7A00] text-[#121212] text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                <Tag className="w-3 h-3" /> Cupom
              </span>
              <h3 className="text-3xl font-bold text-[#E7D3B1] leading-tight drop-shadow">
                GANHE 15% <span className="text-[#FF7A00]">OFF</span>
              </h3>
            </div>
          </div>

          {/* Title block */}
          <div className="space-y-3">
            <span className="inline-block bg-[#1a1a1a] border border-[#D4A15A]/25 text-[#D4A15A] text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">
              #1 Hamburgueria do Sertão
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-[#E7D3B1] leading-[1.05] tracking-tight">
              Sabor que vem do
              <br />
              <span className="text-[#FF7A00]">Nordeste, siô!</span>
            </h1>
            <p className="text-[#A3A3A3] text-sm leading-relaxed max-w-sm">
              Hambúrgueres artesanais feitos com carinho nordestino. Peça agora e descubra o sabor que conquistou Petrolina.
            </p>
            <Link
              to="/cardapio"
              className="inline-flex items-center gap-2 bg-[#D97706] hover:bg-[#FF7A00] text-white px-6 py-3 rounded-full font-semibold text-sm uppercase tracking-wide shadow-[0_4px_14px_rgba(217,119,6,0.4)] transition-colors mt-2"
            >
              <span className="w-6 h-6 rounded-full bg-black/30 flex items-center justify-center">
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
              Ver Cardápio
            </Link>
          </div>
        </div>

        {/* Right: big hero image */}
        <div className="relative rounded-3xl overflow-hidden h-[420px] md:h-auto border border-[#D4A15A]/20 shadow-[0_10px_40px_rgba(0,0,0,0.5)] aspect-square md:aspect-auto">
          <img
            src="https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=1200&auto=format&fit=crop"
            alt="Hambúrguer artesanal CISSABURGUER"
            {...({ fetchPriority: "high" } as any)}
            className="w-full h-full object-cover"
            width="1200"
            height="800"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#121212]/70 via-transparent to-transparent" />
          {/* Carousel dots */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            <span className="w-6 h-1 rounded-full bg-[#FF7A00]" />
            <span className="w-1.5 h-1 rounded-full bg-[#E7D3B1]/60" />
            <span className="w-1.5 h-1 rounded-full bg-[#E7D3B1]/60" />
            <span className="w-1.5 h-1 rounded-full bg-[#E7D3B1]/60" />
          </div>
        </div>
      </div>
    </section>
  );
};