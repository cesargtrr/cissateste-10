import { useQuery } from "@tanstack/react-query";
import { listOpeningHours } from "@/lib/opening-hours.functions";
import { getRestaurantSettings } from "@/lib/settings.functions";
import { computeOpenStatus } from "@/lib/opening-hours-status";
import { useEffect, useState } from "react";

export function useStoreOpenStatus() {
  const { data: hours } = useQuery({
    queryKey: ["opening-hours"],
    queryFn: () => listOpeningHours(),
    staleTime: 60_000,
  });
  const { data: settings } = useQuery({
    queryKey: ["restaurant-settings"],
    queryFn: () => getRestaurantSettings(),
    staleTime: 60_000,
  });
  const [, setTick] = useState(0);
  useEffect(() => {
    // Reavalia silenciosamente a cada 30s para transitar de Fechada→Aberta
    // sem exigir reload manual da página.
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!hours) return null;
  return computeOpenStatus(hours, Boolean(settings?.force_closed));
}

export const OpeningStatusBanner = ({ className = "" }: { className?: string }) => {
  const status = useStoreOpenStatus();
  if (!status || status.isOpen) return null;
  return (
    <div className={`w-full bg-[#3b0e0e] border-b border-[#6b1d1d] text-center py-2 px-4 ${className}`}>
      <p className="text-[#ff6b6b] text-xs md:text-sm font-bold">
        {status.message} <span className="text-[#E7D3B1] font-normal tracking-tight">· Delivery e Retirada abrem em breve</span>
      </p>
    </div>
  );
};