import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Pencil, Trash2, Bike, Search, Power, PowerOff, Flame, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { checkIsAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/entregas")({
  component: EntregasPage,
});

type Entregador = {
  id: string;
  restaurant_id: string;
  name: string;
  phone: string | null;
  tipo_veiculo: string | null;
  placa: string | null;
  observacoes: string | null;
  active: boolean;
  user_id?: string | null;
  created_at: string;
  updated_at: string;
};

const VEHICLE_OPTIONS = [
  { value: "moto", label: "Moto" },
  { value: "bicicleta", label: "Bicicleta" },
  { value: "carro", label: "Carro" },
  { value: "patinete", label: "Patinete" },
  { value: "a_pe", label: "A pé" },
];

const EMAIL_IN_USE_MESSAGE = "Este e-mail já está sendo utilizado por outro usuário no sistema. Tente usar outro e-mail válido.";
const PASSWORD_TOO_SHORT_MESSAGE = "A senha temporária precisa ter no mínimo 6 caracteres.";
const DRIVER_CREATE_GENERIC_MESSAGE = "Não foi possível criar o entregador. Verifique as credenciais ou tente novamente.";

type DriverCreatePayload = {
  restaurant_id: string;
  name: string;
  phone: string | null;
  tipo_veiculo: string | null;
  placa: string | null;
  observacoes: string | null;
  active: boolean;
  email: string;
  password: string;
};

type DriverErrorDetails = {
  code?: string;
  raw: string;
};

function stringifyErrorPayload(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const parts = [
      obj.code,
      obj.error,
      obj.message,
      obj.msg,
      obj.details,
      obj.hint,
      obj.status,
    ]
      .map((part) => stringifyErrorPayload(part))
      .filter(Boolean);

    if (parts.length) return parts.join(" ");
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function classifyDriverCreateError(details: DriverErrorDetails) {
  const text = `${details.code || ""} ${details.raw || ""}`.toLowerCase();

  if (
    text.includes("email_exists") ||
    text.includes("user already registered") ||
    text.includes("already registered") ||
    text.includes("already been registered") ||
    text.includes("email already") ||
    (text.includes("duplicate") && text.includes("email")) ||
    (text.includes("already") && text.includes("exist"))
  ) {
    return { kind: "email_exists" as const, message: EMAIL_IN_USE_MESSAGE };
  }

  if (
    text.includes("password_too_short") ||
    text.includes("weak_password") ||
    text.includes("password too short") ||
    text.includes("password should be at least") ||
    (text.includes("password") && text.includes("6"))
  ) {
    return { kind: "password_too_short" as const, message: PASSWORD_TOO_SHORT_MESSAGE };
  }

  return { kind: "unknown" as const, message: DRIVER_CREATE_GENERIC_MESSAGE };
}

async function parseFunctionErrorPayload(error: unknown): Promise<DriverErrorDetails> {
  const context = (error as any)?.context;
  let parsed: unknown = null;

  if (context?.json) {
    try {
      parsed = await context.json();
    } catch {
      parsed = null;
    }
  }

  if (!parsed && context?.text) {
    try {
      parsed = await context.text();
    } catch {
      parsed = null;
    }
  }

  const raw = [
    stringifyErrorPayload(parsed),
    stringifyErrorPayload((error as any)?.message),
    stringifyErrorPayload((error as any)?.name),
    stringifyErrorPayload((error as any)?.status),
  ]
    .filter(Boolean)
    .join(" ");

  return {
    code: typeof parsed === "object" && parsed ? String((parsed as any).code || "") : undefined,
    raw,
  };
}

async function createDriverMetadataFallback(payload: DriverCreatePayload) {
  const { data: existingAccount, error: accountLookupError } = await supabase
    .from("delivery_driver_users" as any)
    .select("id")
    .eq("email", payload.email)
    .maybeSingle();

  if (accountLookupError) throw accountLookupError;
  if (existingAccount) {
    throw Object.assign(new Error("email_exists"), { code: "email_exists" });
  }

  const { data: restaurantRow, error: restaurantError } = await supabase
    .from("restaurants" as any)
    .select("id")
    .limit(1)
    .maybeSingle();

  if (restaurantError) throw restaurantError;
  const fallbackRestaurantId = (restaurantRow as any)?.id || payload.restaurant_id;

  const { data: driver, error: driverError } = await supabase
    .from("delivery_drivers" as any)
    .insert({
      restaurant_id: fallbackRestaurantId,
      name: payload.name,
      phone: payload.phone,
      tipo_veiculo: payload.tipo_veiculo,
      placa: payload.placa,
      observacoes: payload.observacoes,
      active: payload.active,
      user_id: null,
    })
    .select("id")
    .single();

  if (driverError) throw driverError;

  const { error: accountError } = await supabase
    .from("delivery_driver_users" as any)
    .insert({
      restaurant_id: fallbackRestaurantId,
      driver_id: (driver as any).id,
      email: payload.email,
      user_id: null,
      active: payload.active,
    });

  if (accountError) {
    await supabase.from("delivery_drivers" as any).delete().eq("id", (driver as any).id);
    throw accountError;
  }

  return driver;
}

function EntregasPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [authChecked, setAuthChecked] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<Entregador> | null>(null);
  const [deleting, setDeleting] = useState<Entregador | null>(null);
  const [credEmail, setCredEmail] = useState("");
  const [credPassword, setCredPassword] = useState("");
  const [credPassword2, setCredPassword2] = useState("");
  const [sendWhatsapp, setSendWhatsapp] = useState(false);
  const [resetPwd, setResetPwd] = useState("");
  const [saving, setSaving] = useState(false);

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

  // Restaurant id (multi-tenant). Follows the same pattern as admin/pagamento.tsx.
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

  const { data: entregadores = [], isLoading } = useQuery({
    queryKey: ["delivery_drivers", restaurantId],
    enabled: !!restaurantId && authChecked,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_drivers" as any)
        .select("*")
        .eq("restaurant_id", restaurantId as string)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Entregador[];
    },
  });

  const filtered = entregadores.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.phone || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    if (!editing || !restaurantId) return;
    const name = (editing.name || "").trim();
    if (!name) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSaving(true);
    try {
      if (editing.id) {
        const { error } = await supabase
          .from("delivery_drivers" as any)
          .update({
            name,
            phone: editing.phone?.trim() || null,
            tipo_veiculo: editing.tipo_veiculo || null,
            placa: editing.placa?.trim() || null,
            observacoes: editing.observacoes?.trim() || null,
            active: editing.active ?? true,
          })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Entregador atualizado");
      } else {
        const email = credEmail.trim().toLowerCase();
        if (!email || !credPassword) {
          toast.error("Email e senha são obrigatórios");
          setSaving(false);
          return;
        }
        if (credPassword.length < 6) {
          toast.error(PASSWORD_TOO_SHORT_MESSAGE);
          setSaving(false);
          return;
        }
        if (credPassword !== credPassword2) {
          toast.error("Senhas não conferem");
          setSaving(false);
          return;
        }
        const payload: DriverCreatePayload = {
            restaurant_id: restaurantId,
            name,
            phone: editing.phone?.trim() || null,
            tipo_veiculo: editing.tipo_veiculo || null,
            placa: editing.placa?.trim() || null,
            observacoes: editing.observacoes?.trim() || null,
            active: editing.active ?? true,
            email,
            password: credPassword,
          };
        const { data, error } = await supabase.functions.invoke("admin-create-driver", {
          body: payload,
        });
        let authAccessCreated = false;
        if ((data as any)?.error || error) {
          const details = error
            ? await parseFunctionErrorPayload(error)
            : { code: (data as any)?.code, raw: stringifyErrorPayload(data) };
          const classified = classifyDriverCreateError(details);

          if (classified.kind === "unknown") {
            try {
              await createDriverMetadataFallback(payload);
              toast.success("Entregador cadastrado no banco. A conta de acesso deverá ser vinculada quando o serviço de autenticação estiver disponível.");
            } catch (fallbackError: any) {
              const fallbackClassified = classifyDriverCreateError({
                code: fallbackError?.code,
                raw: `${details.raw} ${stringifyErrorPayload(fallbackError)}`,
              });
              toast.error(fallbackClassified.message);
              setSaving(false);
              return;
            }
          } else {
            toast.error(classified.message);
            setSaving(false);
            return;
          }
        } else {
          authAccessCreated = true;
          toast.success("Entregador cadastrado com acesso");
        }


        if (authAccessCreated && sendWhatsapp && editing.phone) {
          const phone = editing.phone.replace(/\D/g, "");
          const msg = encodeURIComponent(
            `Olá ${name}! Suas credenciais de acesso ao app de entregador:\n\nEmail: ${email}\nSenha: ${credPassword}\n\nAcesse e altere sua senha no primeiro login.`
          );
          window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
        }
      }
      setEditing(null);
      setCredEmail(""); setCredPassword(""); setCredPassword2(""); setSendWhatsapp(false);
      qc.invalidateQueries({ queryKey: ["delivery_drivers"] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!editing?.id || !resetPwd) return;
    if (resetPwd.length < 6) {
      toast.error("Senha mínima de 6 caracteres");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("admin-reset-driver-password", {
        body: { driver_id: editing.id, new_password: resetPwd },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Senha redefinida");
      setResetPwd("");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao redefinir senha");
    }
  };

  const toggleActive = async (e: Entregador) => {
    try {
      const { error } = await supabase
        .from("delivery_drivers" as any)
        .update({ active: !e.active })
        .eq("id", e.id);
      if (error) throw error;
      toast.success(!e.active ? "Entregador ativado" : "Entregador desativado");
      qc.invalidateQueries({ queryKey: ["delivery_drivers"] });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao alterar status");
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      const { error } = await supabase
        .from("delivery_drivers" as any)
        .delete()
        .eq("id", deleting.id);
      if (error) throw error;
      toast.success("Entregador removido");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["delivery_drivers"] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao remover");
    }
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
            <Link
              to="/admin"
              className="flex items-center gap-1.5 text-xs text-[#D4A15A] hover:text-[#FF7A00]"
            >
              <ArrowLeft className="w-4 h-4" /> Admin
            </Link>
            <div className="h-5 w-px bg-[#3A2414]" />
            <div className="flex items-center gap-2">
              <Bike className="w-5 h-5 text-[#FF7A00]" />
              <h1 className="text-lg md:text-xl font-bold text-[#E7D3B1]">
                Gestão de Entregadores
              </h1>
            </div>
          </div>
          <Button
            onClick={() =>
              setEditing({
                name: "",
                phone: "",
                tipo_veiculo: "moto",
                placa: "",
                observacoes: "",
                active: true,
              })
            }
            className="bg-[#FF7A00] hover:bg-[#FF7A00]/90 text-black font-semibold"
          >
            <Plus className="w-4 h-4 mr-1" /> Novo
          </Button>
        </div>
        <div className="max-w-6xl mx-auto px-4 md:px-8 pb-3 flex gap-2">
          <Link
            to="/admin/entregas"
            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-[#FF7A00] text-black"
          >
            Entregadores
          </Link>
          <Link
            to="/admin/entregas/pedidos"
            className="px-3 py-1.5 rounded-md text-xs font-semibold border border-[#3A2414] text-[#D4A15A] hover:text-[#FF7A00] hover:border-[#FF7A00]/50"
          >
            Pedidos de Entrega
          </Link>
          <Link
            to="/admin/entregadores/acessos"
            className="px-3 py-1.5 rounded-md text-xs font-semibold border border-[#3A2414] text-[#D4A15A] hover:text-[#FF7A00] hover:border-[#FF7A00]/50"
          >
            Acessos
          </Link>
          <Link
            to="/admin/entregadores/mapa"
            className="px-3 py-1.5 rounded-md text-xs font-semibold border border-[#3A2414] text-[#D4A15A] hover:text-[#FF7A00] hover:border-[#FF7A00]/50"
          >
            Mapa
          </Link>
          <Link
            to="/admin/entregas/relatorios"
            className="px-3 py-1.5 rounded-md text-xs font-semibold border border-[#3A2414] text-[#D4A15A] hover:text-[#FF7A00] hover:border-[#FF7A00]/50"
          >
            Relatórios
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#D4A15A]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="pl-9 bg-[#1a1a1a] border-[#3A2414] text-[#E7D3B1] placeholder:text-[#A3A3A3]"
          />
        </div>

        <div className="rounded-xl border border-[#3A2414] bg-[#0d0907] overflow-hidden">
          {isLoading ? (
            <div className="p-10 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#FF7A00]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-[#A3A3A3] text-sm">
              {entregadores.length === 0
                ? "Nenhum entregador cadastrado ainda."
                : "Nenhum entregador encontrado."}
            </div>
          ) : (
            <div className="divide-y divide-[#3A2414]/60">
              {filtered.map((e) => (
                <div
                  key={e.id}
                  className="px-4 py-3 flex items-center gap-3 hover:bg-[#1a1a1a]/60"
                >
                  <div className="w-10 h-10 rounded-full bg-[#FF7A00]/15 border border-[#FF7A00]/30 flex items-center justify-center text-[#FF7A00] font-bold">
                    {e.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#E7D3B1] truncate">
                        {e.name}
                      </span>
                      {e.active ? (
                        <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/40 text-[10px]">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge className="bg-zinc-700/40 text-zinc-300 border-zinc-600/40 text-[10px]">
                          Inativo
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-[#A3A3A3] flex gap-3 flex-wrap">
                      {e.phone && <span>{e.phone}</span>}
                      {e.tipo_veiculo && (
                        <span className="capitalize">
                          {VEHICLE_OPTIONS.find((v) => v.value === e.tipo_veiculo)?.label ||
                            e.tipo_veiculo}
                        </span>
                      )}
                      {e.placa && <span className="uppercase">{e.placa}</span>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleActive(e)}
                    title={e.active ? "Desativar" : "Ativar"}
                    className="text-[#D4A15A] hover:text-[#FF7A00] hover:bg-[#1a1a1a]"
                  >
                    {e.active ? (
                      <PowerOff className="w-4 h-4" />
                    ) : (
                      <Power className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditing(e)}
                    className="text-[#D4A15A] hover:text-[#FF7A00] hover:bg-[#1a1a1a]"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleting(e)}
                    className="text-red-400 hover:text-red-300 hover:bg-[#1a1a1a]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Edit/Create Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="bg-[#0d0907] border-[#3A2414] text-[#E7D3B1]">
          <DialogHeader>
            <DialogTitle className="text-[#FF7A00]">
              {editing?.id ? "Editar Entregador" : "Novo Entregador"}
            </DialogTitle>
            <DialogDescription className="text-[#A3A3A3]">
              {editing?.id
                ? "Atualize os dados pessoais. Para alterar senha, use o campo no fim do formulário."
                : "Preencha os dados pessoais e credenciais de acesso ao app."}
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-[#D4A15A]">
                Dados Pessoais
              </div>
              <div>
                <Label className="text-xs text-[#D4A15A]">Nome *</Label>
                <Input
                  value={editing.name || ""}
                  onChange={(ev) => setEditing({ ...editing, name: ev.target.value })}
                  className="bg-[#1a1a1a] border-[#3A2414]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-[#D4A15A]">Telefone</Label>
                  <Input
                    value={editing.phone || ""}
                    onChange={(ev) =>
                      setEditing({ ...editing, phone: ev.target.value })
                    }
                    className="bg-[#1a1a1a] border-[#3A2414]"
                  />
                </div>
                <div>
                  <Label className="text-xs text-[#D4A15A]">Tipo de Veículo</Label>
                  <Select
                    value={editing.tipo_veiculo || ""}
                    onValueChange={(v) =>
                      setEditing({ ...editing, tipo_veiculo: v })
                    }
                  >
                    <SelectTrigger className="bg-[#1a1a1a] border-[#3A2414]">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0d0907] border-[#3A2414] text-[#E7D3B1]">
                      {VEHICLE_OPTIONS.map((v) => (
                        <SelectItem key={v.value} value={v.value}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs text-[#D4A15A]">Placa</Label>
                <Input
                  value={editing.placa || ""}
                  onChange={(ev) => setEditing({ ...editing, placa: ev.target.value })}
                  className="bg-[#1a1a1a] border-[#3A2414] uppercase"
                />
              </div>
              <div>
                <Label className="text-xs text-[#D4A15A]">Observações</Label>
                <Textarea
                  value={editing.observacoes || ""}
                  onChange={(ev) =>
                    setEditing({ ...editing, observacoes: ev.target.value })
                  }
                  className="bg-[#1a1a1a] border-[#3A2414]"
                  rows={3}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#3A2414] px-3 py-2">
                <Label className="text-sm text-[#E7D3B1]">Ativo</Label>
                <Switch
                  checked={editing.active ?? true}
                  onCheckedChange={(c) => setEditing({ ...editing, active: c })}
                />
              </div>

              {!editing.id && (
                <>
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#D4A15A] pt-2 border-t border-[#3A2414]">
                    Dados de Acesso *
                  </div>
                  <div>
                    <Label className="text-xs text-[#D4A15A]">Email *</Label>
                    <Input
                      type="email"
                      value={credEmail}
                      onChange={(ev) => setCredEmail(ev.target.value)}
                      className="bg-[#1a1a1a] border-[#3A2414]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-[#D4A15A]">Senha Temporária *</Label>
                      <Input
                        type="password"
                        value={credPassword}
                        onChange={(ev) => setCredPassword(ev.target.value)}
                        className="bg-[#1a1a1a] border-[#3A2414]"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-[#D4A15A]">Confirmar Senha *</Label>
                      <Input
                        type="password"
                        value={credPassword2}
                        onChange={(ev) => setCredPassword2(ev.target.value)}
                        className="bg-[#1a1a1a] border-[#3A2414]"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-[#E7D3B1] cursor-pointer">
                    <Checkbox
                      checked={sendWhatsapp}
                      onCheckedChange={(c) => setSendWhatsapp(!!c)}
                    />
                    Enviar credenciais por WhatsApp
                  </label>
                </>
              )}

              {editing.id && (editing as Entregador).user_id && (
                <div className="pt-2 border-t border-[#3A2414] space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#D4A15A]">
                    Redefinir Senha
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="Nova senha (mín. 6)"
                      value={resetPwd}
                      onChange={(ev) => setResetPwd(ev.target.value)}
                      className="bg-[#1a1a1a] border-[#3A2414]"
                    />
                    <Button
                      type="button"
                      onClick={handleResetPassword}
                      variant="outline"
                      className="border-[#3A2414] text-[#E7D3B1]"
                    >
                      Redefinir
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditing(null)}
              className="text-[#E7D3B1]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#FF7A00] hover:bg-[#FF7A00]/90 text-black font-semibold"
            >
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="bg-[#0d0907] border-[#3A2414] text-[#E7D3B1]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#FF7A00]">
              Remover entregador?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#A3A3A3]">
              Essa ação removerá <strong>{deleting?.name}</strong> permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-[#3A2414] text-[#E7D3B1]">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}