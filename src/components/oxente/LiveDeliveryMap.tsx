import { Bike, Crosshair, MapPin, Navigation, Signal } from "lucide-react";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { DriverLocationPoint, GeoPoint, distanceMeters, formatDistance, isFreshLocation } from "@/lib/geo-tracking";

type Props = {
  driverLocation?: DriverLocationPoint | null;
  customerPoint?: GeoPoint | null;
  customerAddress?: string | null;
  status?: string | null;
  compact?: boolean;
  onRequestCustomerPoint?: () => void;
};

export function LiveDeliveryMap({ driverLocation, customerPoint, customerAddress, status, compact, onRequestCustomerPoint }: Props) {
  const center = driverLocation ?? customerPoint;
  const distance = useMemo(() => {
    if (!driverLocation || !customerPoint) return null;
    return distanceMeters(driverLocation, customerPoint);
  }, [customerPoint, driverLocation]);
  const fresh = isFreshLocation(driverLocation?.updated_at);
  const mapSrc = center
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${center.longitude - 0.012}%2C${center.latitude - 0.008}%2C${center.longitude + 0.012}%2C${center.latitude + 0.008}&layer=mapnik${driverLocation ? "" : `&marker=${center.latitude}%2C${center.longitude}`}`
    : null;

  const infoPills = (
    <>
      <InfoPill icon={<Bike className="w-3.5 h-3.5" />} label="Entregador" value={driverLocation ? `${driverLocation.latitude.toFixed(5)}, ${driverLocation.longitude.toFixed(5)}` : "Sem sinal"} />
      <InfoPill icon={<MapPin className="w-3.5 h-3.5" />} label="Cliente" value={customerPoint ? `${customerPoint.latitude.toFixed(5)}, ${customerPoint.longitude.toFixed(5)}` : customerAddress || "Destino cadastrado"} />
      <InfoPill icon={<Signal className="w-3.5 h-3.5" />} label="Distância" value={formatDistance(distance)} />
    </>
  );

  return (
    <section className={`border border-[#3A2414] bg-[#0d0907] rounded-xl overflow-hidden ${compact ? "" : "mt-5"}`}>
      <div className="px-4 py-3 border-b border-[#3A2414] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-[#FF7A00]" />
          <h3 className="text-sm font-bold text-[#E7D3B1]">Mapa em tempo real</h3>
        </div>
        <div className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full border ${fresh ? "bg-emerald-600/15 text-emerald-300 border-emerald-600/40" : "bg-zinc-700/30 text-zinc-300 border-zinc-600/40"}`}>
          {fresh ? "Online" : "Aguardando GPS"}
        </div>
      </div>

      <div className="relative h-[300px] md:h-80 bg-[#121212]">
        {mapSrc ? (
          <iframe
            title="Mapa da entrega"
            src={mapSrc}
            className="absolute inset-0 w-full h-full border-0 opacity-80 grayscale-[0.15]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs md:text-sm text-[#A3A3A3] px-6 text-center">
            O mapa aparecerá quando o entregador iniciar o compartilhamento de localização.
          </div>
        )}
        {driverLocation && (
          <div className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
            <div className="w-10 h-10 rounded-full bg-[#0a0a0a]/90 border border-[#D4A15A] flex items-center justify-center shadow-[0_0_0_4px_rgba(212,161,90,0.25)] text-[#D4A15A]">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.5 11c-1.2 0-3.07.34-4.5 1-1.43-.67-3.3-1-4.5-1C5.46 11 3.5 12.46 3.5 15c0 1.38.81 2.63 2.09 3.32.25.13 1.53.68 2.91.68 1.2 0 3.07-.34 4.5-1 1.43.67 3.3 1 4.5 1 1.38 0 2.66-.55 2.91-.68C21.69 17.63 22.5 16.38 22.5 15c0-2.54-1.96-4-4.5-4zM7.5 17c-.9 0-1.7-.27-2.36-.68.3-.52.9-.88 1.61-.88.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5zm9 0c-.9 0-1.7-.27-2.36-.68.3-.52.9-.88 1.61-.88.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5zM12 7c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm-3.5 0c-1.38 0-2.5-1.12-2.5-2.5S7.12 2 8.5 2s2.5 1.12 2.5 2.5S9.88 7 8.5 7z"/>
              </svg>
            </div>
          </div>
        )}

        {/* Desktop floating info pills */}
        <div className="hidden md:grid md:grid-cols-3 md:gap-2 md:absolute md:inset-x-3 md:bottom-3 pointer-events-none">
          {infoPills}
        </div>
      </div>

      {/* Mobile info pills below the map */}
      <div className="md:hidden flex flex-col gap-2 p-3">
        {infoPills}
      </div>

      <div className="p-4 grid sm:grid-cols-2 gap-3 text-xs">
        <div className="space-y-1">
          <p className="uppercase tracking-wide text-[#A3A3A3]">Status atual</p>
          <p className="font-semibold text-[#FF7A00]">{status || "Aguardando atualização"}</p>
          {driverLocation?.updated_at && (
            <p className="text-[#A3A3A3]">Último sinal: {new Date(driverLocation.updated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
          )}
        </div>
        <div className="space-y-2 sm:text-right">
          {driverLocation?.accuracy != null && <p className="text-[#A3A3A3]">Precisão: {Math.round(driverLocation.accuracy)} m</p>}
          {onRequestCustomerPoint && !customerPoint && (
            <button type="button" onClick={onRequestCustomerPoint} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#3A2414] text-[#D4A15A] hover:text-[#FF7A00] hover:border-[#FF7A00]/50">
              <Crosshair className="w-3.5 h-3.5" /> Usar minha posição
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function InfoPill({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#3A2414] bg-[#0a0a0a]/90 backdrop-blur px-3 py-2 min-w-0">
      <div className="flex items-center gap-1.5 text-[#D4A15A] text-[10px] uppercase tracking-wide">{icon}{label}</div>
      <div className="mt-0.5 text-[#E7D3B1] text-xs sm:text-sm break-words leading-snug">{value}</div>
    </div>
  );
}