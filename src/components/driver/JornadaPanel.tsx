import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, LogIn, LogOut, Pause, Play, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  BREAK_REASON_LABEL, type BreakReason, type BreakRow, type ShiftRow,
  formatHMS, summarizeShift,
} from "@/lib/driver-journey";
import { BreaksList } from "@/components/driver/BreaksList";

export function JornadaPanel({ driverId, restaurantId }: { driverId: string; restaurantId: string | null }) {
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [breakOpen, setBreakOpen] = useState(false);
  const [reason, setReason] = useState<BreakReason>("rest");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const shiftQ = useQuery({
    queryKey: ["driver-active-shift", driverId],
    queryFn: async (): Promise<ShiftRow | null> => {
      const { data, error } = await supabase
        .from("driver_shifts" as never)
        .select("*")
        .eq("driver_id", driverId)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as ShiftRow | null;
    },
  });

  const shift = shiftQ.data ?? null;

  const breaksQ = useQuery({
    queryKey: ["driver-breaks", shift?.id ?? null],
    enabled: !!shift?.id,
    queryFn: async (): Promise<BreakRow[]> => {
      const { data, error } = await supabase
        .from("driver_breaks" as never)
        .select("*")
        .eq("shift_id", shift!.id)
        .order("started_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as BreakRow[];
    },
  });

  useEffect(() => {
    if (!driverId) return;
    const ch = supabase
      .channel(`driver-jornada-${driverId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_shifts", filter: `driver_id=eq.${driverId}` },
        () => qc.invalidateQueries({ queryKey: ["driver-active-shift", driverId] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_breaks", filter: `driver_id=eq.${driverId}` },
        () => qc.invalidateQueries({ queryKey: ["driver-breaks"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [driverId, qc]);

  const summary = useMemo(
    () => summarizeShift(shift, breaksQ.data ?? []),
    // recompute every tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shift, breaksQ.data, now],
  );

  const clockIn = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error("Restaurante não identificado");
      const { error } = await supabase
        .from("driver_shifts" as never)
        .insert({ driver_id: driverId, restaurant_id: restaurantId, started_at: new Date().toISOString() } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Turno iniciado"); qc.invalidateQueries({ queryKey: ["driver-active-shift", driverId] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao iniciar turno"),
  });

  const clockOut = useMutation({
    mutationFn: async () => {
      if (!shift) throw new Error("Sem turno aberto");
      if (summary.openBreak) throw new Error("Encerre a pausa antes de finalizar o turno");
      const endedAt = new Date().toISOString();
      const duration = Math.max(0, Math.round((Date.now() - new Date(shift.started_at).getTime()) / 1000));
      const { error } = await supabase
        .from("driver_shifts" as never)
        .update({ ended_at: endedAt, duration_seconds: duration } as never)
        .eq("id", shift.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Turno encerrado"); qc.invalidateQueries({ queryKey: ["driver-active-shift", driverId] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao encerrar turno"),
  });

  const startBreak = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("start_break" as never, {
        _reason: reason,
        _notes: notes.trim() || null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pausa iniciada"); setBreakOpen(false); setNotes(""); qc.invalidateQueries({ queryKey: ["driver-breaks"] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao iniciar pausa"),
  });

  const endBreak = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("end_break" as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pausa encerrada"); qc.invalidateQueries({ queryKey: ["driver-breaks"] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao encerrar pausa"),
  });

  const onPause = !!summary.openBreak;

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-[#3A2414] bg-[#0d0907] p-4 md:p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[#A3A3A3]">Status do turno</p>
            <h2 className="text-xl font-bold mt-1">
              {shift ? (onPause ? "Em pausa" : "Em serviço") : "Fora do turno"}
            </h2>
            {shift && (
              <p className="text-xs text-[#A3A3A3] mt-1">
                Início: {new Date(shift.started_at).toLocaleString("pt-BR")}
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {!shift && (
              <Button onClick={() => clockIn.mutate()} disabled={clockIn.isPending} className="bg-[#FF7A00] text-black hover:bg-[#FF9233]">
                {clockIn.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <LogIn className="w-4 h-4 mr-1" />}
                Iniciar turno
              </Button>
            )}
            {shift && !onPause && (
              <>
                <Button onClick={() => setBreakOpen(true)} variant="secondary" className="bg-[#3A2414] hover:bg-[#4A3424] text-[#E7D3B1]">
                  <Pause className="w-4 h-4 mr-1" /> Pausar
                </Button>
                <Button onClick={() => clockOut.mutate()} disabled={clockOut.isPending} variant="destructive">
                  {clockOut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <LogOut className="w-4 h-4 mr-1" />}
                  Encerrar turno
                </Button>
              </>
            )}
            {shift && onPause && (
              <Button onClick={() => endBreak.mutate()} disabled={endBreak.isPending} className="bg-[#FF7A00] text-black hover:bg-[#FF9233]">
                {endBreak.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                Retomar
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4">
          <KPI label="Trabalhado" value={formatHMS(summary.worked)} />
          <KPI label="Pausa" value={formatHMS(summary.paused)} />
          <KPI label="Ativo" value={formatHMS(summary.active)} icon={<Timer className="w-3 h-3" />} />
        </div>
      </div>

      <div className="rounded-xl border border-[#3A2414] bg-[#0d0907] p-4 md:p-5">
        <h3 className="text-sm font-bold text-[#D4A15A] mb-2">Pausas do turno</h3>
        <BreaksList breaks={breaksQ.data ?? []} />
      </div>

      <Dialog open={breakOpen} onOpenChange={setBreakOpen}>
        <DialogContent className="bg-[#0d0907] border-[#3A2414] text-[#E7D3B1]">
          <DialogHeader>
            <DialogTitle>Iniciar pausa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[#A3A3A3]">Motivo</label>
              <Select value={reason} onValueChange={(v) => setReason(v as BreakReason)}>
                <SelectTrigger className="bg-black border-[#3A2414] text-[#E7D3B1]"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#0d0907] border-[#3A2414] text-[#E7D3B1]">
                  {(Object.keys(BREAK_REASON_LABEL) as BreakReason[]).map((r) => (
                    <SelectItem key={r} value={r}>{BREAK_REASON_LABEL[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-[#A3A3A3]">Observação (opcional)</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="bg-black border-[#3A2414] text-[#E7D3B1]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBreakOpen(false)}>Cancelar</Button>
            <Button onClick={() => startBreak.mutate()} disabled={startBreak.isPending} className="bg-[#FF7A00] text-black hover:bg-[#FF9233]">
              {startBreak.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Pause className="w-4 h-4 mr-1" />}
              Iniciar pausa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function KPI({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#3A2414] bg-black/40 p-3">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[#A3A3A3]">{icon}{label}</div>
      <div className="mt-1 text-lg font-bold font-mono">{value}</div>
    </div>
  );
}