import { Star, Quote } from "lucide-react";

export const OxenteAvaliacoes = () => {
  return (
    <section className="relative bg-[#3A2414] mt-24 mb-10 px-5">
      <div className="max-w-6xl mx-auto relative py-10 md:py-12">
        <div className="grid md:grid-cols-[260px_1fr] gap-6 md:gap-10 items-center">
          {/* Overlapping image */}
          <div className="relative -mt-20 md:-mt-24 mx-auto md:mx-0 w-48 md:w-full">
            <div className="aspect-[3/4] rounded-2xl overflow-hidden border-2 border-[#D4A15A]/40 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
              <img
                src="https://images.unsplash.com/photo-1583394293214-28ded15ee548?q=80&w=600&auto=format&fit=crop"
                alt="Cliente Oxente"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Quote */}
          <div className="space-y-3">
            <Quote className="w-8 h-8 text-[#FF7A00]" />
            <h3 className="text-2xl md:text-3xl font-bold text-[#E7D3B1] leading-tight">
              Maria Sertaneja
            </h3>
            <p className="text-[#D4A15A] text-sm">cliente fiel</p>
            <p className="text-[#E7D3B1]/80 text-sm md:text-base leading-relaxed max-w-xl">
              "Melhor hambúrguer que já comi! O queijo coalho grelhado e o mel de engenho fazem toda a diferença. Virei cliente da casa."
            </p>
            <div className="flex gap-1 pt-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className="w-4 h-4 fill-[#FF7A00] text-[#FF7A00]" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};