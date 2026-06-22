export type BreakReason = "meal" | "rest" | "personal" | "vehicle" | "other";

export const BREAK_REASON_LABEL: Record<BreakReason, string> = {
  meal: "Refeição",
  rest: "Descanso",
  personal: "Pessoal",
  vehicle: "Veículo",
  other: "Outro",
};

export type NotificationKind =
  | "new_delivery"
  | "reassigned"
  | "delay_alert"
  | "inactivity"
  | "shift_reminder"
  | "customer_message";

export const NOTIFICATION_LABEL: Record<NotificationKind, string> = {
  new_delivery: "Nova entrega",
  reassigned: "Pedido reatribuído",
  delay_alert: "Alerta de atraso",
  inactivity: "Inatividade",
  shift_reminder: "Lembrete de turno",
  customer_message: "Mensagem do cliente",
};

export const WEEKDAY_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function formatHMS(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "00:00:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function formatHM(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "0min";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (!h) return `${m}min`;
  return m ? `${h}h ${m}min` : `${h}h`;
}

export type ShiftRow = {
  id: string;
  driver_id: string;
  restaurant_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
};

export type BreakRow = {
  id: string;
  shift_id: string;
  driver_id: string;
  restaurant_id: string;
  reason: BreakReason;
  notes: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
};

export function elapsedSeconds(fromIso: string, toIso?: string | null): number {
  const from = new Date(fromIso).getTime();
  const to = toIso ? new Date(toIso).getTime() : Date.now();
  return Math.max(0, Math.round((to - from) / 1000));
}

export function summarizeShift(shift: ShiftRow | null, breaks: BreakRow[]) {
  if (!shift) {
    return { worked: 0, paused: 0, active: 0, openBreak: null as BreakRow | null };
  }
  const worked = elapsedSeconds(shift.started_at, shift.ended_at);
  let paused = 0;
  let openBreak: BreakRow | null = null;
  for (const b of breaks) {
    if (b.ended_at) paused += b.duration_seconds ?? elapsedSeconds(b.started_at, b.ended_at);
    else { openBreak = b; paused += elapsedSeconds(b.started_at); }
  }
  return { worked, paused, active: Math.max(0, worked - paused), openBreak };
}