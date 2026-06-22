import { useSyncExternalStore } from "react";

export type ServiceMode =
  | { kind: "mesa"; table: string; customerName: string; mesaSession?: string }
  | { kind: "retirada"; customerName: string }
  | {
      kind: "delivery";
      customerName: string;
      address: string;
      reference: string;
      deliveryFee: number;
    }
  | null;

const STORAGE_KEY = "oxente-service-mode-v1";

let current: ServiceMode = null;
const listeners = new Set<() => void>();
let hydrated = false;

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Names are intentionally not persisted; require user to re-enter.
      if (parsed && typeof parsed === "object" && "kind" in parsed) {
        current = { ...parsed, customerName: "" } as ServiceMode;
      }
    }
  } catch {}
}

function emit() {
  if (typeof window !== "undefined") {
    try {
      if (current) {
        // Do NOT persist the customer name to localStorage (privacy).
        const { customerName: _omit, ...rest } = current as any;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
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
  return current;
}

function getServerSnapshot(): ServiceMode {
  return null;
}

export function setServiceMode(mode: ServiceMode) {
  // For mesa mode, ensure a stable mesa_session token exists so that
  // multiple orders placed for the same table accumulate into one comanda.
  if (mode && mode.kind === "mesa") {
    const existing = (current && current.kind === "mesa" && current.table === mode.table)
      ? current.mesaSession
      : null;
    const mesaSession =
      mode.mesaSession ||
      existing ||
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `mesa-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    current = { ...mode, mesaSession };
  } else {
    current = mode;
  }
  emit();
}

export function getMesaSession(): string | null {
  hydrate();
  if (current && current.kind === "mesa") return current.mesaSession ?? null;
  return null;
}

export function useServiceMode() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function describeMode(mode: ServiceMode): string {
  if (!mode) return "Não definido";
  if (mode.kind === "mesa") return `Mesa ${mode.table}`;
  // Both delivery and pickup (retirada) are now grouped under "Pedido Externo"
  return "Pedido Externo";
}