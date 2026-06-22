import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  ArrowLeft, ArrowUp, ArrowDown, Save, CheckCircle2, XCircle, 
  KeyRound, CreditCard, Wallet, Banknote, QrCode, LayoutGrid,
  Zap, Settings2, ShieldCheck, HelpCircle, Eye, EyeOff, Info, ExternalLink
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { QRCodeSVG } from "qrcode.react";

function FinancialIntegrationsTab() {
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string; account?: any } | null>(null);

  // Busca as configurações do Mercado Pago
  const { data: mpProvider, refetch: refetchMP } = useQuery({
    queryKey: ["payment-provider", "mercadopago"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_provider_settings")
        .select("*")
        .eq("provider", "mercadopago")
        .maybeSingle();
      return data;
    },
  });

  const [form, setForm] = useState<any>(null);
  const state = form ?? mpProvider ?? { 
    provider: "mercadopago", 
    environment: "sandbox", 
    active: false, 
    public_key: "", 
    access_token: "" 
  };

  const save = async () => {
    setBusy(true);
    try {
      // Obter o ID do restaurante (fallback para o fixo do sistema se não houver contexto multi-tenant ainda)
      const { data: rest } = await supabase.from("restaurant_settings").select("id").limit(1).maybeSingle();
      const restaurant_id = rest?.id;

      const payload = {
        provider: "mercadopago",
        restaurant_id,
        public_key: state.public_key || null,
        access_token: state.access_token || null,
        environment: state.environment || "sandbox",
        active: !!state.active,
      };

      if (mpProvider?.id) {
        const { error } = await supabase.from("payment_provider_settings").update(payload).eq("id", mpProvider.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payment_provider_settings").insert(payload);
        if (error) throw error;
      }

      toast.success("Configuração Mercado Pago salva com sucesso!");
      setForm(null);
      refetchMP();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar configurações");
    } finally {
      setBusy(false);
    }
  };

  const testConnection = async () => {
    if (!state.access_token) return toast.error("Informe o Access Token para testar");
    
    setBusy(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("mercadopago-test-connection", {
        body: { accessToken: state.access_token },
      });

      if (error) throw error;

      if (data?.success) {
        setTestResult({ ok: true, msg: `Conexão validada para a conta: ${data.account?.name}`, account: data.account });
        toast.success(`Conexão validada para a conta: ${data.account?.name}`);
      } else {
        setTestResult({ ok: false, msg: data?.error || "Falha na validação das chaves" });
        toast.error(data?.error || "Falha na validação das chaves");
      }
    } catch (e: any) {
      setTestResult({ ok: false, msg: e?.message || "Erro ao conectar com o servidor" });
      toast.error("Erro ao testar conexão");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-[#121212] border-[#3A2414] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#1a1a1a] text-[10px] uppercase tracking-wider text-[#A3A3A3] border-b border-[#3A2414]">
              <tr>
                <th className="p-4">Gateway</th>
                <th className="p-4">Status</th>
                <th className="p-4">Ambiente</th>
                <th className="p-4 text-right">Disponibilidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A2414]">
              <tr className="bg-[#FF7A00]/5 border-l-2 border-l-[#FF7A00]">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#009EE3] flex items-center justify-center text-white font-bold text-[10px]">MP</div>
                    <span className="font-bold text-[#E7D3B1]">Mercado Pago</span>
                  </div>
                </td>
                <td className="p-4">
                  <Badge className={`text-[10px] font-bold ${mpProvider?.active ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                    {mpProvider?.active ? "Ativo" : "Inativo"}
                  </Badge>
                </td>
                <td className="p-4 text-xs text-[#D4A15A] uppercase">{mpProvider?.environment || "—"}</td>
                <td className="p-4 text-right">
                  <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400 bg-emerald-500/5">Disponível</Badge>
                </td>
              </tr>
              <tr className="opacity-50">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-[10px]">AS</div>
                    <span className="font-bold text-[#E7D3B1]">Asaas</span>
                  </div>
                </td>
                <td className="p-4"><span className="text-[10px] text-[#A3A3A3]">---</span></td>
                <td className="p-4"><span className="text-[10px] text-[#A3A3A3]">---</span></td>
                <td className="p-4 text-right">
                  <Badge variant="outline" className="text-[9px] border-[#3A2414] text-[#A3A3A3]">Em breve</Badge>
                </td>
              </tr>
              <tr className="opacity-50">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#635BFF] flex items-center justify-center text-white font-bold text-[10px]">ST</div>
                    <span className="font-bold text-[#E7D3B1]">Stripe</span>
                  </div>
                </td>
                <td className="p-4"><span className="text-[10px] text-[#A3A3A3]">---</span></td>
                <td className="p-4"><span className="text-[10px] text-[#A3A3A3]">---</span></td>
                <td className="p-4 text-right">
                  <Badge variant="outline" className="text-[9px] border-[#3A2414] text-[#A3A3A3]">Em breve</Badge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-[#121212] border-[#3A2414] shadow-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#009EE3]/10 border border-[#009EE3]/20">
                    <CreditCard className="w-5 h-5 text-[#009EE3]" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Configuração Mercado Pago</CardTitle>
                    <CardDescription className="text-[#A3A3A3]">Habilite pagamentos automáticos e PIX dinâmico.</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-[#1a1a1a] p-2 rounded-lg border border-[#3A2414]">
                  <span className="text-xs font-bold text-[#A3A3A3]">Integração Ativa:</span>
                  <Switch 
                    checked={!!state.active} 
                    onCheckedChange={(v) => setForm({ ...state, active: v })} 
                    className="data-[state=checked]:bg-emerald-500"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-[#A3A3A3] flex items-center gap-2">
                    <KeyRound className="w-3 h-3" /> Public Key
                  </label>
                  <Input
                    placeholder="APP_USR-..."
                    value={state.public_key || ""}
                    onChange={(e) => setForm({ ...state, public_key: e.target.value })}
                    className="bg-[#0a0a0a] border-[#3A2414] text-[#E7D3B1] font-mono"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-[#A3A3A3] flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3" /> Access Token
                  </label>
                  <div className="relative">
                    <Input
                      type={showToken ? "text" : "password"}
                      placeholder="APP_USR-..."
                      value={state.access_token || ""}
                      onChange={(e) => setForm({ ...state, access_token: e.target.value })}
                      className="bg-[#0a0a0a] border-[#3A2414] text-[#E7D3B1] font-mono pr-10"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A3A3A3] hover:text-[#FF7A00] transition-colors"
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-[#A3A3A3]">Ambiente</label>
                    <Select value={state.environment || "sandbox"} onValueChange={(v) => setForm({ ...state, environment: v })}>
                      <SelectTrigger className="bg-[#0a0a0a] border-[#3A2414] text-[#E7D3B1]"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-[#121212] border-[#3A2414] text-[#E7D3B1]">
                        <SelectItem value="sandbox">Sandbox (Teste)</SelectItem>
                        <SelectItem value="production">Produção (Real)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {testResult && (
                <div className={`p-4 rounded-lg border flex items-start gap-3 animate-in fade-in zoom-in duration-200 ${
                  testResult.ok ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400"
                }`}>
                  {testResult.ok ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
                  <div className="text-xs">
                    <p className="font-bold">{testResult.ok ? "Conexão estabelecida!" : "Erro de conexão"}</p>
                    <p className="opacity-90">{testResult.msg}</p>
                    {testResult.account?.email && <p className="mt-1 opacity-70 font-mono">{testResult.account.email}</p>}
                  </div>
                </div>
              )}

              <div className="pt-6 border-t border-[#3A2414] flex flex-col md:flex-row justify-end gap-3">
                <Button 
                  onClick={testConnection} 
                  disabled={busy} 
                  variant="outline" 
                  className="border-[#3A2414] bg-[#1a1a1a] hover:bg-[#2a2a2a] text-[#E7D3B1]"
                >
                  {busy ? <Zap className="w-4 h-4 mr-2 animate-pulse" /> : <Zap className="w-4 h-4 mr-2" />} 
                  Testar Conexão
                </Button>
                <Button 
                  onClick={save} 
                  disabled={busy} 
                  className="bg-[#FF7A00] text-black font-bold hover:bg-[#FF7A00]/90 px-8"
                >
                  <Save className="w-4 h-4 mr-2" /> Salvar Configuração
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-[#121212] border-[#3A2414] shadow-xl overflow-hidden">
            <div className="bg-[#FF7A00]/10 p-3 border-b border-[#3A2414] flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-[#FF7A00]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF7A00]">Como obter as chaves?</span>
            </div>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-4">
                {[
                  { step: 1, text: "Crie ou acesse sua conta no Mercado Pago" },
                  { step: 2, text: "Acesse o painel de desenvolvedores", link: "https://www.mercadopago.com.br/developers/panel" },
                  { step: 3, text: "Crie uma 'Nova Aplicação' para sua loja" },
                  { step: 4, text: "Vá em 'Credenciais de Produção' ou 'Testes'" },
                  { step: 5, text: "Copie a Public Key e o Access Token e cole aqui" }
                ].map((s) => (
                  <div key={s.step} className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#1a1a1a] border border-[#3A2414] text-[#FF7A00] flex items-center justify-center text-[10px] font-bold shrink-0">
                      {s.step}
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-[#E7D3B1] leading-tight">{s.text}</p>
                      {s.link && (
                        <a href={s.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#FF7A00] hover:underline flex items-center gap-1">
                          Acesse aqui <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-3 rounded-lg bg-[#0a0a0a] border border-[#3A2414] flex gap-3">
                <Info className="w-4 h-4 text-[#D4A15A] shrink-0" />
                <p className="text-[10px] text-[#A3A3A3] leading-relaxed">
                  Para pagamentos reais, lembre-se de preencher as informações de sua conta no Mercado Pago e ativar as credenciais de produção.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="bg-[#1a1a1a]/50 border border-[#3A2414] rounded-xl p-4 space-y-3">
            <h4 className="text-[10px] font-bold uppercase text-[#FF7A00] flex items-center gap-2">
              <ShieldCheck className="w-3 h-3" /> Segurança de Dados
            </h4>
            <p className="text-[10px] text-[#A3A3A3] leading-relaxed">
              Suas chaves de acesso são armazenadas de forma segura e nunca são expostas para o cliente final. O processamento é feito via camada segura do servidor.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/admin/pagamento")({
  component: PaymentMethodsPage,
});

const AVAILABILITY: { key: "delivery" | "pickup" | "dine_in"; label: string }[] = [
  { key: "delivery", label: "Delivery" },
  { key: "pickup", label: "Retirada" },
  { key: "dine_in", label: "Mesa" },
];

const SYSTEM_METHODS = ['pix', 'cash', 'card_delivery', 'pay_at_store'];

const DEFAULT_PAYMENT_METHODS = [
  {
    name: "PIX",
    type: "pix",
    is_active: true,
    display_order: 1,
    available_for: ["delivery", "pickup", "dine_in"],
  },
  {
    name: "Dinheiro na Entrega",
    type: "cash",
    is_active: true,
    display_order: 2,
    available_for: ["delivery"],
  },
  {
    name: "Cartão na Entrega",
    type: "card_delivery",
    is_active: true,
    display_order: 3,
    available_for: ["delivery"],
  },
  {
    name: "Pagar na Retirada",
    type: "pay_at_store",
    is_active: true,
    display_order: 4,
    available_for: ["pickup"],
  },
];

function PaymentMethodsPage() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const createDefaultMethods = async () => {
    const { error } = await supabase
      .from("payment_methods")
      .upsert(DEFAULT_PAYMENT_METHODS, { onConflict: "type", ignoreDuplicates: true });
    if (error) throw error;
  };

  const { data: methodsResponse, refetch, isLoading: methodsLoading } = useQuery({
    queryKey: ["payment-methods", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .order("display_order");
      if (error) throw error;

      if ((data?.length ?? 0) > 0) {
        return { methods: data || [], seeded: false };
      }

      await createDefaultMethods();

      const { data: seededData, error: seededError } = await supabase
        .from("payment_methods")
        .select("*")
        .order("display_order");

      if (seededError) throw seededError;

      return { methods: seededData || [], seeded: true };
    },
  });

  const methods = methodsResponse?.methods ?? [];

  useEffect(() => {
    if (methodsResponse?.seeded) {
      toast.success("Métodos padrão criados automaticamente.");
    }
  }, [methodsResponse?.seeded]);

  const { data: pix, refetch: refetchPix } = useQuery({
    queryKey: ["payment-pix-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_pix_settings")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const [pixForm, setPixForm] = useState<any>(null);
  const pixState = pixForm ?? pix ?? { active: true, pix_key_type: "cpf" };

  const refreshAll = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["payment-methods"] });
  };

  const handleCreateDefaults = async () => {
    setBusy(true);
    try {
      await createDefaultMethods();
      toast.success("Métodos padrão criados com sucesso.");
      refreshAll();
    } catch {
      toast.error("Erro ao criar métodos padrão.");
    } finally {
      setBusy(false);
    }
  };

  const toggleMethod = async (id: string, current: boolean) => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("payment_methods")
        .update({ is_active: !current })
        .eq("id", id);
      if (error) throw error;
      toast.success(!current ? "Forma de pagamento ativada" : "Forma de pagamento desativada");
      refreshAll();
    } catch {
      toast.error("Erro ao atualizar forma de pagamento");
    } finally {
      setBusy(false);
    }
  };

  const updateAvailability = async (id: string, list: string[]) => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("payment_methods")
        .update({ available_for: list })
        .eq("id", id);
      if (error) throw error;
      toast.success("Disponibilidade atualizada");
      refreshAll();
    } catch {
      toast.error("Erro ao atualizar disponibilidade");
    } finally {
      setBusy(false);
    }
  };

  const move = async (id: string, dir: -1 | 1) => {
    const idx = methods.findIndex((m: any) => m.id === id);
    const swap = methods[idx + dir];
    if (!swap) return;
    setBusy(true);
    try {
      const a = methods[idx] as any;
      await supabase.from("payment_methods").update({ display_order: swap.display_order }).eq("id", a.id);
      await supabase.from("payment_methods").update({ display_order: a.display_order }).eq("id", swap.id);
      toast.success("Ordem atualizada");
      refreshAll();
    } catch {
      toast.error("Erro ao reordenar");
    } finally {
      setBusy(false);
    }
  };

  const savePix = async () => {
    setBusy(true);
    try {
      const payload = {
        receiver_name: pixState.receiver_name ?? null,
        pix_key: pixState.pix_key ?? null,
        pix_key_type: pixState.pix_key_type ?? null,
        city: pixState.city ?? null,
        static_pix_code: pixState.static_pix_code ?? null,
        qr_code_url: pixState.qr_code_url ?? null,
        active: pixState.active ?? true,
      };
      if (pix?.id) {
        const { error } = await supabase.from("payment_pix_settings").update(payload).eq("id", pix.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payment_pix_settings").insert(payload);
        if (error) throw error;
      }
      toast.success("Configuração PIX salva com sucesso!");
      setPixForm(null);
      refetchPix();
    } catch {
      toast.error("Erro ao salvar configuração PIX");
    } finally {
      setBusy(false);
    }
  };

  const activeCount = methods.filter((m: any) => m.is_active).length;
  const inactiveCount = methods.length - activeCount;
  const pixConfigured = !!(pix?.pix_key && pix?.receiver_name && pix?.active);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#E7D3B1] p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link to="/admin/" className="p-2 rounded-full bg-[#121212] border border-[#3A2414] text-[#FF7A00] hover:bg-[#1a1a1a] transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Canais de Venda & Pagamentos</h1>
              <p className="text-xs text-[#A3A3A3]">Gerencie como e onde seus clientes podem pagar.</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="methods" className="space-y-6">
          <TabsList className="bg-[#121212] border border-[#3A2414] p-1 h-auto w-full md:w-auto overflow-x-auto justify-start">
            <TabsTrigger value="methods" className="data-[state=active]:bg-[#FF7A00] data-[state=active]:text-black text-xs py-2 px-4 uppercase tracking-wider font-bold">
              <Wallet className="w-4 h-4 mr-2" /> Métodos de Pagamento
            </TabsTrigger>
            <TabsTrigger value="pix" className="data-[state=active]:bg-[#FF7A00] data-[state=active]:text-black text-xs py-2 px-4 uppercase tracking-wider font-bold">
              <QrCode className="w-4 h-4 mr-2" /> Configuração PIX
            </TabsTrigger>
            <TabsTrigger value="gateways" className="data-[state=active]:bg-[#FF7A00] data-[state=active]:text-black text-xs py-2 px-4 uppercase tracking-wider font-bold">
              <Zap className="w-4 h-4 mr-2" /> Integrações Financeiras <Badge variant="outline" className="ml-2 text-[10px] border-[#3A2414] text-[#FF7A00]">Beta</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="methods" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Cards Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-[#121212] border-[#3A2414] shadow-xl">
                <CardHeader className="pb-2">
                  <CardDescription className="text-[10px] uppercase tracking-widest text-[#A3A3A3]">Métodos Ativos</CardDescription>
                  <CardTitle className="text-3xl font-bold text-emerald-400">{activeCount}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-[#121212] border-[#3A2414] shadow-xl">
                <CardHeader className="pb-2">
                  <CardDescription className="text-[10px] uppercase tracking-widest text-[#A3A3A3]">Métodos Inativos</CardDescription>
                  <CardTitle className="text-3xl font-bold text-red-400">{inactiveCount}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-[#121212] border-[#3A2414] shadow-xl">
                <CardHeader className="pb-2">
                  <CardDescription className="text-[10px] uppercase tracking-widest text-[#A3A3A3]">PIX Configurado</CardDescription>
                  <CardTitle className={`text-xl font-bold ${pixConfigured ? 'text-emerald-400' : 'text-red-400'}`}>
                    {pixConfigured ? 'Configurado' : 'Não Configurado'}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Tabela de Métodos */}
            <Card className="bg-[#121212] border-[#3A2414] overflow-hidden">
              {methods.length === 0 ? (
                <CardContent className="py-16 text-center space-y-4">
                  <LayoutGrid className="w-12 h-12 mx-auto text-[#3A2414]" />
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-[#E7D3B1]">Nenhum método de pagamento cadastrado</h3>
                    <p className="text-sm text-[#A3A3A3] max-w-md mx-auto">
                      Crie os métodos padrão para liberar rapidamente os pagamentos no checkout sem alterar o restante da operação.
                    </p>
                  </div>
                  <Button
                    onClick={handleCreateDefaults}
                    disabled={busy || methodsLoading}
                    className="bg-[#FF7A00] text-black font-bold hover:bg-[#FF7A00]/90"
                  >
                    <Save className="w-4 h-4 mr-2" /> Criar métodos padrão
                  </Button>
                </CardContent>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#1a1a1a] text-[10px] uppercase tracking-wider text-[#A3A3A3] border-b border-[#3A2414]">
                      <tr>
                        <th className="p-4 font-bold">Nome</th>
                        <th className="p-4 font-bold">Tipo</th>
                        <th className="p-4 font-bold">Disponível Para</th>
                        <th className="p-4 font-bold text-center">Ordem</th>
                        <th className="p-4 font-bold text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#3A2414]">
                      {methods.map((m: any, idx: number) => (
                        <tr key={m.id} className="group hover:bg-[#1a1a1a]/50 transition-colors">
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-[#E7D3B1]">{m.name}</span>
                            {SYSTEM_METHODS.includes(m.type) && (
                              <span className="text-[10px] text-[#FF7A00] flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" /> Sistema
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline" className="bg-[#1a1a1a] border-[#3A2414] text-[#D4A15A] text-[10px] font-mono">
                            {m.type}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-4">
                            {AVAILABILITY.map((opt) => {
                              const current = m.available_for || [];
                              const isChecked = current.includes(opt.key);
                              return (
                                <div key={opt.key} className="flex items-center space-x-2">
                                  <Checkbox 
                                    id={`check-${m.id}-${opt.key}`}
                                    checked={isChecked}
                                    onCheckedChange={(checked) => {
                                      const next = checked 
                                        ? [...current, opt.key]
                                        : current.filter((c: string) => c !== opt.key);
                                      updateAvailability(m.id, next);
                                    }}
                                    className="border-[#3A2414] data-[state=checked]:bg-[#FF7A00] data-[state=checked]:border-[#FF7A00]"
                                  />
                                  <label 
                                    htmlFor={`check-${m.id}-${opt.key}`}
                                    className="text-[11px] font-medium text-[#A3A3A3] cursor-pointer"
                                  >
                                    {opt.label}
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => move(m.id, -1)}
                              disabled={busy || idx === 0}
                              className="h-8 w-8 bg-[#1a1a1a] border border-[#3A2414] hover:bg-[#2a2a2a] disabled:opacity-20"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </Button>
                            <span className="text-xs font-bold w-4 text-center">{m.display_order}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => move(m.id, 1)}
                              disabled={busy || idx === methods.length - 1}
                              className="h-8 w-8 bg-[#1a1a1a] border border-[#3A2414] hover:bg-[#2a2a2a] disabled:opacity-20"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-3">
                            <Switch 
                              checked={m.is_active}
                              onCheckedChange={() => toggleMethod(m.id, !!m.is_active)}
                              disabled={busy}
                              className="data-[state=checked]:bg-emerald-500"
                            />
                            <Badge className={`text-[10px] font-bold ${m.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                              {m.is_active ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </div>
                        </td>
                      </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="pix" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
              <Card className="bg-[#121212] border-[#3A2414] shadow-2xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">Configuração PIX Estático</CardTitle>
                      <CardDescription className="text-[#A3A3A3]">Configure sua chave para recebimento instantâneo.</CardDescription>
                    </div>
                    <div className="flex items-center gap-3 bg-[#1a1a1a] p-2 rounded-lg border border-[#3A2414]">
                      <span className="text-xs font-bold text-[#A3A3A3]">Status do PIX:</span>
                      <Switch 
                        checked={pixState.active}
                        onCheckedChange={(val) => setPixForm({ ...pixState, active: val })}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-[#A3A3A3]">Nome do Recebedor</label>
                      <Input 
                        placeholder="Nome como aparece no banco"
                        value={pixState.receiver_name ?? ""}
                        onChange={(e) => setPixForm({ ...pixState, receiver_name: e.target.value })}
                        className="bg-[#0a0a0a] border-[#3A2414] text-[#E7D3B1] focus:ring-[#FF7A00]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-[#A3A3A3]">Tipo da Chave</label>
                      <Select 
                        value={pixState.pix_key_type ?? "cpf"}
                        onValueChange={(val) => setPixForm({ ...pixState, pix_key_type: val })}
                      >
                        <SelectTrigger className="bg-[#0a0a0a] border-[#3A2414] text-[#E7D3B1]">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#121212] border-[#3A2414] text-[#E7D3B1]">
                          <SelectItem value="cpf">CPF</SelectItem>
                          <SelectItem value="cnpj">CNPJ</SelectItem>
                          <SelectItem value="email">E-mail</SelectItem>
                          <SelectItem value="phone">Celular</SelectItem>
                          <SelectItem value="random">Chave Aleatória</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-[#A3A3A3]">Chave PIX</label>
                      <Input 
                        placeholder="Insira sua chave aqui"
                        value={pixState.pix_key ?? ""}
                        onChange={(e) => setPixForm({ ...pixState, pix_key: e.target.value })}
                        className="bg-[#0a0a0a] border-[#3A2414] text-[#E7D3B1]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-[#A3A3A3]">Cidade</label>
                      <Input 
                        placeholder="Cidade da conta bancária"
                        value={pixState.city ?? ""}
                        onChange={(e) => setPixForm({ ...pixState, city: e.target.value })}
                        className="bg-[#0a0a0a] border-[#3A2414] text-[#E7D3B1]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase font-bold text-[#A3A3A3]">Código "Copia e Cola"</label>
                      <Badge variant="outline" className="text-[9px] border-[#3A2414] text-[#FF7A00]">Obrigatório para QR Code</Badge>
                    </div>
                    <Textarea 
                      placeholder="Cole aqui o código BR Code gerado no seu app bancário..."
                      className="min-h-[100px] bg-[#0a0a0a] border-[#3A2414] text-[#E7D3B1] font-mono text-xs leading-relaxed"
                      value={pixState.static_pix_code ?? ""}
                      onChange={(e) => setPixForm({ ...pixState, static_pix_code: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-[#A3A3A3]">URL Externa do QR Code (Opcional)</label>
                    <Input 
                      placeholder="https://..."
                      value={pixState.qr_code_url ?? ""}
                      onChange={(e) => setPixForm({ ...pixState, qr_code_url: e.target.value })}
                      className="bg-[#0a0a0a] border-[#3A2414] text-[#E7D3B1]"
                    />
                  </div>

                  <div className="pt-4 border-t border-[#3A2414] flex justify-end">
                    <Button 
                      onClick={savePix}
                      disabled={busy}
                      className="bg-[#FF7A00] text-black font-bold hover:bg-[#FF7A00]/90 px-8"
                    >
                      <Save className="w-4 h-4 mr-2" /> Salvar Configuração PIX
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Preview QR Code */}
              <div className="space-y-6">
                <Card className="bg-[#121212] border-[#3A2414] overflow-hidden shadow-xl">
                  <div className="bg-[#1a1a1a] p-3 border-b border-[#3A2414] flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-[#FF7A00]" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Pré-visualização</span>
                  </div>
                  <CardContent className="p-6 flex flex-col items-center justify-center space-y-4">
                    <div className="relative p-4 bg-white rounded-xl shadow-2xl">
                      {pixState.qr_code_url ? (
                        <img src={pixState.qr_code_url} alt="PIX QR Code" className="w-40 h-40 object-contain" />
                      ) : pixState.static_pix_code ? (
                        <QRCodeSVG value={pixState.static_pix_code} size={160} level="M" includeMargin={false} />
                      ) : (
                        <div className="w-40 h-40 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg text-gray-300">
                          <HelpCircle className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-[#E7D3B1]">Assim aparecerá no checkout</p>
                      <p className="text-[10px] text-[#A3A3A3] mt-1">Geração dinâmica via BR Code</p>
                    </div>
                  </CardContent>
                </Card>

                <div className="bg-[#1a1a1a]/50 border border-[#3A2414] rounded-xl p-4 space-y-3">
                  <h4 className="text-[10px] font-bold uppercase text-[#FF7A00] flex items-center gap-2">
                    <Settings2 className="w-3 h-3" /> Dicas de Configuração
                  </h4>
                  <ul className="space-y-2 text-[10px] text-[#A3A3A3] leading-relaxed">
                    <li className="flex gap-2">
                      <span className="text-[#FF7A00]">•</span>
                      <span>Utilize o código "Copia e Cola" do seu app bancário para habilitar o QR Code automático.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#FF7A00]">•</span>
                      <span>Chaves tipo "Aleatória" são recomendadas para maior privacidade.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="gateways" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <FinancialIntegrationsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
