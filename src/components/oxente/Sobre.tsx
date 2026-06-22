export const OxenteSobre = () => {
  return (
    <section id="sobre" className="py-14 bg-[#121212] px-6">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 items-center">
        <div className="relative order-first md:order-last">
          <div className="absolute -inset-2 border-2 border-[#D4A15A]/60 rounded-2xl -z-10" />
          <img
            src="https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=900&auto=format&fit=crop"
            alt="Interior rústico"
            className="rounded-2xl shadow-2xl w-full h-56 md:h-auto object-cover"
          />
        </div>
        <div className="space-y-4">
          <span className="text-[#D4A15A] uppercase tracking-widest text-xs font-bold">Nossa história</span>
          <h2 className="text-3xl md:text-5xl font-bold text-[#FF7A00] leading-tight">Tradição do sertão, sabor premium</h2>
          <div className="w-16 h-1 bg-[#D4A15A]" />
          <p className="text-[#E7D3B1]/90 leading-relaxed text-base">
            Nascida no coração do Nordeste e inspirada no estilo Western moderno, a Oxente Burguer traz o melhor da culinária artesanal premium com um toque de rusticidade e sofisticação.
          </p>
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="text-center p-3 bg-[#1a1a1a] rounded-xl border border-[#3A2414]">
              <p className="text-xl font-bold text-[#FF7A00]">+5k</p>
              <p className="text-[10px] text-[#E7D3B1]/70 uppercase">Pedidos</p>
            </div>
            <div className="text-center p-3 bg-[#1a1a1a] rounded-xl border border-[#3A2414]">
              <p className="text-xl font-bold text-[#FF7A00]">4.9★</p>
              <p className="text-[10px] text-[#E7D3B1]/70 uppercase">Avaliação</p>
            </div>
            <div className="text-center p-3 bg-[#1a1a1a] rounded-xl border border-[#3A2414]">
              <p className="text-xl font-bold text-[#FF7A00]">100%</p>
              <p className="text-[10px] text-[#E7D3B1]/70 uppercase">Artesanal</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};