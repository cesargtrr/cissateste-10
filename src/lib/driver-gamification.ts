export type BadgeTier = "bronze" | "prata" | "ouro" | "diamante";

export type AchievementCode =
  | "first_delivery"
  | "beginner_10"
  | "experienced_50"
  | "professional_100"
  | "elite_500"
  | "legend_1000";

export interface AchievementMeta {
  code: AchievementCode;
  label: string;
  description: string;
  threshold: number;
  icon: string;
  pts: number;
}

export const ACHIEVEMENTS: AchievementMeta[] = [
  { code: "first_delivery", label: "Primeira Corrida", description: "Sua primeira entrega concluída", threshold: 1, icon: "🥉", pts: 10 },
  { code: "beginner_10", label: "Iniciante", description: "10 entregas concluídas", threshold: 10, icon: "🥉", pts: 20 },
  { code: "experienced_50", label: "Entregador Experiente", description: "50 entregas concluídas", threshold: 50, icon: "🥈", pts: 50 },
  { code: "professional_100", label: "Profissional", description: "100 entregas concluídas", threshold: 100, icon: "🥇", pts: 100 },
  { code: "elite_500", label: "Elite", description: "500 entregas concluídas", threshold: 500, icon: "🏆", pts: 250 },
  { code: "legend_1000", label: "Lenda das Entregas", description: "1000 entregas concluídas", threshold: 1000, icon: "💎", pts: 500 },
];

export const ACHIEVEMENT_BY_CODE: Record<AchievementCode, AchievementMeta> =
  ACHIEVEMENTS.reduce((acc, a) => {
    acc[a.code] = a;
    return acc;
  }, {} as Record<AchievementCode, AchievementMeta>);

export interface BadgeInfo {
  tier: BadgeTier;
  label: string;
  min: number;
  max: number;
  color: string;
  bg: string;
  ring: string;
}

export const BADGES: BadgeInfo[] = [
  { tier: "bronze", label: "Bronze", min: 0, max: 100, color: "#CD7F32", bg: "rgba(205,127,50,0.15)", ring: "rgba(205,127,50,0.45)" },
  { tier: "prata", label: "Prata", min: 101, max: 500, color: "#C0C0C0", bg: "rgba(192,192,192,0.15)", ring: "rgba(192,192,192,0.45)" },
  { tier: "ouro", label: "Ouro", min: 501, max: 2000, color: "#FFD700", bg: "rgba(255,215,0,0.15)", ring: "rgba(255,215,0,0.45)" },
  { tier: "diamante", label: "Diamante", min: 2001, max: Number.POSITIVE_INFINITY, color: "#5DC8FF", bg: "rgba(93,200,255,0.15)", ring: "rgba(93,200,255,0.45)" },
];

export function getBadge(points: number): BadgeInfo {
  const p = Math.max(0, Math.floor(points));
  return BADGES.find((b) => p >= b.min && p <= b.max) ?? BADGES[0];
}

export function nextBadge(points: number): BadgeInfo | null {
  const cur = getBadge(points);
  const idx = BADGES.findIndex((b) => b.tier === cur.tier);
  return idx >= 0 && idx < BADGES.length - 1 ? BADGES[idx + 1] : null;
}

export type Period = "day" | "week" | "month";

export function periodStart(p: Period, ref: Date = new Date()): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  if (p === "week") {
    d.setDate(d.getDate() - d.getDay());
  } else if (p === "month") {
    d.setDate(1);
  }
  return d;
}

export interface PointEntry {
  driver_id: string;
  points: number;
  created_at: string;
}

export function sumPointsByDriver(entries: PointEntry[], since?: Date): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of entries) {
    if (since && new Date(e.created_at) < since) continue;
    map.set(e.driver_id, (map.get(e.driver_id) ?? 0) + (e.points || 0));
  }
  return map;
}