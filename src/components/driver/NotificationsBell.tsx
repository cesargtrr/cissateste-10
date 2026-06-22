import { useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useDriverNotifications } from "@/hooks/useDriverNotifications";
import { NOTIFICATION_LABEL } from "@/lib/driver-journey";

export function NotificationsBell({ driverId }: { driverId: string | null }) {
  const { notifications, unread, markRead, markAllRead } = useDriverNotifications(driverId);
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Notificações"
          className="relative text-[#D4A15A] hover:text-[#FF7A00]"
        >
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF7A00] text-[10px] font-bold text-black flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="bg-[#0d0907] border-[#3A2414] text-[#E7D3B1] w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-[#E7D3B1] flex items-center justify-between">
            Notificações
            {unread > 0 && (
              <Button size="sm" variant="ghost" onClick={markAllRead} className="text-[#D4A15A] hover:text-[#FF7A00]">
                <CheckCheck className="w-4 h-4 mr-1" /> Marcar tudo
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2 max-h-[calc(100vh-120px)] overflow-y-auto pr-1">
          {notifications.length === 0 ? (
            <p className="text-sm text-[#A3A3A3] text-center py-8">Nenhuma notificação por aqui.</p>
          ) : notifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-lg border p-3 ${n.read_at ? "border-[#3A2414] bg-transparent" : "border-[#FF7A00]/40 bg-[#FF7A00]/5"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-[#A3A3A3]">{NOTIFICATION_LABEL[n.kind]}</p>
                  <p className="text-sm font-semibold truncate">{n.title}</p>
                  {n.body && <p className="text-xs text-[#A3A3A3] mt-0.5">{n.body}</p>}
                  <p className="text-[10px] text-[#A3A3A3] mt-1">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
                </div>
                {!n.read_at && (
                  <Button size="sm" variant="ghost" onClick={() => markRead(n.id)} className="shrink-0 text-[#D4A15A] hover:text-[#FF7A00]">
                    <Check className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}