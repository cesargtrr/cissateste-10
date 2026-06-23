import { Link } from "@tanstack/react-router";
import { Utensils, MessageCircle, CalendarCheck, Instagram, MapPin, Phone, ArrowUpRight, Star } from "lucide-react";

type LinkItem = {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  href: string;
  external?: boolean;
  featured?: boolean;
};

const items: LinkItem[] = [
  { icon: Utensils, title: "Cardápio digital", subtitle: "Faça seu pedido agora", href: "/cardapio", featured: true },
  { icon: MessageCircle, title: "Pedir pelo WhatsApp", subtitle: "Atendimento direto", href: "https://wa.me/5500000000000", external: true },
  { icon: CalendarCheck, title: "Reservar mesa", subtitle: "Garanta sua noite", href: "#", external: true },
  { icon: Instagram, title: "Instagram", subtitle: "@oxente.burguer", href: "https://instagram.com", external: true },
  { icon: MapPin, title: "Como chegar", subtitle: "Ver no mapa", href: "https://maps.google.com", external: true },
  { icon: Phone, title: "Telefone", subtitle: "(00) 00000-0000", href: "tel:+5500000000000", external: true },
];

export const OxenteLinks = () => {
  return (
    <section className="px-5 pt-2 pb-10 max-w-md mx-auto">
      <div className="flex items-center justify-center gap-2 text-[#A3A3A3] text-xs mb-5">
        <Star className="w-3.5 h-3.5 fill-[#FF7A00] text-[#FF7A00]" />
        <span className="text-[#E7D3B1] font-medium">4.9</span>
        <span>·</span>
        <span>Aberto até 23h</span>
      </div>

      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          const content = (
            <div
              className={`group flex items-center gap-4 rounded-2xl p-3 pr-4 transition-all ${
                item.featured
                  ? "bg-[#FF7A00] hover:bg-[#FF8A1A] shadow-[0_6px_20px_rgba(255,122,0,0.35)]"
                  : "bg-[#1C1C1C] hover:bg-[#242424] border border-[#D4A15A]/10"
              }`}
            >
              <div
                className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${
                  item.featured ? "bg-black/25" : "bg-[#0f0f0f] border border-[#D4A15A]/15"
                }`}
              >
                <Icon className={`w-6 h-6 ${item.featured ? "text-white" : "text-[#FF7A00]"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-[15px] leading-tight ${item.featured ? "text-white" : "text-[#E7D3B1]"}`}>
                  {item.title}
                </p>
                <p className={`text-xs mt-0.5 ${item.featured ? "text-white/85" : "text-[#A3A3A3]"}`}>
                  {item.subtitle}
                </p>
              </div>
              <ArrowUpRight
                className={`w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${
                  item.featured ? "text-white" : "text-[#A3A3A3]"
                }`}
              />
            </div>
          );

          if (item.external) {
            return (
              <a key={item.title} href={item.href} target="_blank" rel="noopener noreferrer">
                {content}
              </a>
            );
          }
          return (
            <Link key={item.title} to={item.href}>
              {content}
            </Link>
          );
        })}
      </div>

      <p className="text-center text-[#A3A3A3]/60 text-xs mt-8">
        © {new Date().getFullYear()} CISSABURGER
      </p>
    </section>
  );
};