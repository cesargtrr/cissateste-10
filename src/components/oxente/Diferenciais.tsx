import { Star, Shield, Flame, Truck } from "lucide-react";

const FEATURES = [
  { icon: <Flame />, title: "Grelhado no Fogo", desc: "Sabor defumado autêntico." },
  { icon: <Shield />, title: "Qualidade Premium", desc: "Carnes selecionadas diariamente." },
  { icon: <Star />, title: "Ingredientes Locais", desc: "O melhor do nosso Nordeste." },
  { icon: <Truck />, title: "Delivery Rápido", desc: "Chega quentinho na sua mesa." },
];

export const OxenteDiferenciais = () => {
  return (
    <section className="py-12 bg-[#3A2414] px-6 my-10">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {FEATURES.map((f, i) => (
            <div key={i} className="text-center space-y-2">
              <div className="text-[#FF7A00] w-12 h-12 mx-auto flex items-center justify-center border-2 border-[#D4A15A] rounded-full">
                {f.icon}
              </div>
              <h3 className="text-[#E7D3B1] font-bold text-sm">{f.title}</h3>
              <p className="text-[#E7D3B1]/70 text-xs leading-snug">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};