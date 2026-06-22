import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Lock } from "lucide-react";

export const Route = createFileRoute("/driver/profile")({
  component: DriverProfile,
});

function DriverProfile() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        navigate({ to: "/admin/login", replace: true });
        return;
      }
      setEmail(data.user.email || "");
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 6) { toast.error("Senha mínima de 6 caracteres"); return; }
    if (next !== confirm) { toast.error("Senhas não conferem"); return; }
    setBusy(true);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email, password: current,
      });
      if (signInErr) throw new Error("Senha atual incorreta");

      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;

      toast.success("Senha alterada com sucesso");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao alterar senha");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-[#E7D3B1] px-4 py-6">
      <div className="max-w-md mx-auto">
        <Link to="/driver" className="inline-flex items-center gap-1.5 text-xs text-[#D4A15A] hover:text-[#FF7A00] mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="bg-[#0d0907] border border-[#3A2414] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-5 h-5 text-[#FF7A00]" />
            <h1 className="text-xl font-bold">Meu Perfil</h1>
          </div>
          <p className="text-sm text-[#A3A3A3] mb-5">{email}</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label className="text-xs text-[#D4A15A]">Senha atual</Label>
              <Input type="password" required value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="bg-[#1a1a1a] border-[#3A2414]" />
            </div>
            <div>
              <Label className="text-xs text-[#D4A15A]">Nova senha</Label>
              <Input type="password" required minLength={6} value={next}
                onChange={(e) => setNext(e.target.value)}
                className="bg-[#1a1a1a] border-[#3A2414]" />
            </div>
            <div>
              <Label className="text-xs text-[#D4A15A]">Confirmar nova senha</Label>
              <Input type="password" required minLength={6} value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="bg-[#1a1a1a] border-[#3A2414]" />
            </div>
            <Button type="submit" disabled={busy}
              className="w-full bg-[#FF7A00] hover:bg-[#D97706] text-black font-bold">
              {busy ? "Alterando..." : "Alterar Senha"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}