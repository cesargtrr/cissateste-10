import { MessageCircle, Instagram } from "lucide-react";

export const OxenteLocalizacao = () => {
  return (
    <section className="py-14 bg-[#1a1a1a] px-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <span className="text-[#D4A15A] uppercase tracking-widest text-xs font-bold">Visite</span>
          <h2 className="text-3xl font-bold text-[#E7D3B1] mt-1">Onde estamos</h2>
        </div>
        <a 
          href="https://www.google.com/maps/dir/?api=1&destination=-2.6899352,-44.2994443" 
          target="_blank" 
          rel="noopener noreferrer"
          className="block rounded-2xl border border-[#3A2414] overflow-hidden group relative"
        >
          <iframe
            title="CISSABURGUER - São Luís-MA"
            src="https://www.google.com/maps?q=-2.6899352,-44.2994443&z=15&output=embed"
            className="w-full h-64 md:h-80 pointer-events-none"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
            <span className="bg-[#FF7A00] text-white px-4 py-2 rounded-full text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity">
              Traçar Rota
            </span>
          </div>
        </a>
        <p className="text-[#E7D3B1] text-sm">
          BR-135, Pedrinhas — ao lado do Posto Premier, São Luís - MA
        </p>
        <div className="space-y-4">
          <a href="https://wa.me/5598982103076?text=Reservas" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-[#121212] p-4 rounded-xl border border-[#3A2414] active:border-[#FF7A00]">
            <MessageCircle className="text-[#FF7A00] shrink-0" />
            <div className="flex-1">
              <p className="text-[#E7D3B1] text-sm font-bold">(98) 98210-3076</p>
              <p className="text-[#D4A15A]/70 text-xs">Chame no WhatsApp</p>
            </div>
          </a>
          <a href="https://www.instagram.com/oxente_burguer_arena?igsh=MXZqYTA3a3VsNmttZQ==" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-[#121212] p-4 rounded-xl border border-[#3A2414] active:border-[#FF7A00]">
            <Instagram className="text-[#FF7A00] shrink-0" />
            <div className="flex-1">
              <p className="text-[#E7D3B1] text-sm font-bold">@oxente_burguer_arena</p>
              <p className="text-[#D4A15A]/70 text-xs">Siga no Instagram</p>
            </div>
          </a>
        </div>
      </div>
    </section>
  );
};