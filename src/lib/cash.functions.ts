import { supabase } from "@/integrations/supabase/client";

export async function getCashStatus() {
  const { data, error } = await supabase
    .from("cash_registers")
    .select("*, cash_movements(*)")
    .eq("status", "open")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function openCash(initialBalance: number, businessDate?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Você precisa estar autenticado para abrir o caixa.");
  
  const { data, error } = await supabase
    .from("cash_registers")
    .insert({
      user_id: user.id,
      initial_balance: initialBalance,
      status: "open",
      opening_time: new Date().toISOString(),
      business_date: businessDate || new Date().toISOString().split('T')[0],
    } as any)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function closeCash(
  id: string, 
  actualBalance: number, 
  expectedBalance: number,
  fundoTroco: number,
  notes?: string,
  observations?: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const discrepancy = actualBalance - expectedBalance;

  const { error } = await supabase
    .from("cash_registers")
    .update({
      physical_balance: actualBalance,
      saldo_real: actualBalance,
      final_balance: actualBalance,
      status: "closed",
      closing_time: new Date().toISOString(),
      discrepancy_reason: notes ?? null,
      divergencia: discrepancy,
      observacao_divergencia: observations ?? null,
      fundo_troco_deixado: fundoTroco,
      closed_by_user_id: user.id
    } as any)
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function forceCloseByManager(id: string, expectedBalance: number) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const { error } = await supabase
    .from("cash_registers")
    .update({
      status: "closed",
      closing_time: new Date().toISOString(),
      physical_balance: expectedBalance,
      saldo_real: expectedBalance,
      final_balance: expectedBalance,
      divergencia: 0,
      observacao_divergencia: "Fechamento forçado por pendência operacional",
      fundo_troco_deixado: 0, // Manager might not know or set to zero for clean slate
      closed_by_user_id: user.id
    } as any)
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function addCashMovement(registerId: string, type: "suprimento" | "sangria", amount: number, reason: string) {
  const { error } = await supabase
    .from("cash_movements")
    .insert({
      register_id: registerId,
      type,
      amount,
      reason,
    } as any);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getCashHistory() {
  const { data, error } = await supabase
    .from("cash_registers")
    .select("*")
    .order("opening_time", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getDailyPaidOrders() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .in("status", ["preparing", "delivered", "completed"])
    .gte("created_at", today.toISOString());
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Check if a register is expired based on business date and cutover time.
 */
export function isRegisterExpired(
  register: { business_date: string } | null | undefined,
  limiteVirada: string = "05:00"
): boolean {
  if (!register?.business_date) return false;

  const [hStr, mStr] = limiteVirada.split(":");
  const cutoverH = Number(hStr) || 5;
  const cutoverM = Number(mStr) || 0;

  const now = new Date();
  
  // businessDate is 'YYYY-MM-DD'
  const [bYear, bMonth, bDay] = register.business_date.split('-').map(Number);
  const businessDate = new Date(bYear, bMonth - 1, bDay);
  
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const cutoverMinutes = cutoverH * 60 + cutoverM;

  const isPastDay = todayDate.getTime() > businessDate.getTime();
  const reachedCutover = isPastDay && minutesNow >= cutoverMinutes;
  
  // Also check if 2+ days have passed
  const diffDays = Math.floor((todayDate.getTime() - businessDate.getTime()) / (1000 * 60 * 60 * 24));
  const veryStale = diffDays >= 2;

  return reachedCutover || veryStale;
}

/** Lightweight check used by the customer checkout to know if it can submit. */
export async function isCashOpenNow(): Promise<boolean> {
  const { data, error } = await supabase
    .from("cash_registers")
    .select("id, business_date")
    .eq("status", "open")
    .limit(1)
    .maybeSingle();
  
  if (error || !data) return false;

  // We also need settings for the cutover time
  const { data: settings } = await supabase
    .from("restaurant_settings")
    .select("limite_virada_caixa")
    .maybeSingle();
  
  const limite = (settings as any)?.limite_virada_caixa || "05:00";
  
  if (isRegisterExpired(data, limite)) {
    return false;
  }

  return true;
}
