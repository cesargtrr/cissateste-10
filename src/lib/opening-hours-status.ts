import type { OpeningHour } from "./opening-hours.functions";

const DAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export type OpenStatus = {
  isOpen: boolean;
  message: string;
};

export function computeOpenStatus(
  hours: OpeningHour[],
  forceClosed: boolean,
  now: Date = new Date(),
): OpenStatus {
  const byDay = new Map(hours.map((h) => [h.day_of_week, h]));
  const today = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const todayHrs = byDay.get(today);

  if (!forceClosed && todayHrs && !todayHrs.is_closed) {
    const open = toMinutes(todayHrs.open_time);
    const close = toMinutes(todayHrs.close_time);
    if (nowMin >= open && nowMin < close) {
      return { isOpen: true, message: `Aberto agora · até ${todayHrs.close_time}` };
    }
    if (nowMin < open) {
      return {
        isOpen: false,
        message: `Loja Fechada no momento, abre hoje às ${todayHrs.open_time}`,
      };
    }
  }

  // closed for today (force-closed, no schedule, or past close) → find next open day
  for (let i = 1; i <= 7; i++) {
    const d = (today + i) % 7;
    const h = byDay.get(d);
    if (h && !h.is_closed) {
      const dayLabel = i === 1 ? "amanhã" : DAY_NAMES[d];
      return {
        isOpen: false,
        message: `Loja Fechada no momento, abre ${dayLabel} às ${h.open_time}`,
      };
    }
  }
  return { isOpen: false, message: "Loja Fechada no momento" };
}