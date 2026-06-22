export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type DriverLocationPoint = GeoPoint & {
  id?: string;
  driver_id?: string;
  driverName?: string;
  current_order_id?: string | null;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  is_online?: boolean | null;
  updated_at?: string | null;
  status?: string | null;
};

export function distanceMeters(a: GeoPoint, b: GeoPoint) {
  const earthRadius = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function formatDistance(meters?: number | null) {
  if (!meters || !Number.isFinite(meters)) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

export function formatDuration(seconds?: number | null) {
  if (!seconds || !Number.isFinite(seconds)) return "—";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}

export function isFreshLocation(updatedAt?: string | null, thresholdMs = 90_000) {
  if (!updatedAt) return false;
  return Date.now() - new Date(updatedAt).getTime() <= thresholdMs;
}