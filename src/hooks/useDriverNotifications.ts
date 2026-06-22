import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { NotificationKind } from "@/lib/driver-journey";

export type DriverNotificationRow = {
  id: string;
  driver_id: string;
  restaurant_id: string;
  order_id: string | null;
  kind: NotificationKind;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  dedupe_key: string;
  read_at: string | null;
  created_at: string;
};

export function useDriverNotifications(driverId: string | null) {
  const qc = useQueryClient();
  const seenKeys = useRef<Set<string>>(new Set());

  const query = useQuery({
    queryKey: ["driver-notifications", driverId],
    enabled: !!driverId,
    staleTime: 15_000,
    queryFn: async (): Promise<DriverNotificationRow[]> => {
      const { data, error } = await supabase
        .from("driver_notifications" as never)
        .select("*")
        .eq("driver_id", driverId as string)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = (data ?? []) as unknown as DriverNotificationRow[];
      // Pre-seed dedupe set so already-loaded items don't trigger toasts later.
      for (const r of rows) seenKeys.current.add(r.dedupe_key ?? r.id);
      return rows;
    },
  });

  useEffect(() => {
    if (!driverId) return;
    const TOAST_KINDS: NotificationKind[] = ["new_delivery", "reassigned", "delay_alert"];
    const channel = supabase
      .channel(`driver-notifications-${driverId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_notifications", filter: `driver_id=eq.${driverId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as DriverNotificationRow | undefined;
          if (payload.eventType === "INSERT" && row) {
            const key = row.dedupe_key ?? row.id;
            if (!seenKeys.current.has(key) && TOAST_KINDS.includes(row.kind)) {
              seenKeys.current.add(key);
              if (row.kind === "delay_alert") toast.warning(row.title, { description: row.body ?? undefined });
              else toast.info(row.title, { description: row.body ?? undefined });
            }
          }
          qc.invalidateQueries({ queryKey: ["driver-notifications", driverId] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [driverId, qc]);

  async function markRead(id: string) {
    await supabase
      .from("driver_notifications" as never)
      .update({ read_at: new Date().toISOString() } as never)
      .eq("id", id);
    qc.invalidateQueries({ queryKey: ["driver-notifications", driverId] });
  }

  async function markAllRead() {
    if (!driverId) return;
    await supabase
      .from("driver_notifications" as never)
      .update({ read_at: new Date().toISOString() } as never)
      .eq("driver_id", driverId)
      .is("read_at", null);
    qc.invalidateQueries({ queryKey: ["driver-notifications", driverId] });
  }

  const unread = (query.data ?? []).filter((n) => !n.read_at).length;

  return { notifications: query.data ?? [], unread, isLoading: query.isLoading, markRead, markAllRead };
}