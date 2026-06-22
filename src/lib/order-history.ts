const KEY = "oxente-orders-v1";
const ACTIVE_KEY = "active_order_id";

export type SavedOrder = {
  id: string;
  createdAt: string;
  total: number;
};

export function getSavedOrders(): SavedOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveOrder(order: SavedOrder) {
  if (typeof window === "undefined") return;
  try {
    const list = getSavedOrders().filter((o) => o.id !== order.id);
    list.unshift(order);
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 20)));
  } catch {}
}

export function getActiveOrderId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function setActiveOrderId(id: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {}
}

export function clearActiveOrderId() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ACTIVE_KEY);
  } catch {}
}