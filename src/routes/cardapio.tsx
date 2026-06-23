import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { getMenuData } from "@/lib/menu.functions";
import { OpeningStatusBanner } from "@/components/oxente/OpeningStatusBanner";
import { OpeningNoticeModal } from "@/components/oxente/OpeningNoticeModal";
import { DarkPremiumMenu } from "@/components/oxente/DarkPremiumMenu";

export const Route = createFileRoute("/cardapio")({
  component: CardapioPage,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: ["menuData"],
      queryFn: () => getMenuData(),
    });
  },
});

function CardapioPage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
      <OpeningStatusBanner />
      <OpeningNoticeModal />
      <DarkPremiumMenu showBack />
    </div>
  );
}
