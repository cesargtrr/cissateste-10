import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Utensils, ShoppingBag, ArrowLeft, User, ArrowRight } from "lucide-react";
import { setServiceMode, useServiceMode } from "@/lib/service-mode-store";
import { getRestaurantSettings } from "@/lib/settings.functions";
import oxenteBrand from "@/assets/oxente-brand.png";
import { useStoreOpenStatus } from "./OpeningStatusBanner";

export const ServiceModeGate = ({ children }: { children: React.ReactNode }) => {
  const mode = useServiceMode();
  const [step, setStep] = useState<"choose" | "table">("choose");
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const openStatus = useStoreOpenStatus();
  const storeClosed = openStatus ? !openStatus.isOpen : false;

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const mesaParam = searchParams.get("mesa");
    
    if (mesaParam && !mode) {
      setSelectedTable(mesaParam);
      setStep("table");
    }
  }, [mode]);

  const { data: settings, isLoading, error: settingsError } = useQuery({
    queryKey: ["restaurant-settings"],
    queryFn: () => getRestaurantSettings(),
    enabled: !mode,
    retry: 1,
  });

  if (settingsError) {
    console.error("Error loading restaurant settings:", settingsError);
  }

  if (mode) return <>{children}</>;

  const totalTables = settings?.total_tables ?? 10;
  const deliveryFee = settings?.delivery_fee ?? 5;
  const tables = Array.from({ length: totalTables }, (_, i) => i + 1);

  const canConfirm = selectedTable !== null && customerName.trim().length >= 2;
  const confirmMesa = () => {
    if (canConfirm && selectedTable) {
      setServiceMode({ kind: "mesa", table: selectedTable, customerName: customerName.trim() });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-md flex items-center justify-center p-5 overflow-y-auto">
      <div className="w-full max-w-2xl bg-gradient-to-br from-[#1a0e08] to-[#121212] border border-[#D4A15A]/25 rounded-3xl p-6 md:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.7)]">
        <div className="flex flex-col items-center text-center mb-8">
          <img
            src={oxenteBrand}
            alt="Oxente Burguer"
            className="w-48 md:w-64 h-auto mb-4 drop-shadow-[0_8px_24px_rgba(255,122,0,0.25)]"
          />
          {storeClosed && openStatus && (
            <div className="w-full bg-[#3b0e0e] border border-[#6b1d1d] rounded-xl py-2 px-3 mb-3">
              <p className="text-[#ff6b6b] text-xs md:text-sm font-bold">
                {openStatus.message}
              </p>
            </div>
          )}
          <p className="text-sm text-[#A3A3A3] mt-2">
            {step === "choose"
              ? "Como você vai pedir hoje?"
              : "Selecione sua mesa e informe seu nome"}
          </p>
        </div>

        {step === "choose" && (
          <div className="grid md:grid-cols-2 gap-4">
            <button
              onClick={() => {
                if (storeClosed) {
                  alert(`Nosso salão está fechado no momento. O atendimento na mesa funciona de acordo com nosso horário de funcionamento.`);
                  return;
                }
                setStep("table");
              }}
              className="group flex flex-col items-center gap-3 p-6 rounded-2xl bg-[#1a1a1a] border-2 border-[#3A2414] hover:border-[#FF7A00] hover:bg-[#FF7A00]/5 transition-all"
            >
              <div className="w-14 h-14 rounded-full bg-[#FF7A00]/10 flex items-center justify-center group-hover:bg-[#FF7A00]/20 transition-colors">
                <Utensils className="w-7 h-7 text-[#FF7A00]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#E7D3B1]">Consumir na Mesa</h3>
                <p className="text-xs text-[#A3A3A3] mt-1">Estou no restaurante</p>
              </div>
            </button>

            <button
              onClick={() => setServiceMode({ kind: "retirada", customerName: "" })}
              className="group flex flex-col items-center gap-3 p-6 rounded-2xl bg-[#1a1a1a] border-2 border-[#3A2414] hover:border-[#D4A15A] hover:bg-[#D4A15A]/5 transition-all"
            >
              <div className="w-14 h-14 rounded-full bg-[#D4A15A]/10 flex items-center justify-center group-hover:bg-[#D4A15A]/20 transition-colors">
                <ShoppingBag className="w-7 h-7 text-[#D4A15A]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#E7D3B1]">Delivery / Retirada</h3>
                <p className="text-xs text-[#A3A3A3] mt-1">
                  Receba em casa ou retire no local
                </p>
              </div>
            </button>
          </div>
        )}

        {step === "table" && (
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#FF7A00] uppercase tracking-widest ml-1">
                Qual o seu nome?
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <User className="w-5 h-5 text-[#D4A15A]/40 group-focus-within:text-[#FF7A00] transition-colors" />
                </div>
                <input
                  autoFocus
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmMesa();
                  }}
                  placeholder="Digite seu nome aqui..."
                  className="w-full h-12 bg-[#1a1a1a] border-2 border-[#3A2414] focus:border-[#FF7A00] rounded-2xl pl-12 pr-4 text-[#E7D3B1] placeholder:text-[#A3A3A3]/40 focus:outline-none transition-all shadow-inner"
                />
              </div>
              <p className="text-[10px] text-[#A3A3A3] ml-1">Mínimo de 2 caracteres</p>
            </div>

            <div>
              <label className="text-xs font-bold text-[#FF7A00] uppercase tracking-widest ml-1 block mb-2">
                Selecione sua mesa
              </label>
            {isLoading ? (
              <p className="text-center text-[#A3A3A3] py-8">Carregando mesas…</p>
            ) : totalTables === 0 ? (
              <p className="text-center text-[#A3A3A3] py-8">
                Nenhuma mesa configurada. Fale com o atendente.
              </p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 max-h-72 overflow-y-auto pr-2">
                {tables.map((n) => (
                  (() => {
                    const value = String(n).padStart(2, "0");
                    const active = selectedTable === value;
                    return (
                  <button
                    key={n}
                    onClick={() => setSelectedTable(value)}
                    className={`aspect-square rounded-xl border text-[#E7D3B1] font-bold text-lg transition-all ${
                      active
                        ? "bg-[#FF7A00]/20 border-[#FF7A00] shadow-[0_0_0_2px_rgba(255,122,0,0.3)]"
                        : "bg-[#1a1a1a] border-[#3A2414] hover:border-[#FF7A00] hover:bg-[#FF7A00]/10"
                    }`}
                  >
                    {value}
                  </button>
                    );
                  })()
                ))}
              </div>
            )}
            </div>

            <button
              disabled={!canConfirm}
              onClick={confirmMesa}
              className="w-full h-14 bg-[#FF7A00] hover:bg-[#FF8A1A] disabled:opacity-30 disabled:hover:bg-[#FF7A00] text-[#121212] font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_rgba(255,122,0,0.3)]"
            >
              {selectedTable ? `Confirmar Mesa ${selectedTable}` : "Começar a Pedir"} <ArrowRight className="w-5 h-5" />
            </button>

            <button
              onClick={() => {
                const searchParams = new URLSearchParams(window.location.search);
                if (searchParams.get("mesa")) {
                  window.history.replaceState({}, '', window.location.pathname);
                }
                setSelectedTable(null);
                setStep("choose");
              }}
              className="flex items-center gap-2 text-sm text-[#A3A3A3] hover:text-[#D4A15A] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};