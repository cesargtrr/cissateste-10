import { createFileRoute } from "@tanstack/react-router";
import { ServiceModeGate } from "@/components/oxente/ServiceModeGate";
import { OpeningStatusBanner } from "@/components/oxente/OpeningStatusBanner";
import { OpeningNoticeModal } from "@/components/oxente/OpeningNoticeModal";
import { DarkPremiumMenu } from "@/components/oxente/DarkPremiumMenu";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import React, { useEffect, useState, memo } from "react";
import { Navigate } from "@tanstack/react-router";
import { getActiveOrderId, clearActiveOrderId } from "@/lib/order-history";
import { supabase } from "@/integrations/supabase/client";
import { getFeaturedItems } from "@/lib/menu.functions";
import { setServiceMode } from "@/lib/service-mode-store";

function Index() {
  // undefined = still validating, null = no valid active order, string = redirect
  const [activeId, setActiveId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const id = getActiveOrderId();
    if (!id) {
      setActiveId(null);
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("id,status")
          .eq("id", id)
          .maybeSingle();
        if (cancelled) return;
        const status = (data?.status as string | undefined) ?? null;
        const isTerminal = status === "completed" || status === "cancelled";
        if (error || !data || isTerminal) {
          clearActiveOrderId();
          if (isTerminal) {
            // Comanda fechada — wipe table/session so the next customer starts clean.
            setServiceMode(null);
            try { localStorage.removeItem("oxente-cart-v1"); } catch {}
            try { sessionStorage.clear(); } catch {}
          }
          setActiveId(null);
          return;
        }
        setActiveId(id);
      } catch {
        if (cancelled) return;
        clearActiveOrderId();
        setActiveId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (activeId === undefined) {
    // Validating — render nothing briefly to avoid SSR mismatch / flash.
    return null;
  }

  if (activeId) {
    return <Navigate to="/pedido/$id" params={{ id: activeId }} replace />;
  }

  return (
    <ErrorBoundary 
      FallbackComponent={ErrorFallback}
      onError={(error: unknown) => reportLovableError(error, { boundary: "home_index" })}
    >
      <ServiceModeGate>
        <main className="min-h-screen bg-background font-sans selection:bg-primary selection:text-primary-foreground">
          <OpeningStatusBanner />
          <OpeningNoticeModal />
          <DarkPremiumMenu />
        </main>
      </ServiceModeGate>
    </ErrorBoundary>
  );
}

const MemoizedIndex = memo(Index);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CISSABURGER | O Sabor do Nordeste" },
      { name: "description", content: "Hamburgueria artesanal premium com sabor nordestino e estilo western moderno." },
      { property: "og:title", content: "CISSABURGER" },
      { property: "og:description", content: "Sabor que vem do Nordeste, siô!" },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: ["featuredItems"],
      queryFn: () => getFeaturedItems(),
    });
  },
  component: MemoizedIndex,
});

function ErrorFallback({ error }: FallbackProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-5 text-center">
      <div className="max-w-md space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Ops! Algo deu errado.</h1>
        <p className="text-muted-foreground text-sm">{(error as Error)?.message || "Erro desconhecido"}</p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-primary text-primary-foreground px-6 py-2 rounded-full font-bold"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

