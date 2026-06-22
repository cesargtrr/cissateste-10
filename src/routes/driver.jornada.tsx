import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bike, CalendarDays, History, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { JornadaPanel } from "@/components/driver/JornadaPanel";
import { NotificationsBell } from "@/components/driver/NotificationsBell";
import { WEEKDAY_LABEL, formatHM, type ShiftRow } from "@/lib/driver-journey";

export const Route = createFileRoute("/driver/jornada")({
  component: DriverJornadaPage,
});

type ScheduleRow = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  active: boolean;
};

function DriverJornadaPage() {
  const navigate = useNavigate();
  const [driverId, setDriverId] = useState<string | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [driverName, setDriverName] = useState("");
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { navigate({ to: "/driver", replace: true }); return; }
      const { data: acc } = await supabase
        .from("delivery_driver_users" as never)
        .select("driver_id, active")
        .eq("user_id", session.user.id)
        .maybeSingle();
      const accAny = acc as { driver_id?: string; active?: boolean } | null;
      if (!accAny?.active || !accAny.driver_id) { navigate({ to: "/driver", replace: true }); return; }
      const { data: d } = await supabase
        .from("delivery_drivers" as never)
        .select("name, restaurant_id")
        .eq("id", accAny.driver_id)
        .maybeSingle();
      const dAny = d as { name?: string; restaurant_id?: string } | null;
      if (!mounted) return;
      setDriverId(accAny.driver_id);
      setRestaurantId(dAny?.restaurant_id ?? null);
      setDriverName(dAny?.name ?? "");
      setBootstrapped(true);
      } catch (error) {
        console.error("Driver jornada bootstrap failed:", error);
        if (mounted) navigate({ to: "/driver", replace: true });
      }
    })();
    return () => { mounted = false; };
  }, [navigate]);

  const scheduleQ = useQuery({
    queryKey: ["driver-schedule", driverId],
    enabled: !!driverId,
    queryFn: async (): Promise<ScheduleRow[]> => {
      const { data, error } = await supabase
        .from("driver_schedules" as never)
        .select("id, weekday, start_time, end_time, active")
        .eq("driver_id", driverId as string)
        .order("weekday", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ScheduleRow[];
    },
  });

  const historyQ = useQuery({
    queryKey: ["driver-shifts-history", driverId],
    enabled: !!driverId,
    queryFn: async (): Promise<ShiftRow[]> => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data, error } = await supabase
        .from("driver_shifts" as never)
        .select("id, driver_id, restaurant_id, started_at, ended_at, duration_seconds")
        .eq("driver_id", driverId as string)
        .gte("started_at", since.toISOString())
        .order("started_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as unknown as ShiftRow[];
    },
  });

  if (!bootstrapped || !driverId) {
    return (
      <div className="min-h-screen bg-black text-[#E7D3B1] flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-[#FF7A00]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-[#E7D3B1]">
      <header className="border-b border-[#3A2414] bg-[#0d0907]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Bike className="w-5 h-5 text-[#FF7A00] shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base font-bold truncate">Minha Jornada</h1>
              <p className="text-xs text-[#A3A3A3] truncate">{driverName}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationsBell driverId={driverId} />
            <Link to="/driver/dashboard">
              <Button variant="ghost" size="sm" className="text-[#D4A15A] hover:text-[#FF7A00]">
                <ArrowLeft className="w-4 h-4 mr-1" /> Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <JornadaPanel driverId={driverId} restaurantId={restaurantId} />

        <section className="rounded-xl border border-[#3A2414] bg-[#0d0907] p-4 md:p-5">
          <h3 className="text-sm font-bold text-[#D4A15A] mb-3 flex items-center gap-2">
            <CalendarDays className="w-4 h-4" /> Escala semanal
          </h3>
          {(scheduleQ.data ?? []).length === 0 ? (
            <p className="text-sm text-[#A3A3A3]">Nenhuma escala definida pelo restaurante.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
              {WEEKDAY_LABEL.map((label, idx) => {
                const row = (scheduleQ.data ?? []).find((s) => s.weekday === idx);
                return (
                  <div key={idx} className={`rounded-lg border p-3 text-center ${row?.active ? "border-[#FF7A00]/40 bg-[#FF7A00]/5" : "border-[#3A2414] bg-black/30 opacity-60"}`}>
                    <p className="text-[10px] uppercase tracking-wide text-[#A3A3A3]">{label}</p>
                    {row?.active ? (
                      <p className="text-xs font-mono mt-1">{row.start_time.slice(0,5)}–{row.end_time.slice(0,5)}</p>
                    ) : (
                      <p className="text-xs text-[#A3A3A3] mt-1">Folga</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[#3A2414] bg-[#0d0907] p-4 md:p-5">
          <h3 className="text-sm font-bold text-[#D4A15A] mb-3 flex items-center gap-2">
            <History className="w-4 h-4" /> Histórico (30 dias)
          </h3>
          {(historyQ.data ?? []).length === 0 ? (
            <p className="text-sm text-[#A3A3A3]">Nenhum turno encontrado.</p>
          ) : (
            <ul className="divide-y divide-[#3A2414]/60">
              {(historyQ.data ?? []).map((s) => (
                <li key={s.id} className="py-2.5 flex items-center justify-between text-sm gap-3">
                  <span className="text-[#E7D3B1]">{new Date(s.started_at).toLocaleString("pt-BR")}</span>
                  <span className="text-[#A3A3A3]">
                    {s.ended_at ? formatHM(s.duration_seconds ?? 0) : <span className="text-[#FF7A00]">em curso</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}