import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { distanceMeters, type DriverLocationPoint } from "@/lib/geo-tracking";

export type TrackerState = "idle" | "active" | "blocked" | "denied" | "error" | "paused";
export type PermissionState = "granted" | "prompt" | "denied" | "unknown";

export type UseDriverLocationTrackerArgs = {
  driverId: string | null;
  restaurantId: string | null;
  activeOrderId: string | null;
  /** When false (e.g. logged out / on break / shift closed), tracking pauses. */
  enabled: boolean;
};

const MIN_DISTANCE_M = 25;
const MIN_INTERVAL_MS = 15_000;
const MAX_BACKOFF_MS = 60_000;

/**
 * Centralizes driver GPS: watchPosition + Haversine throttle (>=25m / >=15s),
 * retry with backoff, full cleanup, and pause when offline / no shift / on break.
 */
export function useDriverLocationTracker({
  driverId,
  restaurantId,
  activeOrderId,
  enabled,
}: UseDriverLocationTrackerArgs) {
  const [state, setState] = useState<TrackerState>("idle");
  const [permission, setPermission] = useState<PermissionState>("unknown");
  const [last, setLast] = useState<DriverLocationPoint | null>(null);
  const lastSentRef = useRef<{ point: DriverLocationPoint; at: number } | null>(null);
  const backoffRef = useRef(1000);
  const deniedToastShown = useRef(false);

  // Permission detection (once)
  useEffect(() => {
    if (typeof navigator === "undefined" || !("permissions" in navigator)) return;
    let cancelled = false;
    (async () => {
      try {
        const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
        if (cancelled) return;
        setPermission(status.state as PermissionState);
        status.onchange = () => setPermission(status.state as PermissionState);
      } catch {
        setPermission("unknown");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!driverId || !restaurantId) { setState("idle"); return; }

    if (!enabled || !activeOrderId) {
      setState(enabled ? "idle" : "paused");
      lastSentRef.current = null;
      // Mark offline silently (best-effort)
      void supabase
        .from("driver_locations" as never)
        .update({ is_online: false, current_order_id: null } as never)
        .eq("driver_id", driverId);
      return;
    }

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setState("blocked");
      return;
    }

    if (permission === "denied") {
      setState("denied");
      if (!deniedToastShown.current) {
        deniedToastShown.current = true;
        toast.error("Permissão de localização negada. Ative o GPS para rastrear a entrega.");
      }
      return;
    }

    setState("active");
    let cancelled = false;
    let retryTimer: number | null = null;

    const upsert = async (point: DriverLocationPoint) => {
      const { error } = await supabase
        .from("driver_locations" as never)
        .upsert({
          driver_id: driverId,
          restaurant_id: restaurantId,
          current_order_id: activeOrderId,
          latitude: point.latitude,
          longitude: point.longitude,
          accuracy: point.accuracy ?? null,
          speed: point.speed ?? null,
          heading: point.heading ?? null,
          is_online: true,
        } as never, { onConflict: "driver_id" });
      if (error) {
        setState("error");
        const delay = Math.min(backoffRef.current, MAX_BACKOFF_MS);
        backoffRef.current = Math.min(delay * 2, MAX_BACKOFF_MS);
        retryTimer = window.setTimeout(() => { if (!cancelled) void upsert(point); }, delay);
      } else {
        backoffRef.current = 1000;
        setState("active");
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        const point: DriverLocationPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          heading: position.coords.heading,
          updated_at: new Date(now).toISOString(),
          is_online: true,
        };
        setLast(point);

        const prev = lastSentRef.current;
        if (prev) {
          const dt = now - prev.at;
          const dist = distanceMeters(prev.point, point);
          if (dt < MIN_INTERVAL_MS && dist < MIN_DISTANCE_M) return;
        }
        lastSentRef.current = { point, at: now };
        void upsert(point);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermission("denied");
          setState("denied");
          if (!deniedToastShown.current) {
            deniedToastShown.current = true;
            toast.error("Permissão de localização negada.");
          }
        } else {
          setState("error");
        }
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 12_000 },
    );

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      navigator.geolocation.clearWatch(watchId);
    };
  }, [driverId, restaurantId, activeOrderId, enabled, permission]);

  return { state, permission, last };
}