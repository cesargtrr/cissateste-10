import { Outlet, createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Flame } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const location = useLocation();
  const [status, setStatus] = useState<"loading" | "authorized" | "unauthorized">("loading");
  const [validatedPath, setValidatedPath] = useState<string | null>(null);
  const lastEvaluatedUserRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const currentPath = location.pathname;

    // Don't gate the login page itself.
    if (currentPath === "/admin/login") {
      setStatus("authorized");
      setValidatedPath(currentPath);
      return;
    }

    setStatus("loading");
    setValidatedPath(null);

    const resolveSession = async () => {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) return session as { user: { id: string } };
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return null;
    };

    const evaluate = async () => {
      try {
        const session = await resolveSession();
        if (!mounted) return;

        if (!session) {
          lastEvaluatedUserRef.current = null;
          console.log("Sessão:", null);
          console.log("Usuário:", undefined);
          console.log("Perfil:", null);
          console.log("Role:", null);
          console.log("Path atual:", currentPath);
          setStatus("unauthorized");
          setValidatedPath(currentPath);
          return;
        }

        lastEvaluatedUserRef.current = session.user.id;
        const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
          _user_id: session.user.id,
          _role: "admin",
        });
        if (roleError) throw roleError;
        if (!mounted) return;
        console.log("Sessão:", { active: true });
        console.log("Usuário:", { id: session?.user?.id });
        console.log("Perfil:", { role: isAdmin === true ? "admin" : null });
        console.log("Role:", isAdmin === true ? "admin" : null);
        console.log("Path atual:", currentPath);

        if (isAdmin === true) {
          setStatus("authorized");
          setValidatedPath(currentPath);
          return;
        }
        // Not admin — show unauthorized. Do NOT auto-redirect to /driver,
        // since admins with a legacy driver row would be wrongly bounced.
        setStatus("unauthorized");
        setValidatedPath(currentPath);
      } catch (error) {
        console.error("Auth check failed:", error);
        if (mounted) {
          setStatus("unauthorized");
          setValidatedPath(currentPath);
        }
      }
    };

    void evaluate();

    // Safety net: never let the loader hang forever. If after 8s we still
    // don't have a resolution, fall through to unauthorized so the user is
    // redirected to /admin/login instead of staring at a black screen.
    const safetyTimer = window.setTimeout(() => {
      if (!mounted) return;
      setStatus((s) => (s === "loading" ? "unauthorized" : s));
      setValidatedPath((p) => p ?? currentPath);
    }, 8000);

    // Keep this listener synchronous; auth-dependent async work is done in
    // the explicit validation above to avoid auth initialization races.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT") {
        lastEvaluatedUserRef.current = null;
        setStatus("unauthorized");
        setValidatedPath(currentPath);
        return;
      }
      // Only re-evaluate when a DIFFERENT user signs in. Supabase fires
      // SIGNED_IN on every tab focus / token refresh with the same user,
      // which used to flicker the loader and could re-trigger an in-flight
      // evaluation, leaving the screen blank.
      if (event === "SIGNED_IN" && session?.user?.id &&
          lastEvaluatedUserRef.current !== session.user.id) {
        setStatus("loading");
        setValidatedPath(null);
        void evaluate();
      }
    });

    return () => {
      mounted = false;
      window.clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const isCurrentPathValidated = validatedPath === location.pathname;

  if (status === "loading" || !isCurrentPathValidated) {
    return (
      <div className="min-h-screen bg-[#000000] text-[#E7D3B1] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Flame className="w-10 h-10 text-[#FF7A00] animate-pulse" />
          <p className="text-[#D4A15A] font-medium tracking-widest uppercase text-xs">
            Verificando Credenciais...
          </p>
        </div>
      </div>
    );
  }

  if (status === "unauthorized" && location.pathname !== "/admin/login") {
    // Defer navigation to an effect to avoid setState-during-render warnings.
    return <RedirectToLogin />;
  }

  return <Outlet />;
}

function RedirectToLogin() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/admin/login", replace: true });
  }, [navigate]);
  return null;
}