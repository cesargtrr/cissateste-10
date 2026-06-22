import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(url, service);
    const { data: role } = await admin.from("user_roles")
      .select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "Forbidden" }, 403);

    const { driver_id, new_password } = await req.json();
    if (!driver_id || !new_password || String(new_password).length < 6) {
      return json({ error: "Invalid input" }, 400);
    }

    const { data: driver } = await admin
      .from("delivery_drivers").select("user_id").eq("id", driver_id).maybeSingle();
    if (!driver?.user_id) return json({ error: "Driver has no linked account" }, 404);

    const { error } = await admin.auth.admin.updateUserById(driver.user_id, {
      password: new_password,
    });
    if (error) return json({ error: error.message }, 400);

    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e?.message || "Server error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}