import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Reads whether the delivery/driver module is enabled in restaurant_settings.
 * Defaults to `true` while loading or if the column is missing.
 */
export function useDeliveryModuleEnabled() {
  const { data, isLoading } = useQuery({
    queryKey: ["delivery-module-enabled"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_settings")
        .select("delivery_module_enabled")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      const v = (data as any)?.delivery_module_enabled;
      return v === undefined || v === null ? true : Boolean(v);
    },
    staleTime: 30_000,
  });
  return { enabled: data ?? true, isLoading };
}
