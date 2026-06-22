import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Megaphone, ExternalLink } from "lucide-react";
import { getRestaurantSettings } from "@/lib/settings.functions";
import { useStoreOpenStatus } from "./OpeningStatusBanner";

const SESSION_KEY = "oxente:opening-notice-dismissed-day";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * "Aviso Importante" — modal exibido automaticamente para o cliente quando
 * a loja transiciona para o status Aberta (ou já está aberta no primeiro
 * carregamento do dia). Dispensa por sessão/dia para não incomodar.
 */
export const OpeningNoticeModal = () => {
  const status = useStoreOpenStatus();
  const { data: settings } = useQuery({
    queryKey: ["restaurant-settings"],
    queryFn: () => getRestaurantSettings(),
    staleTime: 60_000,
  });
  const [open, setOpen] = useState(false);

  const ativo = Boolean(settings?.aviso_ativo);
  const titulo = (settings?.aviso_titulo || "").trim();
  const mensagem = (settings?.aviso_mensagem || "").trim();
  const link = (settings?.aviso_link || "").trim();

  useEffect(() => {
    if (!ativo || !status?.isOpen) return;
    if (!titulo && !mensagem && !link) return;
    try {
      const dismissed = sessionStorage.getItem(SESSION_KEY);
      if (dismissed === todayKey()) return;
    } catch {}
    setOpen(true);
  }, [ativo, status?.isOpen, titulo, mensagem, link]);

  const close = () => {
    setOpen(false);
    try { sessionStorage.setItem(SESSION_KEY, todayKey()); } catch {}
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-5"
      onClick={close}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md bg-[#121212] border border-[#D4A15A]/40 rounded-2xl shadow-2xl shadow-black overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#3A2414] bg-gradient-to-r from-[#D4A15A]/10 to-transparent">
          <div className="flex items-center gap-2 text-[#D4A15A]">
            <Megaphone className="w-5 h-5" />
            <span className="uppercase text-[11px] font-bold tracking-widest">Aviso Importante</span>
          </div>
          <button onClick={close} className="text-[#A3A3A3] hover:text-[#E7D3B1] p-1" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-3">
          {titulo && <h2 className="text-xl font-bold text-[#E7D3B1] leading-tight">{titulo}</h2>}
          {mensagem && (
            <p className="text-sm text-[#E7D3B1]/80 leading-relaxed whitespace-pre-line">{mensagem}</p>
          )}
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-2 bg-[#D4A15A] hover:bg-[#c0904a] text-[#121212] font-bold rounded-full px-5 py-2.5 text-sm uppercase tracking-wide transition-colors"
              onClick={close}
            >
              Acessar agora <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
        <div className="px-6 pb-5">
          <button
            onClick={close}
            className="w-full text-xs text-[#A3A3A3] hover:text-[#E7D3B1] py-2"
          >
            Continuar para o cardápio
          </button>
        </div>
      </div>
    </div>
  );
};