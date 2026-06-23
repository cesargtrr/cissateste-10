import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/cissaburger-logo.png.asset.json";
const logo = logoAsset.url;

export const OxenteFooter = () => {
  return (
    <footer className="bg-[#121212] border-t border-[#3A2414] px-5 pt-14 pb-10">
      <div className="max-w-6xl mx-auto">
        {/* CTA */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-[#E7D3B1] leading-tight">
            Bateu a fome?
            <br />
            <span className="text-[#FF7A00]">Chama no zap!</span>
          </h2>
          <p className="text-[#D4A15A]/80 text-sm mt-3">Atendimento de Ter a Dom · 18h às 23h</p>
          <a
            href="https://wa.me/5587999999999"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-5 bg-[#D97706] hover:bg-[#FF7A00] text-white px-6 py-3 rounded-full font-semibold text-sm uppercase tracking-wide transition-colors"
          >
            Pedir pelo WhatsApp
          </a>
        </div>

        {/* Columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-10 border-t border-[#3A2414]">
          <div className="col-span-2 md:col-span-1 space-y-3">
            <img src={logo} alt="CISSABURGUER" className="h-12 w-auto object-contain" />
            <p className="text-[#A3A3A3] text-xs leading-relaxed max-w-[14rem]">
              Hambúrgueres artesanais com sabor nordestino, feitos com ingredientes selecionados.
            </p>
          </div>

          <div>
            <p className="text-[#D4A15A] font-bold text-xs uppercase tracking-widest mb-3">Menu</p>
            <ul className="space-y-2 text-[#E7D3B1]/70 text-sm">
              <li><Link to="/cardapio" className="hover:text-[#FF7A00]">Cardápio</Link></li>
              <li><Link to="/" className="hover:text-[#FF7A00]">Mais vendidos</Link></li>
              <li><Link to="/" className="hover:text-[#FF7A00]">Promoções</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-[#D4A15A] font-bold text-xs uppercase tracking-widest mb-3">Contato</p>
            <ul className="space-y-2 text-[#E7D3B1]/70 text-sm">
              <li><a href="tel:+5587999999999" className="hover:text-[#FF7A00]">(87) 99999-9999</a></li>
              <li><a href="https://wa.me/5587999999999" target="_blank" rel="noopener noreferrer" className="hover:text-[#FF7A00]">WhatsApp</a></li>
              <li><a href="https://instagram.com/oxenteburguer" target="_blank" rel="noopener noreferrer" className="hover:text-[#FF7A00]">Instagram</a></li>
            </ul>
          </div>

          <div>
            <p className="text-[#D4A15A] font-bold text-xs uppercase tracking-widest mb-3">Endereço</p>
            <ul className="space-y-2 text-[#E7D3B1]/70 text-sm">
              <li>Rua do Baião, 123</li>
              <li>Bairro Sertão</li>
              <li>Petrolina-PE</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-[#3A2414] flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-[#D4A15A]/50 text-xs">© 2026 CISSABURGUER · Sabor do Sertão 🌵</p>
          <p className="text-[#D4A15A]/40 text-xs">Feito com fogo no coração do Nordeste</p>
        </div>
      </div>
    </footer>
  );
};