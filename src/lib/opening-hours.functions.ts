import { supabase } from "@/integrations/supabase/client";

export type OpeningHour = {
  day_of_week: number;
  open_time: string; // HH:MM
  close_time: string;
  is_closed: boolean;
};

function normalize(t: string): string {
  return t.slice(0, 5);
}

export const listOpeningHours = async () => {
  const { data, error } = await supabase
    .from("opening_hours")
    .select("day_of_week, open_time, close_time, is_closed")
    .order("day_of_week");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    day_of_week: r.day_of_week as number,
    open_time: normalize(String(r.open_time)),
    close_time: normalize(String(r.close_time)),
    is_closed: Boolean(r.is_closed),
  })) as OpeningHour[];
};

export const updateOpeningHours = async (data: {
  hours: {
    day_of_week: number;
    open_time: string;
    close_time: string;
    is_closed: boolean;
  }[];
}) => {
  for (const h of data.hours) {
    const { error } = await supabase
      .from("opening_hours")
      .update({
        open_time: h.open_time,
        close_time: h.close_time,
        is_closed: h.is_closed,
      } as any)
      .eq("day_of_week", h.day_of_week);
    if (error) throw new Error(error.message);
  }
  return { ok: true };
};
