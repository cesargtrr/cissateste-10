import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Medal, Star, Award, Sparkles } from "lucide-react";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_BY_CODE,
  type AchievementCode,
  getBadge,
  nextBadge,
  periodStart,
  sumPointsByDriver,
  type PointEntry,
} from "@/lib/driver-gamification";

interface Props {
  driverId: string;
  restaurantId: string;
}

interface DriverRow {
  id: string;
  name: string;
}

interface LedgerRow {
  id: string;
  driver_id: string;
  points: number;
  reason: string;
  description: string | null;
  created_at: string;
}

interface AchievementRow {
  id: string;
  driver_id: string;
  code: string;
  points_awarded: number;
  unlocked_at: string;
}

type RankPeriod = "day" | "week" | "month";

const PERIOD_LABEL: Record<RankPeriod, string> = {
  day: "Diário",
  week: "Semanal",
  month: "Mensal",
};

export function GamificationPanel({ driverId, restaurantId }: Props) {
  const qc = useQueryClient();

  const { data: drivers = [] } = useQuery<DriverRow[]>({
    queryKey: ["gam-drivers", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_drivers")
        .select("id, name")
        .eq("restaurant_id", restaurantId)
        .eq("active", true);
      if (error) throw error;
      return (data as DriverRow[]) ?? [];
    },
    staleTime: 60_000,
  });

  const { data: ledger = [] } = useQuery<LedgerRow[]>({
    queryKey: ["gam-ledger", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const since = periodStart("month").toISOString();
      const { data, error } = await supabase
        .from("driver_points_ledger")
        .select("id, driver_id, points, reason, description, created_at")
        .eq("restaurant_id", restaurantId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data as LedgerRow[]) ?? [];
    },
  });

  const { data: myAllPoints = 0 } = useQuery<number>({
    queryKey: ["gam-my-total", driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_points_ledger")
        .select("points")
        .eq("driver_id", driverId);
      if (error) throw error;
      return (data ?? []).reduce((acc, r) => acc + Number(r.points || 0), 0);
    },
  });

  const { data: achievements = [] } = useQuery<AchievementRow[]>({
    queryKey: ["gam-achievements", driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_achievements")
        .select("id, driver_id, code, points_awarded, unlocked_at")
        .eq("driver_id", driverId)
        .order("unlocked_at", { ascending: false });
      if (error) throw error;
      return (data as AchievementRow[]) ?? [];
    },
  });

  // Realtime
  useEffect(() => {
    if (!restaurantId || !driverId) return;
    const channel = supabase
      .channel(`gam-${driverId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "driver_points_ledger", filter: `restaurant_id=eq.${restaurantId}` },
        (payload) => {
          const row = payload.new as LedgerRow;
          qc.invalidateQueries({ queryKey: ["gam-ledger", restaurantId] });
          if (row.driver_id === driverId) {
            qc.invalidateQueries({ queryKey: ["gam-my-total", driverId] });
            if (row.points > 0 && row.reason !== "achievement") {
              toast.success(`+${row.points} pts`, { description: row.description ?? "" });
            } else if (row.points < 0) {
              toast.error(`${row.points} pts`, { description: row.description ?? "" });
            }
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "driver_achievements", filter: `driver_id=eq.${driverId}` },
        (payload) => {
          const row = payload.new as AchievementRow;
          qc.invalidateQueries({ queryKey: ["gam-achievements", driverId] });
          const meta = ACHIEVEMENT_BY_CODE[row.code as AchievementCode];
          toast.success(`🏆 Nova conquista: ${meta?.label ?? row.code}`, {
            description: `+${row.points_awarded} pts`,
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId, restaurantId, qc]);

  const driverName = useMemo(() => {
    const m = new Map(drivers.map((d) => [d.id, d.name] as const));
    return (id: string) => m.get(id) ?? "—";
  }, [drivers]);

  const buildRanking = (p: RankPeriod) => {
    const since = periodStart(p);
    const sums = sumPointsByDriver(ledger as PointEntry[], since);
    const counts = new Map<string, number>();
    for (const e of ledger) {
      if (new Date(e.created_at) < since) continue;
      if (e.reason === "delivery") counts.set(e.driver_id, (counts.get(e.driver_id) ?? 0) + 1);
    }
    const arr = drivers.map((d) => ({
      id: d.id,
      name: d.name,
      points: sums.get(d.id) ?? 0,
      deliveries: counts.get(d.id) ?? 0,
    }));
    arr.sort((a, b) => b.points - a.points || b.deliveries - a.deliveries);
    return arr;
  };

  const rankings = useMemo(
    () => ({
      day: buildRanking("day"),
      week: buildRanking("week"),
      month: buildRanking("month"),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ledger, drivers],
  );

  const badge = useMemo(() => getBadge(myAllPoints), [myAllPoints]);
  const next = useMemo(() => nextBadge(myAllPoints), [myAllPoints]);

  const myDeliveriesCount = useMemo(() => {
    // count delivery entries for this driver across full ledger (month window already pulled)
    return ledger.filter((e) => e.driver_id === driverId && e.reason === "delivery").length;
  }, [ledger, driverId]);

  const unlockedCodes = useMemo(() => new Set(achievements.map((a) => a.code)), [achievements]);

  return (
    <div className="space-y-4">
      {/* Badge */}
      <div
        className="border rounded-xl p-4 sm:p-5 flex items-center justify-between gap-4"
        style={{ borderColor: badge.ring, background: badge.bg }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
            style={{ background: badge.color + "22", border: `2px solid ${badge.color}` }}
          >
            <Award className="w-6 h-6" style={{ color: badge.color }} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-[#A3A3A3]">Badge atual</div>
            <div className="text-lg font-bold" style={{ color: badge.color }}>{badge.label}</div>
            <div className="text-xs text-[#A3A3A3]">
              Pontuação Geral: <span className="text-[#E7D3B1] font-semibold">{myAllPoints} pts</span>
            </div>
          </div>
        </div>
        {next && (
          <div className="text-right text-xs text-[#A3A3A3] hidden sm:block">
            Próximo: <span style={{ color: next.color }} className="font-semibold">{next.label}</span>
            <div>Faltam {Math.max(0, next.min - myAllPoints)} pts</div>
          </div>
        )}
      </div>

      {/* Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {(Object.keys(rankings) as RankPeriod[]).map((p) => {
          const list = rankings[p].slice(0, 10);
          const myPos = rankings[p].findIndex((r) => r.id === driverId);
          return (
            <div key={p} className="border border-[#3A2414] bg-[#0d0907] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#3A2414] flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#D4A15A] flex items-center gap-1.5">
                  <Trophy className="w-4 h-4" /> {PERIOD_LABEL[p]}
                </h3>
                {myPos >= 0 && (
                  <Badge className="bg-[#FF7A00]/20 text-[#FF7A00] border-[#FF7A00]/40 text-[10px]">
                    {myPos + 1}º
                  </Badge>
                )}
              </div>
              {list.length === 0 ? (
                <div className="p-4 text-xs text-[#A3A3A3] text-center">Sem pontos ainda.</div>
              ) : (
                <ul className="divide-y divide-[#3A2414]/60">
                  {list.map((r, i) => (
                    <li
                      key={r.id}
                      className={`flex items-center justify-between px-4 py-2 text-sm ${r.id === driverId ? "bg-[#FF7A00]/5" : ""}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`font-bold w-6 text-center ${i < 3 ? "text-[#FF7A00]" : "text-[#A3A3A3]"}`}>
                          {i + 1}
                        </span>
                        <span className="truncate">
                          {r.name}
                          {r.id === driverId && <span className="text-[10px] text-[#FF7A00] ml-1">(você)</span>}
                        </span>
                      </div>
                      <div className="text-xs text-[#D4A15A] font-semibold whitespace-nowrap">
                        {r.points} pts <span className="text-[#A3A3A3] font-normal">• {r.deliveries}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Achievements grid */}
      <div className="border border-[#3A2414] bg-[#0d0907] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-[#D4A15A] flex items-center gap-1.5">
            <Medal className="w-4 h-4" /> Conquistas
          </h3>
          <Link to="/driver/achievements" className="text-xs text-[#FF7A00] hover:underline">
            Ver histórico →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = unlockedCodes.has(a.code);
            const progress = Math.min(100, Math.round((myDeliveriesCount / a.threshold) * 100));
            return (
              <div
                key={a.code}
                className={`rounded-xl border p-3 text-center transition ${
                  unlocked
                    ? "border-[#FF7A00]/50 bg-[#FF7A00]/5"
                    : "border-[#3A2414] bg-black/30 opacity-60 grayscale"
                }`}
              >
                <div className="text-3xl mb-1">{a.icon}</div>
                <div className={`text-xs font-bold ${unlocked ? "text-[#E7D3B1]" : "text-[#A3A3A3]"}`}>
                  {a.label}
                </div>
                <div className="text-[10px] text-[#A3A3A3] mt-0.5">{a.description}</div>
                {!unlocked && (
                  <>
                    <Progress value={progress} className="h-1 mt-2" />
                    <div className="text-[10px] text-[#A3A3A3] mt-1">
                      {Math.min(myDeliveriesCount, a.threshold)}/{a.threshold}
                    </div>
                  </>
                )}
                {unlocked && (
                  <Badge className="mt-2 bg-[#FF7A00]/20 text-[#FF7A00] border-[#FF7A00]/40 text-[10px]">
                    +{a.pts} pts
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent points feed */}
      <div className="border border-[#3A2414] bg-[#0d0907] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#3A2414]">
          <h3 className="text-sm font-bold text-[#D4A15A] flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> Pontos recentes
          </h3>
        </div>
        {ledger.filter((e) => e.driver_id === driverId).slice(0, 10).length === 0 ? (
          <div className="p-4 text-xs text-[#A3A3A3] text-center">Ainda sem registros.</div>
        ) : (
          <ul className="divide-y divide-[#3A2414]/60">
            {ledger
              .filter((e) => e.driver_id === driverId)
              .slice(0, 10)
              .map((e) => (
                <li key={e.id} className="px-4 py-2 flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <div className="text-xs">{e.description ?? e.reason}</div>
                    <div className="text-[10px] text-[#A3A3A3]">
                      {new Date(e.created_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <span
                    className={`text-sm font-bold ${e.points >= 0 ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {e.points > 0 ? `+${e.points}` : e.points}
                  </span>
                </li>
              ))}
          </ul>
        )}
        <div className="px-4 py-2 border-t border-[#3A2414] text-[10px] text-[#A3A3A3] flex items-center gap-1">
          <Star className="w-3 h-3" /> Atualização em tempo real
        </div>
      </div>
    </div>
  );
}