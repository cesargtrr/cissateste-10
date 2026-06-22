import { useSyncExternalStore } from "react";

export type CartItem = {
  cartId: string;
  id: string | number;
  name: string;
  price: number;
  qty: number;
  extras?: { id?: string; name: string; price: number; qty: number }[];
  notes?: string;
};

const STORAGE_KEY = "oxente-cart-v1";

let items: CartItem[] = [];
const listeners = new Set<() => void>();
let hydrated = false;

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      items = Array.isArray(parsed)
        ? parsed
            .map((item) => normalizeCartItem(item))
            .filter((item): item is CartItem => item !== null)
        : [];
    }
  } catch {}
}

function normalizeCartItem(item: unknown): CartItem | null {
  if (!item || typeof item !== "object") return null;

  const raw = item as Record<string, unknown>;
  const price = parsePrice(raw.price);
  const qty = Number(raw.qty);
  const name = typeof raw.name === "string" ? raw.name : "Item";
  const extras = Array.isArray(raw.extras)
    ? raw.extras
        .map((extra) => {
          if (!extra || typeof extra !== "object") return null;
          const rawExtra = extra as Record<string, unknown>;
          const extraId = typeof rawExtra.id === "string" ? rawExtra.id : undefined;
          const extraName = typeof rawExtra.name === "string" ? rawExtra.name : null;
          const extraQty = Number(rawExtra.qty);
          const extraPrice = parsePrice(rawExtra.price);

          if (!extraName || !Number.isFinite(extraQty) || extraQty <= 0) return null;

          return {
            id: extraId,
            name: extraName,
            qty: Math.min(99, Math.max(1, Math.trunc(extraQty))),
            price: extraPrice,
          };
        })
        .filter((extra): extra is NonNullable<typeof extra> => extra !== null)
    : undefined;

  return {
    cartId:
      typeof raw.cartId === "string" && raw.cartId.trim()
        ? raw.cartId
        : Math.random().toString(36).substring(7),
    id:
      typeof raw.id === "string" || typeof raw.id === "number"
        ? raw.id
        : Math.random().toString(36).substring(7),
    name,
    price,
    qty: Number.isFinite(qty) && qty > 0 ? Math.min(99, Math.trunc(qty)) : 1,
    extras,
    notes: typeof raw.notes === "string" ? raw.notes : undefined,
  };
}

function emit() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  hydrate();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot() {
  return items;
}

function getServerSnapshot() {
  return [] as CartItem[];
}

export function addItem(item: Omit<CartItem, "qty" | "cartId">, qty = 1) {
  hydrate();
  const normalizedItem = normalizeCartItem({ ...item, qty, cartId: "pending" });
  if (!normalizedItem) return;
  
  // Create a unique key for the item based on ID, extras, and notes
  const extrasKey = normalizedItem.extras?.map(e => `${e.name}-${e.qty}`).sort().join("|") || "";
  const itemUniqueId = `${normalizedItem.id}-${extrasKey}-${normalizedItem.notes || ""}`;

  const existingIndex = items.findIndex((i) => {
    const iExtrasKey = i.extras?.map(e => `${e.name}-${e.qty}`).sort().join("|") || "";
    const iUniqueId = `${i.id}-${iExtrasKey}-${i.notes || ""}`;
    return iUniqueId === itemUniqueId;
  });

  if (existingIndex !== -1) {
    items = items.map((i, idx) =>
      idx === existingIndex ? { ...i, qty: Math.min(99, i.qty + normalizedItem.qty) } : i
    );
  } else {
    items = [...items, { ...normalizedItem, cartId: Math.random().toString(36).substring(7) }];
  }
  emit();
}

export function updateQty(cartId: CartItem["cartId"], qty: number) {
  if (qty <= 0) return removeItem(cartId);
  items = items.map((i) => (i.cartId === cartId ? { ...i, qty } : i));
  emit();
}

export function removeItem(cartId: CartItem["cartId"]) {
  items = items.filter((i) => i.cartId !== cartId);
  emit();
}

export function clearCart() {
  items = [];
  emit();
}

export function useCart() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const count = list.reduce((s, i) => s + i.qty, 0);
  const total = list.reduce((s, i) => {
    const extrasTotal = i.extras?.reduce((acc, e) => acc + (e.price * e.qty), 0) || 0;
    return s + i.qty * (i.price + extrasTotal);
  }, 0);
  return { items: list, count, total };
}

export function parsePrice(price: any): number {
  if (typeof price === "number") return price;
  if (!price || typeof price !== "string") return 0;
  const n = parseFloat(price.replace(/[^\d,.-]/g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

export function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}