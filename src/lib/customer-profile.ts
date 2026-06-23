// Local customer profile storage (no auth required).
// Persists basic customer data so they don't have to re-type on every order.

export type CustomerAddress = {
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  neighborhoodId?: string;
  city?: string;
  reference?: string;
};

export type CustomerProfile = {
  name: string;
  phone: string;
  email?: string;
  cpf?: string;
  birthDate?: string;
  address?: CustomerAddress;
  updatedAt: string;
};

const KEY = "cissa-customer-profile-v1";

export function getCustomerProfile(): CustomerProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as CustomerProfile;
  } catch {
    return null;
  }
}

export function saveCustomerProfile(profile: Partial<CustomerProfile>) {
  if (typeof window === "undefined") return;
  try {
    const current = getCustomerProfile();
    const merged: CustomerProfile = {
      name: profile.name ?? current?.name ?? "",
      phone: profile.phone ?? current?.phone ?? "",
      email: profile.email ?? current?.email,
      cpf: profile.cpf ?? current?.cpf,
      birthDate: profile.birthDate ?? current?.birthDate,
      address: {
        ...(current?.address || {}),
        ...(profile.address || {}),
      },
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {}
}

export function clearCustomerProfile() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export function hasCustomerProfile(): boolean {
  const p = getCustomerProfile();
  return !!(p && p.name && p.phone);
}
