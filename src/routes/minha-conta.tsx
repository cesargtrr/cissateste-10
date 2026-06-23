import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, User, MapPin, LogOut, Save } from "lucide-react";
import { toast } from "sonner";
import {
  getCustomerProfile,
  saveCustomerProfile,
  clearCustomerProfile,
  type CustomerProfile,
} from "@/lib/customer-profile";

export const Route = createFileRoute("/minha-conta")({
  head: () => ({
    meta: [
      { title: "Minha Conta — CISSABURGER" },
      { name: "description", content: "Gerencie seus dados de cadastro." },
    ],
  }),
  component: MinhaContaPage,
});

const fieldCls =
  "w-full bg-[#0a0a0a] border border-[#3A2414] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-[#6b6b6b] focus:outline-none focus:border-[#FF7A00]";
const labelCls = "text-[11px] font-bold uppercase tracking-wider text-[#D4A15A] mb-1 block";

function MinhaContaPage() {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    cpf: "",
    birthDate: "",
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    reference: "",
  });

  useEffect(() => {
    const p = getCustomerProfile();
    setProfile(p);
    if (!p) {
      setEditing(true);
    } else {
      setForm({
        name: p.name || "",
        phone: p.phone || "",
        email: p.email || "",
        cpf: p.cpf || "",
        birthDate: p.birthDate || "",
        cep: p.address?.cep || "",
        street: p.address?.street || "",
        number: p.address?.number || "",
        complement: p.address?.complement || "",
        neighborhood: p.address?.neighborhood || "",
        city: p.address?.city || "",
        reference: p.address?.reference || "",
      });
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Informe seu nome");
    if (!form.phone.trim()) return toast.error("Informe seu WhatsApp");
    saveCustomerProfile({
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      cpf: form.cpf.trim() || undefined,
      birthDate: form.birthDate || undefined,
      address: {
        cep: form.cep.trim() || undefined,
        street: form.street.trim() || undefined,
        number: form.number.trim() || undefined,
        complement: form.complement.trim() || undefined,
        neighborhood: form.neighborhood.trim() || undefined,
        city: form.city.trim() || undefined,
        reference: form.reference.trim() || undefined,
      },
    });
    toast.success("Dados salvos!");
    setProfile(getCustomerProfile());
    setEditing(false);
  };

  const handleLogout = () => {
    clearCustomerProfile();
    toast.success("Você saiu da sua conta.");
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-32">
      <header className="sticky top-0 z-30 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#1f1f1f]">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/" className="p-2 -ml-2 rounded-lg hover:bg-white/5">
            <ArrowLeft className="w-5 h-5 text-[#D4A15A]" />
          </Link>
          <h1 className="text-lg font-black tracking-tight">Minha Conta</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {!profile || editing ? (
          <form onSubmit={handleSave} className="space-y-5">
            <section className="bg-[#121212] border border-[#3A2414] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-[#FF7A00]" />
                <h2 className="font-bold">Dados Pessoais</h2>
              </div>
              <div className="grid gap-4">
                <div>
                  <label className={labelCls}>Nome completo *</label>
                  <input className={fieldCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <label className={labelCls}>WhatsApp *</label>
                  <input className={fieldCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(00) 00000-0000" required />
                </div>
                <div>
                  <label className={labelCls}>E-mail</label>
                  <input type="email" className={fieldCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>CPF (opcional)</label>
                    <input className={fieldCls} value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Nascimento</label>
                    <input type="date" className={fieldCls} value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-[#121212] border border-[#3A2414] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-[#FF7A00]" />
                <h2 className="font-bold">Endereço principal</h2>
              </div>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>CEP</label>
                    <input className={fieldCls} value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Cidade *</label>
                    <input className={fieldCls} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Bairro *</label>
                  <input className={fieldCls} value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} />
                </div>
                <div className="grid grid-cols-[1fr_100px] gap-4">
                  <div>
                    <label className={labelCls}>Rua</label>
                    <input className={fieldCls} value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Número</label>
                    <input className={fieldCls} value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Complemento</label>
                  <input className={fieldCls} value={form.complement} onChange={(e) => setForm({ ...form, complement: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Referência</label>
                  <input className={fieldCls} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Próximo a..." />
                </div>
              </div>
            </section>

            <button
              type="submit"
              className="w-full h-12 rounded-full bg-[#FF7A00] text-black font-black text-sm flex items-center justify-center gap-2 shadow-lg"
            >
              <Save className="w-4 h-4" /> Salvar Dados
            </button>
            {profile && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="w-full h-11 rounded-full border border-[#3A2414] text-[#D4A15A] text-sm font-bold"
              >
                Cancelar
              </button>
            )}
          </form>
        ) : (
          <>
            <section className="bg-[#121212] border border-[#3A2414] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-[#FF7A00]" />
                <h2 className="font-bold">Dados Pessoais</h2>
              </div>
              <dl className="space-y-2 text-sm">
                <Row label="Nome" value={profile.name} />
                <Row label="WhatsApp" value={profile.phone} />
                {profile.email && <Row label="E-mail" value={profile.email} />}
                {profile.cpf && <Row label="CPF" value={profile.cpf} />}
              </dl>
            </section>

            <section className="bg-[#121212] border border-[#3A2414] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-[#FF7A00]" />
                <h2 className="font-bold">Meu Endereço</h2>
              </div>
              {profile.address && (profile.address.street || profile.address.neighborhood) ? (
                <dl className="space-y-2 text-sm">
                  {profile.address.street && <Row label="Rua" value={`${profile.address.street}${profile.address.number ? `, ${profile.address.number}` : ""}`} />}
                  {profile.address.neighborhood && <Row label="Bairro" value={profile.address.neighborhood} />}
                  {profile.address.city && <Row label="Cidade" value={profile.address.city} />}
                  {profile.address.reference && <Row label="Referência" value={profile.address.reference} />}
                </dl>
              ) : (
                <p className="text-sm text-[#A3A3A3]">Nenhum endereço cadastrado.</p>
              )}
            </section>

            <div className="grid gap-3">
              <button onClick={() => setEditing(true)} className="w-full h-12 rounded-full bg-[#FF7A00] text-black font-black text-sm">
                ✏️ Editar Dados
              </button>
              <button onClick={() => setEditing(true)} className="w-full h-12 rounded-full border border-[#3A2414] text-[#D4A15A] font-bold text-sm">
                📍 Alterar Endereço
              </button>
              <button onClick={handleLogout} className="w-full h-12 rounded-full border border-red-900/50 text-red-400 font-bold text-sm flex items-center justify-center gap-2">
                <LogOut className="w-4 h-4" /> Sair da Conta
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[#A3A3A3]">{label}</dt>
      <dd className="text-white font-medium text-right">{value}</dd>
    </div>
  );
}
