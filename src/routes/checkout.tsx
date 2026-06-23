import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bike, ShoppingBag, QrCode as QrIcon, CreditCard, Wallet, Copy, Check, Banknote, CreditCard as CardIcon, Loader2, CheckCircle2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCart, clearCart, formatBRL } from "@/lib/cart-store";
import { useServiceMode, setServiceMode } from "@/lib/service-mode-store";
import {
  createOrder,
  getRestaurantSettings,
  listNeighborhoods,
} from "@/lib/settings.functions";
import { useQuery } from "@tanstack/react-query";
import { saveOrder, setActiveOrderId } from "@/lib/order-history";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildStaticBrCode, isValidBrCode } from "@/lib/pix-brcode";
import { getCustomerProfile, saveCustomerProfile } from "@/lib/customer-profile";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — CISSABURGER" },
      { name: "description", content: "Finalize seu pedido com segurança." },
    ],
  }),
  component: CheckoutPage,
});

type PaymentType = "pix" | "cash" | "card_delivery" | "card_pickup";

function CheckoutPage() {
  const navigate = useNavigate();
  const { items, total: subtotal } = useCart();
  const mode = useServiceMode();

  const isMesa = mode?.kind === "mesa";

  const [kind, setKind] = useState<"delivery" | "retirada">(
    mode?.kind === "retirada" ? "retirada" : "delivery",
  );
  const savedProfile = typeof window !== "undefined" ? getCustomerProfile() : null;
  const [name, setName] = useState(savedProfile?.name ?? mode?.customerName ?? "");
  const [whatsapp, setWhatsapp] = useState(savedProfile?.phone ?? "");
  const OTHER_NEIGHBORHOOD = "__other__";
  const [neighborhoodId, setNeighborhoodId] = useState<string>("");
  const [customNeighborhood, setCustomNeighborhood] = useState(savedProfile?.address?.neighborhood ?? "");
  const [rua, setRua] = useState(savedProfile?.address?.street ?? (mode?.kind === "delivery" ? mode.address : ""));
  const [numero, setNumero] = useState(savedProfile?.address?.number ?? "");
  const [complemento, setComplemento] = useState(
    savedProfile?.address?.complement ?? (mode?.kind === "delivery" ? mode.reference : ""),
  );
  
  // Novos estados de pagamento
  const [paymentType, setPaymentType] = useState<PaymentType>("pix");
  const [cardType, setCardType] = useState<"debit" | "credit">("debit");
  const [needsChange, setNeedsChange] = useState(false);
  const [changeFor, setChangeFor] = useState("");
  
  const [orderId, setOrderId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pixTx, setPixTx] = useState<{
    transaction_id: string;
    qr_code: string | null;
    pix_copy_paste: string | null;
    status: string;
  } | null>(null);
  const [pixLoading, setPixLoading] = useState(false);
  const [pixError, setPixError] = useState<string | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [finalTotal, setFinalTotal] = useState<number>(0);

  const { data: settings } = useQuery({
    queryKey: ["restaurant-settings"],
    queryFn: () => getRestaurantSettings(),
  });
  
  const { data: neighborhoods = [] } = useQuery({
    queryKey: ["delivery-neighborhoods"],
    queryFn: () => listNeighborhoods(),
  });

  const serviceContext: "delivery" | "pickup" | "dine_in" =
    isMesa ? "dine_in" : kind === "retirada" ? "pickup" : "delivery";

  const { data: activePaymentMethods = [] } = useQuery({
    queryKey: ["payment-methods", "active", serviceContext],
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      return (data || []).filter((m: any) => {
        const list = (m.available_for as string[] | null) ?? ["delivery", "pickup"];
        return list.includes(serviceContext);
      });
    },
  });

  const { data: pixSettings } = useQuery({
    queryKey: ["payment-pix-settings", "active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_pix_settings")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: mpProvider } = useQuery({
    queryKey: ["payment-provider", "mercadopago"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_provider_settings")
        .select("active")
        .eq("provider", "mercadopago")
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
  const mercadopagoActive = !!mpProvider?.active;

  const defaultFee = Number((settings as any)?.default_neighborhood_fee ?? 15);
  const selectedNeighborhood = neighborhoods.find((n) => n.id === neighborhoodId);
  const isOther = neighborhoodId === OTHER_NEIGHBORHOOD;
  const neighborhoodFee = selectedNeighborhood ? selectedNeighborhood.fee : (isOther ? defaultFee : 0);
  const bairroLabel = selectedNeighborhood ? selectedNeighborhood.name : (isOther ? customNeighborhood.trim() : "");
  const deliveryFee = kind === "delivery" ? neighborhoodFee : 0;
  const total = subtotal + deliveryFee;

  // Apenas o código real retornado pelo Mercado Pago é considerado válido.
  const activePixCode = pixTx?.pix_copy_paste ?? "";

  useEffect(() => {
    if (items.length === 0 && !orderId) {
      navigate({ to: "/cardapio" });
    }
  }, [items.length, navigate, orderId]);

  // Reset payment when methods load or context changes
  useEffect(() => {
    if (activePaymentMethods.length > 0) {
      const exists = activePaymentMethods.some(m => m.type === paymentType);
      if (!exists) {
        setPaymentType(activePaymentMethods[0].type as PaymentType);
      }
    }
  }, [activePaymentMethods, serviceContext]);

  const handleCopy = async () => {
    if (!activePixCode) {
      toast.error("Código PIX indisponível");
      return;
    }
    try {
      await navigator.clipboard.writeText(activePixCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Código PIX copiado!");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  // Real-time confirmation while on PIX screen
  useEffect(() => {
    if (!pixTx?.transaction_id) return;
    const channel = supabase
      .channel(`pix-tx-${pixTx.transaction_id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "payment_transactions",
          filter: `id=eq.${pixTx.transaction_id}`,
        },
        (payload: any) => {
          const status = payload?.new?.status;
          if (status === "paid") {
            setPaymentConfirmed(true);
            toast.success("Pagamento confirmado!");
            setTimeout(() => {
              if (orderId) navigate({ to: "/pedido/$id", params: { id: orderId } });
            }, 1800);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [pixTx?.transaction_id, orderId, navigate]);

  const tryStaticFallback = (orderRef: string, amount: number) => {
    const cfg: any = pixSettings;
    const saved = (cfg?.static_pix_code ?? "").trim();
    if (isValidBrCode(saved)) {
      setPixTx({
        transaction_id: `static-${orderRef}`,
        qr_code: null,
        pix_copy_paste: saved,
        status: "awaiting_pix",
      });
      return;
    }
    if (cfg?.pix_key) {
      const brcode = buildStaticBrCode({
        pixKey: cfg.pix_key,
        keyType: cfg.pix_key_type,
        receiverName: cfg.receiver_name,
        city: cfg.city,
        amount,
        txid: orderRef.replace(/-/g, "").slice(0, 25),
      });
      if (brcode) {
        setPixTx({
          transaction_id: `static-${orderRef}`,
          qr_code: null,
          pix_copy_paste: brcode,
          status: "awaiting_pix",
        });
        return;
      }
    }
    setPixError("Erro ao gerar cobrança PIX. Por favor, tente novamente ou escolha outra forma de pagamento.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Informe seu nome");
    if (!isMesa && !whatsapp.trim()) return toast.error("Informe seu WhatsApp");
    if (!isMesa && kind === "delivery") {
      if (!neighborhoodId) return toast.error("Selecione o bairro de entrega");
      if (isOther && !customNeighborhood.trim()) return toast.error("Informe o nome do seu bairro");
      if (!rua || !numero) return toast.error("Preencha o endereço de entrega");
    }
    
    if (paymentType === "cash" && needsChange && (!changeFor || Number(changeFor) <= total)) {
      return toast.error("Informe um valor de troco válido (maior que o total)");
    }

    setSubmitting(true);
    try {
      const orderItems = items.map((i) => ({
        menu_item_id: typeof i.id === "string" ? i.id : null,
        name: i.name,
        quantity: i.qty,
        unit_price: i.price,
        notes: i.notes ?? null,
        extras: (i.extras || []).filter((e) => e.qty > 0).map(e => ({ id: e.id, name: e.name, price: e.price, qty: e.qty })),
      }));

      const paymentDetails: any = {
        type: paymentType,
      };

      if (paymentType === "card_delivery") {
        paymentDetails.card_type = cardType;
      }

      // Para PIX Estático (Mercado Pago desativado) usamos "aguardando_pagamento"
      // até a loja confirmar manualmente. Para PIX automático mantemos "aguardando_pix".
      const statusFinanceiro =
        paymentType === "pix"
          ? (mercadopagoActive ? "aguardando_pix" : "aguardando_pagamento")
          : "pendente";

      const orderPayload: any = {
        customer_name: name,
        customer_whatsapp: whatsapp,
        source: kind === "delivery" ? "delivery" : "online",
        payment_method: paymentType === "pix" ? "pix" : (paymentType === "cash" ? "cash" : "card"),
        total_amount: total,
        delivery_address: kind === "delivery" ? `${rua}, ${numero} — ${bairroLabel}` : null,
        delivery_reference: kind === "delivery" ? complemento || null : null,
        delivery_fee: kind === "delivery" ? deliveryFee : 0,
        items: orderItems,
        payment_details: paymentDetails,
        needs_change: paymentType === "cash" ? needsChange : false,
        change_for: (paymentType === "cash" && needsChange) ? Number(changeFor) : 0,
        status_financeiro: statusFinanceiro
      };

      // Captura o total do pedido ANTES de qualquer side-effect que possa
      // limpar o carrinho e fazer com que `total` (derivado de subtotal) volte a 0.
      const orderTotal = total;
      const res = await createOrder(orderPayload);
      setOrderId(res.id);
      saveOrder({ id: res.id, createdAt: new Date().toISOString(), total: orderTotal });
      saveCustomerProfile({
        name,
        phone: whatsapp,
        address: kind === "delivery" ? {
          street: rua,
          number: numero,
          complement: complemento,
          neighborhood: bairroLabel,
          neighborhoodId: neighborhoodId && neighborhoodId !== OTHER_NEIGHBORHOOD ? neighborhoodId : undefined,
        } : undefined,
      });
      setActiveOrderId(res.id);
      setFinalTotal(orderTotal);
      clearCart();

      if (paymentType !== "pix") {
        toast.success("Pedido enviado!");
        navigate({ to: "/pedido/$id", params: { id: res.id } });
      } else {
        setPixError(null);
        if (!mercadopagoActive) {
          toast.success("Pedido criado!");
          tryStaticFallback(res.id, orderTotal);
        } else {
        toast.success("Pedido criado! Gerando PIX...");
        setPixLoading(true);
        try {
          const { data, error } = await supabase.functions.invoke("mercadopago-create-pix", {
            body: { order_id: res.id, amount: orderTotal },
          });
          if (error) throw error;
          if (data?.fallback || data?.error) {
            console.error("[PIX] gateway error", data?.error);
            tryStaticFallback(res.id, orderTotal);
          } else if (data?.transaction_id && (data?.qr_code || data?.pix_copy_paste)) {
            setPixTx({
              transaction_id: data.transaction_id,
              qr_code: data.qr_code ?? null,
              pix_copy_paste: data.pix_copy_paste ?? null,
              status: data.status ?? "awaiting_pix",
            });
          } else {
            console.error("[PIX] resposta sem QR Code", data);
            tryStaticFallback(res.id, orderTotal);
          }
        } catch (e: any) {
          console.error("[PIX] invoke error", e);
          tryStaticFallback(res.id, orderTotal);
        } finally {
          setPixLoading(false);
        }
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar pedido");
    } finally {
      setSubmitting(false);
    }
  };

  if (orderId && paymentType === "pix") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#E7D3B1] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#121212] border border-[#3A2414] rounded-2xl p-8 text-center space-y-6">
          {paymentConfirmed ? (
            <>
              <div className="bg-green-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-green-500">Pagamento Confirmado</h1>
                <p className="text-[#A3A3A3] text-sm mt-2">Redirecionando para o acompanhamento...</p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-[#FF7A00]/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                <QrIcon className="w-10 h-10 text-[#FF7A00]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Pedido #{orderId.slice(0, 4).toUpperCase()}</h1>
                <p className="text-[#A3A3A3] text-sm mt-2">
                  1. Abra seu app do banco<br />
                  2. Escaneie o QR Code ou use o PIX Copia e Cola<br />
                  3. Após efetuar o pagamento, acompanhe o pedido pelo botão abaixo.
                </p>
              </div>

              {pixError ? (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  {pixError}
                </div>
              ) : (
                <>
                  <div className="bg-white p-4 rounded-xl w-48 h-48 mx-auto flex items-center justify-center shadow-2xl overflow-hidden">
                    {pixLoading ? (
                      <Loader2 className="w-10 h-10 text-[#FF7A00] animate-spin" />
                    ) : pixTx?.qr_code ? (
                      <img src={`data:image/png;base64,${pixTx.qr_code}`} alt="PIX QR Code" className="w-full h-full object-contain" />
                    ) : pixTx?.pix_copy_paste ? (
                      <div className="p-2 bg-white">
                        <QRCodeSVG value={pixTx.pix_copy_paste} size={160} level="M" includeMargin={false} />
                      </div>
                    ) : (
                      <Loader2 className="w-10 h-10 text-[#FF7A00] animate-spin" />
                    )}
                  </div>

                  {activePixCode && (
                    <div className="space-y-3">
                      <div className="bg-[#0a0a0a] border border-[#3A2414] rounded-lg p-3 text-xs font-mono break-all text-[#A3A3A3] max-h-24 overflow-auto">
                        {activePixCode}
                      </div>
                      <Button
                        onClick={handleCopy}
                        className="w-full bg-[#1a1a1a] border border-[#FF7A00] text-[#FF7A00] hover:bg-[#FF7A00] hover:text-black py-2.5"
                      >
                        {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                        {copied ? "Copiado!" : "Copiar Código PIX"}
                      </Button>
                    </div>
                  )}

                  <div className="pt-2">
                    <Button
                      onClick={() => navigate({ to: "/pedido/$id", params: { id: orderId } })}
                      className="w-full bg-[#FF7A00] hover:bg-[#FF9A33] text-black font-bold py-3 text-base shadow-lg shadow-[#FF7A00]/20"
                    >
                      📦 Acompanhar Pedido
                    </Button>
                    <p className="text-[11px] text-[#A3A3A3] mt-2">
                      Você poderá acompanhar o andamento do pedido a qualquer momento.
                    </p>
                  </div>
                </>
              )}
            </>
          )}

          <div className="pt-4 border-t border-[#3A2414]">
            <p className="text-sm font-bold text-[#FF7A00]">Total: {formatBRL(finalTotal > 0 ? finalTotal : total)}</p>
            <Link 
              to="/cardapio" 
              className="block mt-4 text-xs text-[#A3A3A3] hover:text-[#E7D3B1] underline"
            >
              Voltar para o cardápio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const fieldCls = "w-full bg-[#0a0a0a] border border-[#3A2414] rounded-lg px-3 py-2.5 text-sm text-[#E7D3B1] placeholder:text-[#5a5a5a] focus:outline-none focus:border-[#FF7A00] transition-colors";
  const labelCls = "block text-[10px] uppercase tracking-wider text-[#A3A3A3] font-bold mb-1.5";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#E7D3B1]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">Checkout</h1>
            <p className="text-sm text-[#A3A3A3] mt-1">Confirme seus dados para finalizar o pedido.</p>
          </div>
          <Link to="/cardapio" className="text-sm text-[#FF7A00] hover:text-[#D4A15A] flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Continuar comprando
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="grid lg:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-6">
            <section className="bg-[#121212] border border-[#3A2414] rounded-2xl p-6">
              <h2 className="font-bold text-lg">Método de Recebimento</h2>
              <div className="grid grid-cols-2 gap-3 mt-4">
                {(["delivery", "retirada"] as const).map((k) => {
                  const active = kind === k;
                  const Icon = k === "delivery" ? Bike : ShoppingBag;
                  return (
                    <button
                      type="button"
                      key={k}
                      onClick={() => setKind(k)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left ${active ? "border-[#FF7A00] bg-[#FF7A00]/10" : "border-[#3A2414]"}`}
                    >
                      <Icon className={`w-5 h-5 ${active ? "text-[#FF7A00]" : "text-[#D4A15A]"}`} />
                      <div>
                        <div className="font-bold text-sm">{k === "delivery" ? "Entrega / Delivery" : "Pedido Externo"}</div>
                        <div className="text-[10px] text-[#A3A3A3]">{k === "delivery" ? "Receba em casa" : "Buscar no local"}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 grid gap-4">
                <div>
                  <label className={labelCls}>Nome completo *</label>
                  <input className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div>
                  <label className={labelCls}>WhatsApp *</label>
                  <input className={fieldCls} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(00) 00000-0000" required />
                </div>

                {kind === "delivery" && (
                  <>
                    <div>
                      <label className={labelCls}>Bairro *</label>
                      <select className={fieldCls} value={neighborhoodId} onChange={(e) => setNeighborhoodId(e.target.value)} required>
                        <option value="">Selecione o bairro</option>
                        {neighborhoods.map((n) => <option key={n.id} value={n.id}>{n.name} — {formatBRL(n.fee)}</option>)}
                        <option value={OTHER_NEIGHBORHOOD}>Outros</option>
                      </select>
                    </div>
                    {isOther && (
                       <input className={fieldCls} value={customNeighborhood} onChange={(e) => setCustomNeighborhood(e.target.value)} placeholder="Nome do bairro" required />
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <input className={fieldCls} value={rua} onChange={(e) => setRua(e.target.value)} placeholder="Rua" required />
                      <input className={fieldCls} value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Nº" required />
                    </div>
                  </>
                )}
              </div>
            </section>

            <section className="bg-[#121212] border border-[#3A2414] rounded-2xl p-6">
              <h2 className="font-bold text-lg">Pagamento</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                {activePaymentMethods?.map((m) => {
                  const active = paymentType === m.type;
                  let Icon = Wallet;
                  if (m.type === 'pix') Icon = QrIcon;
                  if (m.type === 'cash') Icon = Banknote;
                  if (m.type.startsWith('card')) Icon = CardIcon;

                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => setPaymentType(m.type as any)}
                      className={`flex flex-col items-start gap-2 px-4 py-3 rounded-xl border transition-colors text-left ${active ? "border-[#FF7A00] bg-[#FF7A00]/10" : "border-[#3A2414]"}`}
                    >
                      <Icon className={`w-5 h-5 ${active ? "text-[#FF7A00]" : "text-[#D4A15A]"}`} />
                      <div className="font-bold text-xs">{m.name}</div>
                    </button>
                  );
                })}
              </div>

              {paymentType === "card_delivery" && (
                <div className="mt-4 p-4 bg-[#0a0a0a] rounded-xl border border-[#3A2414]">
                  <label className={labelCls}>Tipo do Cartão</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" checked={cardType === "debit"} onChange={() => setCardType("debit")} className="accent-[#FF7A00]" /> Débito
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" checked={cardType === "credit"} onChange={() => setCardType("credit")} className="accent-[#FF7A00]" /> Crédito
                    </label>
                  </div>
                </div>
              )}

              {paymentType === "cash" && (
                <div className="mt-4 p-4 bg-[#0a0a0a] rounded-xl border border-[#3A2414] space-y-4">
                  <label className={labelCls}>Vai precisar de troco?</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" checked={!needsChange} onChange={() => setNeedsChange(false)} className="accent-[#FF7A00]" /> Não
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" checked={needsChange} onChange={() => setNeedsChange(true)} className="accent-[#FF7A00]" /> Sim
                    </label>
                  </div>
                  {needsChange && (
                    <div>
                      <label className={labelCls}>Troco para R$</label>
                      <input 
                        type="number" 
                        className={fieldCls} 
                        value={changeFor} 
                        onChange={(e) => setChangeFor(e.target.value)}
                        placeholder="Ex: 50.00" 
                      />
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <div className="bg-[#121212] border border-[#3A2414] rounded-2xl p-6 sticky top-6">
               <h2 className="font-bold text-lg mb-4">Resumo</h2>
               <div className="space-y-2 text-sm">
                 <div className="flex justify-between">
                   <span className="text-[#A3A3A3]">Subtotal</span>
                   <span>{formatBRL(subtotal)}</span>
                 </div>
                 {deliveryFee > 0 && (
                   <div className="flex justify-between">
                     <span className="text-[#A3A3A3]">Entrega</span>
                     <span>{formatBRL(deliveryFee)}</span>
                   </div>
                 )}
                 <div className="flex justify-between font-bold text-lg pt-2 border-t border-[#3A2414] text-[#FF7A00]">
                   <span>Total</span>
                   <span>{formatBRL(total)}</span>
                 </div>
               </div>
               <Button 
                 type="submit" 
                 disabled={submitting} 
                 className="w-full mt-6 bg-[#FF7A00] hover:bg-[#E66E00] text-black font-bold h-12"
               >
                 {submitting ? "Processando..." : "FINALIZAR PEDIDO"}
               </Button>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}

function Button({ children, className, ...props }: any) {
  return (
    <button className={`flex items-center justify-center rounded-xl transition-all disabled:opacity-50 ${className}`} {...props}>
      {children}
    </button>
  );
}
