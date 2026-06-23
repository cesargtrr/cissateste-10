import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      if (!data.session) {
        for (let i = 0; i < 5; i++) {
          const { data: s } = await supabase.auth.getSession();
          if (s.session) break;
          await new Promise((r) => setTimeout(r, 100));
        }
      }

      const userId = data.user?.id;
      if (!userId) throw new Error("Sessão inválida");

      // Check admin first (admins keep access even if also linked as drivers).
      // Use the SECURITY DEFINER `has_role` RPC instead of selecting from
      // user_roles directly — the RPC is immune to the brief auth-header
      // propagation window right after signInWithPassword, which could
      // otherwise return null and incorrectly route the admin to signOut.
      const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role" as never, {
        _user_id: userId,
        _role: "admin",
      } as never);
      if (roleErr) {
        console.error("Admin role check failed during login:", roleErr);
        toast.error("Não foi possível validar sua permissão. Tente novamente.");
        return;
      }

      if (isAdmin === true) {
        toast.success("Login realizado");
        navigate({ to: "/admin" });
        return;
      }

      const { data: driver } = await supabase
        .from("delivery_drivers" as any)
        .select("id, active")
        .eq("user_id", userId)
        .maybeSingle();

      if (driver) {
        if (!(driver as any).active) {
          toast.error("Conta de entregador desativada");
          return;
        }
        toast.success("Bem-vindo!");
        navigate({ to: "/driver" });
        return;
      }

      toast.error("Conta sem permissão de acesso");
    } catch (err: any) {
      toast.error(err.message || "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error("Informe o email"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/driver`,
      });
      if (error) throw error;
      toast.success("Email de recuperação enviado");
      setMode("login");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-5">
      <div className="w-full max-w-sm bg-[#121212] border border-[#3A2414] rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-[#D4A15A]">Admin CISSABURGER</h1>
        <p className="text-sm text-[#A3A3A3] mt-1 mb-6">
          {mode === "login" ? "Entre na sua conta" : "Recuperar senha"}
        </p>
        {mode === "login" ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-[#E7D3B1]">Email</Label>
            <Input id="email" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-[#1a1a1a] border-[#3A2414] text-[#E7D3B1] mt-1" />
          </div>
          <div>
            <Label htmlFor="password" className="text-[#E7D3B1]">Senha</Label>
            <Input id="password" type="password" required minLength={6} value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-[#1a1a1a] border-[#3A2414] text-[#E7D3B1] mt-1" />
          </div>
          <Button type="submit" disabled={loading}
            className="w-full bg-[#FF7A00] hover:bg-[#D97706] text-black font-bold">
            {loading ? "..." : "Entrar"}
          </Button>
          <button type="button" onClick={() => setMode("forgot")}
            className="block w-full text-center text-xs text-[#D4A15A] hover:text-[#FF7A00]">
            Esqueci minha senha
          </button>
        </form>
        ) : (
        <form onSubmit={handleForgot} className="space-y-4">
          <div>
            <Label htmlFor="email-r" className="text-[#E7D3B1]">Email</Label>
            <Input id="email-r" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-[#1a1a1a] border-[#3A2414] text-[#E7D3B1] mt-1" />
          </div>
          <Button type="submit" disabled={loading}
            className="w-full bg-[#FF7A00] hover:bg-[#D97706] text-black font-bold">
            {loading ? "..." : "Enviar link"}
          </Button>
          <button type="button" onClick={() => setMode("login")}
            className="block w-full text-center text-xs text-[#D4A15A] hover:text-[#FF7A00]">
            ← Voltar ao login
          </button>
        </form>
        )}
        <Link to="/" className="block text-center text-xs text-[#A3A3A3] mt-6 hover:text-[#E7D3B1]">
          ← Voltar para o site
        </Link>
      </div>
    </div>
  );
}