import { BREAK_REASON_LABEL, type BreakRow, elapsedSeconds, formatHM } from "@/lib/driver-journey";
import { Coffee, Pause } from "lucide-react";

export function BreaksList({ breaks }: { breaks: BreakRow[] }) {
  if (!breaks.length) {
    return <p className="text-sm text-[#A3A3A3] text-center py-6">Nenhuma pausa registrada no turno.</p>;
  }
  return (
    <ul className="divide-y divide-[#3A2414]/60">
      {breaks.map((b) => {
        const dur = b.duration_seconds ?? (b.ended_at ? elapsedSeconds(b.started_at, b.ended_at) : elapsedSeconds(b.started_at));
        return (
          <li key={b.id} className="py-3 flex items-start gap-3">
            <span className="mt-0.5 text-[#FF7A00]">{b.ended_at ? <Coffee className="w-4 h-4" /> : <Pause className="w-4 h-4 animate-pulse" />}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{BREAK_REASON_LABEL[b.reason]}</p>
                <span className="text-xs text-[#A3A3A3]">{formatHM(dur)}{!b.ended_at && " · em curso"}</span>
              </div>
              {b.notes && <p className="text-xs text-[#A3A3A3] mt-0.5">{b.notes}</p>}
              <p className="text-[10px] text-[#A3A3A3] mt-0.5">
                {new Date(b.started_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                {b.ended_at && ` → ${new Date(b.ended_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}