import { createFileRoute } from "@tanstack/react-router";
import { OxenteHero } from "@/components/oxente/Hero";
import { OxenteLocalizacao } from "@/components/oxente/Localizacao";
import { OxenteProdutos } from "@/components/oxente/Produtos";
import { ServiceModeGate } from "@/components/oxente/ServiceModeGate";
import { OpeningStatusBanner } from "@/components/oxente/OpeningStatusBanner";
import { OpeningNoticeModal } from "@/components/oxente/OpeningNoticeModal";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import React, { Suspense, useEffect, useState, memo } from "react";
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
        <main className="bg-[#121212] min-h-screen font-sans selection:bg-[#FF7A00] selection:text-[#121212]">
          <OpeningStatusBanner />
          <OpeningNoticeModal />
          <OxenteHero />
          <Suspense fallback={<div className="h-96 flex items-center justify-center text-[#A3A3A3]">Carregando produtos...</div>}>
            <OxenteProdutos />
          </Suspense>
          <OxenteLocalizacao />
        </main>
      </ServiceModeGate>
    </ErrorBoundary>
  );
}

const MemoizedIndex = memo(Index);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CISSABURGUER | O Sabor do Nordeste" },
      { name: "description", content: "Hamburgueria artesanal premium com sabor nordestino e estilo western moderno." },
      { property: "og:title", content: "CISSABURGUER" },
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
    <div className="flex min-h-screen items-center justify-center bg-[#121212] p-5 text-center">
      <div className="max-w-md space-y-4">
        <h1 className="text-2xl font-bold text-[#E7D3B1]">Ops! Algo deu errado.</h1>
        <p className="text-[#A3A3A3] text-sm">{(error as Error)?.message || "Erro desconhecido"}</p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-[#FF7A00] text-[#121212] px-6 py-2 rounded-full font-bold"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

