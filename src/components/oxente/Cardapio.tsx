const MENU_ITEMS = [
  { name: "Sertão Burguer", price: "R$ 38", desc: "Blend 180g, queijo coalho grelhado, mel de engenho e cebola caramelizada." },
  { name: "Cangaço Prime", price: "R$ 42", desc: "Blend 180g, carne de sol desfiada, queijo manteiga e maionese de coentro." },
  { name: "Mandacaru Veg", price: "R$ 35", desc: "Hambúrguer de grão de bico, queijo coalho, alface, tomate e molho especial." },
  { name: "Oxente Bacon", price: "R$ 40", desc: "Blend 180g, muito bacon crocante, cheddar inglês e barbecue artesanal." },
];

export const OxenteCardapio = () => {
  return (
    <section id="cardapio" className="py-14 bg-[#1a1a1a] px-6 border-y border-[#3A2414]">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <span className="text-[#FF7A00] uppercase tracking-widest text-xs font-bold">Cardápio</span>
          <h2 className="text-3xl md:text-5xl font-bold text-[#D4A15A] mt-2">Escolha o seu</h2>
          <p className="text-[#E7D3B1]/70 mt-2 text-sm">Toque pra pedir no WhatsApp</p>
        </div>

        <div className="space-y-4">
          {MENU_ITEMS.map((item, i) => (
            <a
              key={i}
              href={`https://wa.me/5587999999999?text=Quero%20o%20${encodeURIComponent(item.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-[#121212] rounded-2xl p-5 border border-[#3A2414] active:border-[#FF7A00] transition"
            >
              <div className="flex justify-between items-start gap-3">
                <h3 className="text-lg font-bold text-[#E7D3B1] flex-1">{item.name}</h3>
                <span className="text-lg font-bold text-[#FF7A00] shrink-0">{item.price}</span>
              </div>
              <p className="text-[#D4A15A]/80 text-sm mt-2 leading-relaxed">{item.desc}</p>
              <div className="mt-3 inline-flex items-center gap-1 text-[#FF7A00] text-xs font-bold uppercase tracking-wider">
                Pedir agora →
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};