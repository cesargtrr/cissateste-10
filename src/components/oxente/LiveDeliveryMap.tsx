import { useEffect, useMemo, useRef } from "react";
import { MapPin, Navigation } from "lucide-react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DriverLocationPoint, GeoPoint, isFreshLocation } from "@/lib/geo-tracking";

type Props = {
  driverLocation?: DriverLocationPoint | null;
  customerPoint?: GeoPoint | null;
  customerAddress?: string | null;
  status?: string | null;
  compact?: boolean;
  onRequestCustomerPoint?: () => void;
};

const driverIcon = L.divIcon({
  className: "",
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  html: `
    <div style="width:44px;height:44px;border-radius:9999px;background:rgba(10,10,10,0.95);border:2px solid #FF7A00;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 6px rgba(255,122,0,0.2);color:#FF7A00;">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.5 11c-1.2 0-3.07.34-4.5 1-1.43-.67-3.3-1-4.5-1C5.46 11 3.5 12.46 3.5 15c0 1.38.81 2.63 2.09 3.32.25.13 1.53.68 2.91.68 1.2 0 3.07-.34 4.5-1 1.43.67 3.3 1 4.5 1 1.38 0 2.66-.55 2.91-.68C21.69 17.63 22.5 16.38 22.5 15c0-2.54-1.96-4-4.5-4zM7.5 17c-.9 0-1.7-.27-2.36-.68.3-.52.9-.88 1.61-.88.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5zm9 0c-.9 0-1.7-.27-2.36-.68.3-.52.9-.88 1.61-.88.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5zM12 7c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm-3.5 0c-1.38 0-2.5-1.12-2.5-2.5S7.12 2 8.5 2s2.5 1.12 2.5 2.5S9.88 7 8.5 7z"/>
      </svg>
    </div>
  `,
});

const customerIcon = L.divIcon({
  className: "",
  iconSize: [40, 48],
  iconAnchor: [20, 44],
  html: `
    <div style="display:flex;flex-direction:column;align-items:center;">
      <div style="width:40px;height:40px;border-radius:9999px;background:#D4A15A;border:2px solid #0d0907;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.4);color:#0d0907;">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3l9 8h-3v9h-4v-6h-4v6H6v-9H3l9-8z"/>
        </svg>
      </div>
      <div style="width:2px;height:6px;background:#D4A15A;"></div>
    </div>
  `,
});

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 16, { animate: true });
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16, animate: true });
  }, [map, points]);
  return null;
}

export function LiveDeliveryMap({ driverLocation, customerPoint, customerAddress, compact }: Props) {
  const fresh = isFreshLocation(driverLocation?.updated_at);
  const mapRef = useRef<L.Map | null>(null);

  const driverPos: [number, number] | null = driverLocation
    ? [driverLocation.latitude, driverLocation.longitude]
    : null;
  const customerPos: [number, number] | null = customerPoint
    ? [customerPoint.latitude, customerPoint.longitude]
    : null;

  const points = useMemo(() => {
    const list: [number, number][] = [];
    if (driverPos) list.push(driverPos);
    if (customerPos) list.push(customerPos);
    return list;
  }, [driverPos?.[0], driverPos?.[1], customerPos?.[0], customerPos?.[1]]);

  const initialCenter: [number, number] = points[0] ?? [-23.5505, -46.6333];

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
        {points.length > 0 ? (
          <MapContainer
            center={initialCenter}
            zoom={15}
            scrollWheelZoom
            ref={(instance) => {
              mapRef.current = instance;
            }}
            style={{ height: "100%", width: "100%", background: "#121212" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {customerPos && <Marker position={customerPos} icon={customerIcon} />}
            {driverPos && <Marker position={driverPos} icon={driverIcon} />}
            <FitBounds points={points} />
          </MapContainer>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs md:text-sm text-[#A3A3A3] px-6 text-center">
            O mapa aparecerá quando o entregador iniciar o compartilhamento de localização.
          </div>
        )}
      </div>

      {customerAddress && (
        <div className="px-4 py-3 flex items-start gap-2 text-xs text-[#A3A3A3]">
          <MapPin className="w-3.5 h-3.5 mt-0.5 text-[#D4A15A] shrink-0" />
          <span className="leading-snug">{customerAddress}</span>
        </div>
      )}
    </section>
  );
}
