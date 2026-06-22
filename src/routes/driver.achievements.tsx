import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bike, ArrowLeft, Flame, Medal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ACHIEVEMENT_BY_CODE, type AchievementCode } from "@/lib/driver-gamification";

export const Route = createFileRoute("/driver/achievements")({
  component: DriverAchievementsPage,
});

interface AchievementRow {
  id: string;
  code: string;
  points_awarded: number;
  unlocked_at: string;
}

function DriverAchievementsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [driverName, setDriverName] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          navigate({ to: "/driver", replace: true });
          return;
        }
      const { data: acc } = await supabase
        .from("delivery_driver_users")
        .select("driver_id, active")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!acc || !acc.active) {
        navigate({ to: "/driver", replace: true });
        return;
      }
      if (!mounted) return;
      setDriverId(acc.driver_id);
      const { data: d } = await supabase
        .from("delivery_drivers")
        .select("name")
        .eq("id", acc.driver_id)
        .maybeSingle();
      if (mounted) {
        setDriverName(d?.name ?? "");
        setLoading(false);
      }
      } catch (error) {
        console.error("Driver achievements bootstrap failed:", error);
        if (mounted) navigate({ to: "/driver", replace: true });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const { data: achievements = [] } = useQuery<AchievementRow[]>({
    queryKey: ["driver-achievements-page", driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_achievements")
        .select("id, code, points_awarded, unlocked_at")
        .eq("driver_id", driverId as string)
        .order("unlocked_at", { ascending: false });
      if (error) throw error;
      return (data as AchievementRow[]) ?? [];
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-[#E7D3B1] flex items-center justify-center">
        <Flame className="w-8 h-8 text-[#FF7A00] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-[#E7D3B1]">
      <header className="border-b border-[#3A2414] bg-[#0d0907]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Bike className="w-5 h-5 text-[#FF7A00]" />
            <div className="min-w-0">
              <h1 className="text-base font-bold truncate">Histórico de Conquistas</h1>
              <p className="text-xs text-[#A3A3A3] truncate">{driverName}</p>
            </div>
          </div>
          <Link to="/driver/performance">
            <Button variant="ghost" size="sm" className="text-[#D4A15A] hover:text-[#FF7A00]">
              <ArrowLeft className="w-4 h-4 mr-1" /> Desempenho
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {achievements.length === 0 ? (
          <div className="border border-[#3A2414] bg-[#0d0907] rounded-xl p-8 text-center">
            <Medal className="w-10 h-10 text-[#3A2414] mx-auto mb-2" />
            <p className="text-sm text-[#A3A3A3]">Você ainda não desbloqueou conquistas.</p>
            <p className="text-xs text-[#A3A3A3] mt-1">Conclua entregas para começar.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {achievements.map((a) => {
              const meta = ACHIEVEMENT_BY_CODE[a.code as AchievementCode];
              return (
                <li key={a.id} className="border border-[#3A2414] bg-[#0d0907] rounded-xl p-4 flex items-center gap-3">
                  <div className="text-3xl shrink-0">{meta?.icon ?? "🏅"}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm">{meta?.label ?? a.code}</div>
                    <div className="text-xs text-[#A3A3A3]">{meta?.description ?? ""}</div>
                    <div className="text-[11px] text-[#A3A3A3] mt-1">
                      {new Date(a.unlocked_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <Badge className="bg-[#FF7A00]/20 text-[#FF7A00] border-[#FF7A00]/40">
                    +{a.points_awarded} pts
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}