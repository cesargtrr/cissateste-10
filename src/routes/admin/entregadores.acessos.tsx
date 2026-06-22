import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Trash2, Bike, Loader2, Mail, Send, Power, PowerOff, Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { checkIsAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/entregadores/acessos")({
  component: AcessosPage,
});

type DriverUser = {
  id: string;
  restaurant_id: string;
  driver_id: string;
  email: string;
  user_id: string | null;
  active: boolean;
  created_at: string;
};

type Driver = { id: string; name: string; active: boolean };

function AcessosPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [authChecked, setAuthChecked] = useState(false);
  const [editing, setEditing] = useState<{ driver_id: string; email: string; active: boolean } | null>(null);

  useEffect(() => {
    (async () => {
      const { isAdmin } = await checkIsAdmin();
      if (!isAdmin) {
        navigate({ to: "/admin/login", replace: true });
        return;
      }
      setAuthChecked(true);
    })();
  }, [navigate]);

  const { data: restaurantId } = useQuery({
    queryKey: ["restaurant-id"],
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurant_settings")
        .select("id")
        .limit(1)
        .maybeSingle();
      return (data as any)?.id as string | undefined;
    },
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["delivery_drivers", restaurantId],
    enabled: !!restaurantId && authChecked,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_drivers" as any)
        .select("id, name, active")
        .eq("restaurant_id", restaurantId as string)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as Driver[];
    },
  });

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["delivery_driver_users", restaurantId],
    enabled: !!restaurantId && authChecked,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_driver_users" as any)
        .select("*")
        .eq("restaurant_id", restaurantId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as DriverUser[];
    },
  });

  const driverName = (id: string) => drivers.find((d) => d.id === id)?.name || "—";

  const handleSave = async () => {
    if (!editing || !restaurantId) return;
    const email = editing.email.trim().toLowerCase();
    if (!editing.driver_id) return toast.error("Selecione o entregador");
    if (!email || !email.includes("@")) return toast.error("Email inválido");
    try {
      const { error } = await supabase.from("delivery_driver_users" as any).insert({
        restaurant_id: restaurantId,
        driver_id: editing.driver_id,
        email,
        active: editing.active,
      });
      if (error) throw error;
      toast.success("Acesso criado");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["delivery_driver_users"] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    }
  };

  const sendInvite = async (acc: DriverUser) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(acc.email, {
        redirectTo: `${window.location.origin}/driver`,
      });
      if (error) throw error;
      toast.success(`Convite enviado para ${acc.email}`);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar convite");
    }
  };

  const toggleActive = async (acc: DriverUser) => {
    const { error } = await supabase
      .from("delivery_driver_users" as any)
      .update({ active: !acc.active })
      .eq("id", acc.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["delivery_driver_users"] });
  };

  const removeAcc = async (id: string) => {
    const { error } = await supabase.from("delivery_driver_users" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Acesso removido");
    qc.invalidateQueries({ queryKey: ["delivery_driver_users"] });
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-black text-[#E7D3B1] flex items-center justify-center">
        <Flame className="w-8 h-8 text-[#FF7A00] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-[#E7D3B1]">
      <header className="border-b border-[#3A2414] bg-[#0d0907]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/admin/entregas" className="flex items-center gap-1.5 text-xs text-[#D4A15A] hover:text-[#FF7A00]">
              <ArrowLeft className="w-4 h-4" /> Entregas
            </Link>
            <div className="h-5 w-px bg-[#3A2414]" />
            <div className="flex items-center gap-2">
              <Bike className="w-5 h-5 text-[#FF7A00]" />
              <h1 className="text-lg md:text-xl font-bold">Acessos dos Entregadores</h1>
            </div>
          </div>
          <Button
            onClick={() => setEditing({ driver_id: "", email: "", active: true })}
            className="bg-[#FF7A00] hover:bg-[#FF7A00]/90 text-black font-semibold"
          >
            <Plus className="w-4 h-4 mr-1" /> Novo
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-6">
        <div className="rounded-xl border border-[#3A2414] bg-[#0d0907] overflow-hidden">
          {isLoading ? (
            <div className="p-10 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#FF7A00]" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="p-10 text-center text-[#A3A3A3] text-sm">Nenhum acesso cadastrado.</div>
          ) : (
            <div className="divide-y divide-[#3A2414]/60">
              {accounts.map((acc) => (
                <div key={acc.id} className="px-4 py-3 flex items-center gap-3 hover:bg-[#1a1a1a]/60">
                  <div className="w-10 h-10 rounded-full bg-[#FF7A00]/15 border border-[#FF7A00]/30 flex items-center justify-center text-[#FF7A00]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{driverName(acc.driver_id)}</span>
                      {acc.active ? (
                        <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/40 text-[10px]">Ativo</Badge>
                      ) : (
                        <Badge className="bg-zinc-700/40 text-zinc-300 border-zinc-600/40 text-[10px]">Inativo</Badge>
                      )}
                      {acc.user_id ? (
                        <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/40 text-[10px]">Conta vinculada</Badge>
                      ) : (
                        <Badge className="bg-amber-600/20 text-amber-400 border-amber-600/40 text-[10px]">Aguardando 1º acesso</Badge>
                      )}
                    </div>
                    <div className="text-xs text-[#A3A3A3]">{acc.email}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => sendInvite(acc)}
                    className="text-[#D4A15A] hover:text-[#FF7A00] hover:bg-[#1a1a1a]"
                  >
                    <Send className="w-3.5 h-3.5 mr-1" /> Enviar Convite
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => toggleActive(acc)} className="text-[#D4A15A] hover:text-[#FF7A00] hover:bg-[#1a1a1a]">
                    {acc.active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => removeAcc(acc.id)} className="text-red-400 hover:text-red-300 hover:bg-[#1a1a1a]">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="bg-[#0d0907] border-[#3A2414] text-[#E7D3B1]">
          <DialogHeader>
            <DialogTitle className="text-[#FF7A00]">Novo Acesso de Entregador</DialogTitle>
            <DialogDescription className="text-[#A3A3A3]">
              Cadastre o email do entregador. Ele receberá um convite para criar a senha no primeiro acesso.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-[#D4A15A]">Entregador *</Label>
                <Select value={editing.driver_id} onValueChange={(v) => setEditing({ ...editing, driver_id: v })}>
                  <SelectTrigger className="bg-[#1a1a1a] border-[#3A2414]">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0d0907] border-[#3A2414] text-[#E7D3B1]">
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-[#D4A15A]">Email *</Label>
                <Input
                  type="email"
                  value={editing.email}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                  className="bg-[#1a1a1a] border-[#3A2414]"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#3A2414] px-3 py-2">
                <Label className="text-sm">Ativo</Label>
                <Switch checked={editing.active} onCheckedChange={(c) => setEditing({ ...editing, active: c })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} className="text-[#E7D3B1]">Cancelar</Button>
            <Button onClick={handleSave} className="bg-[#FF7A00] hover:bg-[#FF7A00]/90 text-black font-semibold">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}